import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import type { SaleType } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';

/** 閘門名額與資料庫重新同步的週期 */
const GATE_TTL_SECONDS = 60;
/** 商品販售類型的記憶體快取時間 */
const SALE_TYPE_TTL_MS = 30_000;

const RESERVE = `
local stock = redis.call('GET', KEYS[1])
if not stock then return -1 end
local quantity = tonumber(ARGV[1])
if tonumber(stock) < quantity then return 0 end
redis.call('DECRBY', KEYS[1], quantity)
return 1`;

const RELEASE = `
if redis.call('EXISTS', KEYS[1]) == 1 then return redis.call('INCRBY', KEYS[1], ARGV[1]) end
return -1`;

/**
 * 限量發售的 Redis 預檢閘門。
 * 開賣瞬間大量請求同時搶購時，先在 Redis 以 Lua 原子預扣名額，名額用完的請求直接回應售完、不進資料庫；
 * 通過閘門的請求仍以資料庫的條件式扣庫存為準 —— 閘門只負責減壓，防超賣的最後防線仍是資料庫。
 * 名額以資料庫庫存初始化、60 秒過期重新同步；Redis 故障時放行。
 */
@Injectable()
export class DropGateService {
  private readonly logger = new Logger(DropGateService.name);
  private readonly saleTypeCache = new Map<string, { saleType: SaleType; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * 商品的販售類型（記憶體快取 30 秒）。開賣瞬間同一個商品湧入大量請求，
   * 售完的請求只經過 Redis 與這個快取，完全不碰資料庫；交易內仍以資料庫的最新資料再驗證一次。
   */
  async saleTypes(productIds: string[]): Promise<Map<string, SaleType | null>> {
    const now = Date.now();
    const missing = productIds.filter((id) => (this.saleTypeCache.get(id)?.expiresAt ?? 0) <= now);
    if (missing.length) {
      const rows = await this.prisma.product.findMany({
        where: { id: { in: missing } },
        select: { id: true, saleType: true },
      });
      const found = new Map(rows.map((row) => [row.id, row.saleType]));
      for (const id of missing) {
        const saleType = found.get(id);
        // 只快取存在的商品：亂填的商品 ID 不會讓快取無限成長
        if (saleType) this.saleTypeCache.set(id, { saleType, expiresAt: now + SALE_TYPE_TTL_MS });
        else this.saleTypeCache.delete(id);
      }
    }
    return new Map(productIds.map((id) => [id, this.saleTypeCache.get(id)?.saleType ?? null]));
  }

  /** 預扣名額；false 表示一定買不到（售完），true 表示可以進資料庫交易 */
  async reserve(productId: string, quantity: number): Promise<boolean> {
    if (!this.config.DROP_GATE_ENABLED) return true;
    const key = gateKey(productId);
    try {
      let result = (await this.redis.eval(RESERVE, 1, key, quantity)) as number;
      if (result === -1) {
        const product = await this.prisma.product.findUnique({
          where: { id: productId },
          select: { stock: true },
        });
        await this.redis.set(key, product?.stock ?? 0, 'EX', GATE_TTL_SECONDS, 'NX');
        result = (await this.redis.eval(RESERVE, 1, key, quantity)) as number;
      }
      return result !== 0;
    } catch (error) {
      this.logger.warn(`限量閘門無法使用，改由資料庫判斷：${(error as Error).message}`);
      return true;
    }
  }

  /** 交易失敗時歸還預扣的名額 */
  async release(productId: string, quantity: number): Promise<void> {
    if (!this.config.DROP_GATE_ENABLED) return;
    await this.redis.eval(RELEASE, 1, gateKey(productId), quantity).catch(() => undefined);
  }

  /** 庫存因取消、退款或後台調整而變動：清掉閘門，下一個請求從資料庫重新同步 */
  async invalidate(productIds: string[]): Promise<void> {
    if (productIds.length === 0) return;
    await this.redis.del(...productIds.map(gateKey)).catch(() => undefined);
  }
}

function gateKey(productId: string): string {
  return `drop:stock:${productId}`;
}
