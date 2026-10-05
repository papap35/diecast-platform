import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';

/** 閘門名額與資料庫重新同步的週期 */
const GATE_TTL_SECONDS = 60;

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** 預扣名額；false 表示一定買不到（售完），true 表示可以進資料庫交易 */
  async reserve(productId: string, quantity: number): Promise<boolean> {
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
