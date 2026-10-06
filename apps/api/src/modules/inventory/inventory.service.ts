import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { uuidv7 } from '../../common/security/random.js';
import type { Prisma, StockMovementReason } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { DropGateService } from './drop-gate.service.js';

export interface MovementContext {
  reason: StockMovementReason;
  orderId?: string;
  actorId?: string;
  note?: string;
}

type Tx = Prisma.TransactionClient;

/**
 * 庫存的唯一入口。
 * 扣庫存用「條件式 UPDATE」：WHERE stock >= qty，資料庫逐列上鎖，
 * 同時上千個請求搶同一件商品也不會扣成負數（另有 CHECK 約束作為最後防線）。
 * 同一筆交易要動多件商品時，呼叫端依商品 ID 排序上鎖，避免兩筆交易互相等待（deadlock）。
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gate: DropGateService,
  ) {}

  /** 原子扣減；庫存不足時回傳 null，由呼叫端決定如何處理（通常整筆交易回滾） */
  async decrement(
    tx: Tx,
    productId: string,
    quantity: number,
    ctx: MovementContext,
  ): Promise<number | null> {
    return this.move(tx, productId, -quantity, ctx);
  }

  /** 回補庫存；從 0 補回有貨時記下補貨時間（通知把商品加入願望清單的會員） */
  async increment(
    tx: Tx,
    productId: string,
    quantity: number,
    ctx: MovementContext,
  ): Promise<number> {
    const stock = await this.move(tx, productId, quantity, ctx);
    if (stock === null) throw AppException.notFound(ErrorCode.PRODUCT_NOT_FOUND, '找不到這個商品');
    return stock;
  }

  /** 後台手動調整庫存（以增減量表示，避免覆寫掉同時間成立的訂單扣量） */
  async adjust(productId: string, delta: number, actorId: string, note?: string): Promise<number> {
    const stock = await this.prisma.$transaction(async (tx) => {
      const ctx: MovementContext = { reason: 'ADMIN_ADJUSTMENT', actorId, note };
      if (delta >= 0) return this.increment(tx, productId, delta, ctx);
      const stock = await this.decrement(tx, productId, -delta, ctx);
      if (stock === null) {
        throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, '調整後庫存不可小於 0');
      }
      return stock;
    });
    await this.gate.invalidate([productId]);
    return stock;
  }

  /**
   * 改庫存並寫異動紀錄，合成一句 SQL。
   * UPDATE 會鎖住商品那一列直到 COMMIT，開賣時所有搶購者排隊等同一把鎖；
   * 持鎖期間每少一次 API 與資料庫的來回，排在後面的人就少等一段（見 docs/load-testing.md）。
   */
  private async move(
    tx: Tx,
    productId: string,
    delta: number,
    ctx: MovementContext,
  ): Promise<number | null> {
    const rows = await tx.$queryRaw<{ stock: number }[]>`
      WITH updated AS (
        UPDATE "Product" SET
          "stock" = "stock" + ${delta}::int,
          "updatedAt" = now(),
          "restockedAt" = CASE WHEN "stock" <= 0 AND ${delta}::int > 0 THEN now() ELSE "restockedAt" END
        WHERE "id" = ${productId}::uuid AND "stock" + ${delta}::int >= 0
        RETURNING "id", "stock"
      ), movement AS (
        INSERT INTO "StockMovement" ("id", "productId", "delta", "balance", "reason", "orderId", "actorId", "note")
        SELECT ${uuidv7()}::uuid, "id", ${delta}::int, "stock", ${ctx.reason}::"StockMovementReason",
          ${ctx.orderId ?? null}::uuid, ${ctx.actorId ?? null}::uuid, ${ctx.note ?? null}::text
        FROM updated
      )
      SELECT "stock" FROM updated`;
    return rows[0]?.stock ?? null;
  }
}
