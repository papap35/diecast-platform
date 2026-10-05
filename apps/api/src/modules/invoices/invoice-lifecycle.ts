import type {
  IntegrationProvider,
  Order,
  OrderItem,
  Prisma,
} from '../../generated/prisma/client.js';
import type { InvoiceOrder } from './ecpay-invoice.js';

type Tx = Prisma.TransactionClient;

/**
 * 訂單狀態變更時的發票處理（在訂單的交易內執行，只寫入待辦，實際開立／作廢由排程呼叫加值中心）：
 * - 付款成功 → 建立待開立的發票
 * - 退款 → 尚未開立的取消開立；已開立的排入作廢（當期）或折讓（跨期）
 */
export async function queueInvoice(
  tx: Tx,
  order: Pick<Order, 'id' | 'total'>,
  provider: IntegrationProvider,
): Promise<void> {
  await tx.invoice.upsert({
    where: { orderId: order.id },
    create: { orderId: order.id, provider, amount: order.total },
    update: {},
  });
}

export async function reverseInvoice(tx: Tx, orderId: string): Promise<void> {
  await tx.invoice.updateMany({
    where: { orderId, status: 'PENDING' },
    data: { status: 'CANCELLED', nextAttemptAt: null },
  });
  await tx.invoice.updateMany({
    where: { orderId, status: 'ISSUED' },
    data: { status: 'VOID_PENDING', attempts: 0, nextAttemptAt: null, lastError: null },
  });
}

/** 訂單 → 開立發票需要的資料。公司發票列印後隨貨寄出，地址用收件地址或取貨門市 */
export function toInvoiceOrder(order: Order & { items: OrderItem[] }): InvoiceOrder {
  const printAddress =
    order.shippingMethod === 'HOME_DELIVERY'
      ? [order.city, order.district, order.addressLine].filter(Boolean).join('')
      : [order.cvsStoreName, order.cvsStoreAddress].filter(Boolean).join(' ');
  return {
    orderNo: order.orderNo,
    total: order.total,
    shippingFee: order.shippingFee,
    recipientName: order.recipientName,
    recipientEmail: order.recipientEmail,
    recipientPhone: order.recipientPhone,
    invoiceType: order.invoiceType,
    invoiceCarrierNum: order.invoiceCarrierNum,
    invoiceDonationCode: order.invoiceDonationCode,
    invoiceTaxId: order.invoiceTaxId,
    invoiceTitle: order.invoiceTitle,
    printAddress,
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
  };
}
