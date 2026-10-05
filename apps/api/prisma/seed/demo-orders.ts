/**
 * 示範訂單：讓後台儀表板、訂單列表一打開就有資料。
 * 只建立一次（以第一位示範會員是否存在判斷）；使用固定亂數種子，每次產生的資料都一樣。
 */
import type {
  OrderStatus,
  PrismaClient,
  ShipmentStatus,
} from '../../src/generated/prisma/client.js';
import { hashPassword } from '../../src/common/security/password.js';
import { LOGISTICS_KIND } from '../../src/modules/logistics/ecpay-logistics.js';

const MEMBERS = [
  ['陳冠宇', 'guanyu.chen'],
  ['林雅婷', 'yating.lin'],
  ['王柏翰', 'bohan.wang'],
  ['張詠晴', 'yongqing.chang'],
  ['李承恩', 'chengen.lee'],
  ['黃思妤', 'siyu.huang'],
  ['吳俊廷', 'junting.wu'],
  ['劉品妍', 'pinyan.liu'],
  ['蔡宗翰', 'zonghan.tsai'],
  ['楊子萱', 'zixuan.yang'],
  ['Alex Morgan', 'alex.morgan'],
  ['Kenji Sato', 'kenji.sato'],
] as const;

const STORES = [
  {
    method: 'CVS_711',
    id: '131386',
    name: '7-ELEVEN 建國門市',
    address: '臺北市中山區建國北路一段 100 號',
  },
  {
    method: 'CVS_FAMILY',
    id: '011385',
    name: '全家 板橋文化店',
    address: '新北市板橋區文化路一段 188 號',
  },
  {
    method: 'CVS_711',
    id: '172925',
    name: '7-ELEVEN 逢甲門市',
    address: '臺中市西屯區福星路 300 號',
  },
] as const;

/** mulberry32：固定種子的亂數，讓示範資料可重現 */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function statusFor(ageDays: number, roll: number): OrderStatus {
  if (ageDays >= 8) return roll < 0.1 ? 'CANCELLED' : 'COMPLETED';
  if (ageDays >= 4) return roll < 0.1 ? 'CANCELLED' : roll < 0.6 ? 'COMPLETED' : 'SHIPPED';
  if (ageDays >= 1) return roll < 0.5 ? 'SHIPPED' : 'PROCESSING';
  return roll < 0.25 ? 'PENDING_PAYMENT' : 'PAID';
}

export async function seedDemoOrders(prisma: PrismaClient): Promise<number> {
  // 以示範會員是否存在判斷是否已建立過，不影響其他真實或測試訂單
  if (await prisma.member.findUnique({ where: { email: `${MEMBERS[0][1]}@example.com` } }))
    return 0;
  const random = rng(64);
  const now = Date.now();

  const passwordHash = await hashPassword('Paddock64!member');
  const members = [];
  for (const [index, [name, handle]] of MEMBERS.entries()) {
    members.push(
      await prisma.member.upsert({
        where: { email: `${handle}@example.com` },
        create: {
          email: `${handle}@example.com`,
          name,
          phone: `09${String(10000000 + index * 1234567).slice(0, 8)}`,
          passwordHash,
          marketingOptIn: random() < 0.6,
          locale: handle.includes('.') && /[A-Z]/.test(name[0]!) ? 'en' : 'zh-TW',
          createdAt: new Date(now - (40 - index * 3) * DAY),
          lastLoginAt: new Date(now - random() * 5 * DAY),
        },
        update: {},
      }),
    );
  }

  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE', saleType: 'REGULAR', stock: { gt: 15 } },
    include: { translations: true, images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
  });

  // 先產生所有下單時間再依時間排序建立，庫存異動的餘額在時間軸上才會連貫
  const timeline = Array.from({ length: 42 }, () => {
    const ageDays = Math.floor(random() * 14);
    return { ageDays, createdAt: new Date(now - ageDays * DAY - random() * 10 * HOUR - HOUR) };
  }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  let created = 0;
  for (const [i, { ageDays, createdAt }] of timeline.entries()) {
    const member = members[Math.floor(random() * members.length)]!;
    const status = statusFor(ageDays, random());
    const lineCount = 1 + Math.floor(random() * 3);
    const picked = [...products].sort(() => random() - 0.5).slice(0, lineCount);
    const lines = picked.map((product) => {
      const quantity = 1 + Math.floor(random() * 2);
      return {
        product,
        quantity,
        name: product.translations.find((t) => t.locale === 'zh-TW')?.name ?? product.sku,
        lineTotal: product.price * quantity,
      };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const store = STORES[Math.floor(random() * STORES.length)]!;
    const home = random() < 0.3;
    const shippingFee = home ? (subtotal >= 1500 ? 0 : 120) : subtotal >= 1000 ? 0 : 60;
    const paid = !['PENDING_PAYMENT', 'CANCELLED'].includes(status);
    const paidAt = paid ? new Date(createdAt.getTime() + (3 + random() * 20) * 60_000) : null;
    const shippedAt =
      status === 'SHIPPED' || status === 'COMPLETED' ? new Date(createdAt.getTime() + DAY) : null;
    const completedAt = status === 'COMPLETED' ? new Date(createdAt.getTime() + 3 * DAY) : null;
    const total = subtotal + shippingFee;
    const orderNo = `P64${new Date(createdAt.getTime() + 8 * HOUR).toISOString().slice(2, 10).replace(/-/g, '')}${String(
      10000 + i * 7919,
    )
      .slice(-5)
      .replace(/\d/g, (d) => 'ABCDEFGHJK'[Number(d)]!)}`;

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNo,
          memberId: member.id,
          status,
          locale: member.locale,
          subtotal,
          shippingFee,
          total,
          shippingMethod: home ? 'HOME_DELIVERY' : store.method,
          recipientName: member.name,
          recipientPhone: member.phone ?? '0912345678',
          recipientEmail: member.email,
          postalCode: home ? '106' : null,
          city: home ? '臺北市' : null,
          district: home ? '大安區' : null,
          addressLine: home ? '復興南路一段 100 號 5 樓' : null,
          cvsStoreId: home ? null : store.id,
          cvsStoreName: home ? null : store.name,
          cvsStoreAddress: home ? null : store.address,
          invoiceType: random() < 0.8 ? 'MEMBER_CARRIER' : 'DONATION',
          invoiceDonationCode: null,
          paymentDeadline: status === 'PENDING_PAYMENT' ? new Date(now + 25 * 60_000) : null,
          paidAt,
          shippedAt,
          completedAt,
          cancelledAt: status === 'CANCELLED' ? new Date(createdAt.getTime() + 30 * 60_000) : null,
          cancelReason: status === 'CANCELLED' ? '付款期限已過，系統自動取消' : null,
          createdAt,
          items: {
            create: lines.map((line) => ({
              productId: line.product.id,
              sku: line.product.sku,
              name: line.name,
              imageUrl: line.product.images[0]?.url ?? null,
              saleType: line.product.saleType,
              unitPrice: line.product.price,
              quantity: line.quantity,
              lineTotal: line.lineTotal,
            })),
          },
          payments: paid
            ? {
                create: {
                  provider: 'MOCK',
                  status: 'SUCCEEDED',
                  merchantTradeNo: `DEMO${orderNo.slice(3)}`,
                  amount: total,
                  method: 'MockCard',
                  paidAt,
                  createdAt: new Date(createdAt.getTime() + 60_000),
                },
              }
            : undefined,
        },
      });

      const events: {
        type: string;
        toStatus: OrderStatus;
        at: Date;
        message: string;
        actor: 'MEMBER' | 'SYSTEM' | 'ADMIN';
      }[] = [
        {
          type: 'CREATED',
          toStatus: 'PENDING_PAYMENT',
          at: createdAt,
          message: '訂單成立',
          actor: 'MEMBER',
        },
      ];
      if (paidAt)
        events.push({
          type: 'STATUS_CHANGED',
          toStatus: 'PAID',
          at: paidAt,
          message: '付款成功（MOCK）',
          actor: 'SYSTEM',
        });
      if (['PROCESSING', 'SHIPPED', 'COMPLETED'].includes(status) && paidAt) {
        events.push({
          type: 'STATUS_CHANGED',
          toStatus: 'PROCESSING',
          at: new Date(paidAt.getTime() + 2 * HOUR),
          message: '開始備貨',
          actor: 'ADMIN',
        });
      }
      if (shippedAt)
        events.push({
          type: 'STATUS_CHANGED',
          toStatus: 'SHIPPED',
          at: shippedAt,
          message: '已交寄',
          actor: 'ADMIN',
        });
      if (completedAt)
        events.push({
          type: 'STATUS_CHANGED',
          toStatus: 'COMPLETED',
          at: completedAt,
          message: '顧客已取貨',
          actor: 'SYSTEM',
        });
      if (status === 'CANCELLED') {
        events.push({
          type: 'STATUS_CHANGED',
          toStatus: 'CANCELLED',
          at: new Date(createdAt.getTime() + 30 * 60_000),
          message: '付款期限已過，系統自動取消',
          actor: 'SYSTEM',
        });
      }
      await tx.orderEvent.createMany({
        data: events.map((event, index) => ({
          orderId: order.id,
          type: event.type,
          fromStatus: index === 0 ? null : events[index - 1]!.toStatus,
          toStatus: event.toStatus,
          actorType: event.actor,
          message: event.message,
          createdAt: event.at,
        })),
      });

      // 未取消的訂單才佔用庫存
      if (status !== 'CANCELLED') {
        for (const line of lines) {
          const updated = await tx.product.update({
            where: { id: line.product.id },
            data: { stock: { decrement: line.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: line.product.id,
              delta: -line.quantity,
              balance: updated.stock,
              reason: 'ORDER_PLACED',
              orderId: order.id,
              createdAt,
            },
          });
        }
      }
      if (paid) {
        await tx.member.update({
          where: { id: member.id },
          data: { totalSpent: { increment: total } },
        });
      }
    });
    created += 1;
  }
  return created;
}

const SHIPMENT_FOR: Partial<Record<OrderStatus, ShipmentStatus>> = {
  PROCESSING: 'CREATED',
  SHIPPED: 'IN_TRANSIT',
  COMPLETED: 'PICKED_UP',
};

/**
 * 示範訂單的電子發票與物流單（模擬服務）。可重複執行：只補上還沒有的，
 * 號碼由訂單編號推導，每次產生的結果都一樣。
 */
export async function seedDemoFulfilment(prisma: PrismaClient): Promise<number> {
  const orders = await prisma.order.findMany({
    where: {
      member: { email: { endsWith: '@example.com' } },
      status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'] },
    },
    include: { invoice: true, shipment: true },
    orderBy: { createdAt: 'asc' },
  });
  let updated = 0;
  for (const order of orders) {
    const random = rng([...order.orderNo].reduce((sum, c) => sum * 31 + c.charCodeAt(0), 7) >>> 0);
    const digits = (length: number) =>
      Array.from({ length }, () => Math.floor(random() * 10)).join('');
    const paidAt = order.paidAt ?? order.createdAt;
    const shipmentStatus = SHIPMENT_FOR[order.status];
    if (order.invoice && (order.shipment || !shipmentStatus)) continue;

    await prisma.$transaction(async (tx) => {
      if (!order.invoice) {
        const invoiceNo = `${'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(random() * 24)]}${'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(random() * 24)]}${digits(8)}`;
        const issuedAt = new Date(paidAt.getTime() + 60_000);
        await tx.invoice.create({
          data: {
            orderId: order.id,
            provider: 'MOCK',
            status: 'ISSUED',
            invoiceNo,
            invoiceDate: issuedAt,
            randomNumber: digits(4),
            amount: order.total,
            attempts: 1,
            raw: { simulated: true },
            createdAt: paidAt,
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: 'INVOICE_ISSUED',
            actorType: 'SYSTEM',
            message: `電子發票已開立：${invoiceNo}`,
            createdAt: issuedAt,
          },
        });
      }
      if (!order.shipment && shipmentStatus) {
        const kind = LOGISTICS_KIND[order.shippingMethod];
        const createdAt = new Date(paidAt.getTime() + 2 * HOUR);
        const home = order.shippingMethod === 'HOME_DELIVERY';
        const shipmentNo = digits(home ? 12 : 8);
        const progress = MOCK_PROGRESS[shipmentStatus];
        await tx.shipment.create({
          data: {
            orderId: order.id,
            provider: 'MOCK',
            logisticsType: kind.logisticsType,
            logisticsSubType: kind.logisticsSubType,
            merchantTradeNo: `DEMO${order.orderNo.slice(3)}`,
            logisticsId: digits(7),
            shipmentNo,
            validationNo: order.shippingMethod === 'CVS_711' ? digits(4) : null,
            status: shipmentStatus,
            statusCode: progress.code,
            statusMessage: progress.message,
            raw: { simulated: true },
            createdAt,
            updatedAt: order.completedAt ?? order.shippedAt ?? createdAt,
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: 'SHIPMENT_CREATED',
            actorType: 'ADMIN',
            message: `已建立物流單（模擬物流），寄貨編號 ${shipmentNo}`,
            createdAt,
          },
        });
      }
    });
    updated += 1;
  }
  return updated;
}

const MOCK_PROGRESS: Record<ShipmentStatus, { code: string; message: string }> = {
  CREATED: { code: '300', message: '訂單處理中（模擬物流）' },
  IN_TRANSIT: { code: '2068', message: '交貨便收件（模擬）' },
  ARRIVED: { code: '2073', message: '商品配達買家取貨門市（模擬）' },
  PICKED_UP: { code: '2067', message: '消費者成功取件（模擬）' },
  RETURNED: { code: '2074', message: '消費者七天未取，商品退回（模擬）' },
};
