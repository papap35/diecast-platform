import type { OrderItem, Prisma } from '../../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

interface CompletedOrder {
  memberId: string;
  items: OrderItem[];
}

/**
 * 訂單完成（顧客取件／簽收）後，購買的車款自動停進會員的車庫。
 * 名稱、品牌與比例存快照，商品之後下架也能顯示；以 orderItemId 去重，重複執行不會重複入庫。
 */
export async function parkOrderInGarage(
  tx: Tx,
  order: CompletedOrder,
  acquiredAt: Date = new Date(),
): Promise<void> {
  const products = await tx.product.findMany({
    where: { id: { in: order.items.map((item) => item.productId) } },
    select: { id: true, scale: true, brand: { select: { name: true } } },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  await tx.garageItem.createMany({
    data: order.items.map((item) => ({
      memberId: order.memberId,
      productId: item.productId,
      orderItemId: item.id,
      name: item.name,
      brandName: byId.get(item.productId)?.brand.name ?? null,
      scale: byId.get(item.productId)?.scale ?? null,
      quantity: item.quantity,
      pricePaid: item.unitPrice,
      acquiredAt,
    })),
    skipDuplicates: true,
  });
}

/** 已完成的訂單退貨：移除當初自動入庫的車款（會員手動登錄的不受影響） */
export async function removeOrderFromGarage(tx: Tx, order: CompletedOrder): Promise<void> {
  await tx.garageItem.deleteMany({
    where: { orderItemId: { in: order.items.map((item) => item.id) } },
  });
}
