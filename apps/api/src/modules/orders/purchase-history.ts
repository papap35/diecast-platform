import type { Prisma } from '../../generated/prisma/client.js';

type Db = Pick<Prisma.TransactionClient, 'orderItem'>;

/** 會員對各商品「已成立訂單」的累計購買數量（取消與退款不計），用於限購檢查 */
export async function purchasedQuantities(
  db: Db,
  memberId: string,
  productIds: string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const rows = await db.orderItem.groupBy({
    by: ['productId'],
    where: {
      productId: { in: productIds },
      order: { memberId, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
    },
    _sum: { quantity: true },
  });
  return new Map(rows.map((row) => [row.productId, row._sum.quantity ?? 0]));
}
