/**
 * 示範訂單：讓後台儀表板、訂單列表一打開就有資料。
 * 只建立一次（以第一位示範會員是否存在判斷）；使用固定亂數種子，每次產生的資料都一樣。
 */
import type {
  OrderStatus,
  Prisma,
  PrismaClient,
  ShipmentStatus,
} from '../../src/generated/prisma/client.js';
import { hashPassword } from '../../src/common/security/password.js';
import { parkOrderInGarage } from '../../src/modules/garage/garage-lifecycle.js';
import { LOGISTICS_KIND } from '../../src/modules/logistics/ecpay-logistics.js';
import { tierFor } from '../../src/modules/members/tiers.js';

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

type DemoProduct = Prisma.ProductGetPayload<{
  include: { translations: true; images: true };
}>;

interface DemoMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  locale: string;
}

interface DemoOrderInput {
  orderNo: string;
  member: DemoMember;
  status: OrderStatus;
  createdAt: Date;
  lines: { product: DemoProduct; quantity: number }[];
  /** null 表示宅配 */
  store: (typeof STORES)[number] | null;
  invoiceType: 'MEMBER_CARRIER' | 'DONATION';
  /** 下單到付款的分鐘數 */
  payAfterMinutes: number;
  /** 未付款訂單的付款期限 */
  paymentDeadline?: Date;
}

/** 建立一筆示範訂單：訂單、事件時間軸、扣庫存與異動紀錄、會員累計消費（與正式流程的資料一致） */
async function createDemoOrder(prisma: PrismaClient, input: DemoOrderInput): Promise<void> {
  const { member, status, createdAt, store } = input;
  const lines = input.lines.map(({ product, quantity }) => ({
    product,
    quantity,
    name: product.translations.find((t) => t.locale === 'zh-TW')?.name ?? product.sku,
    lineTotal: product.price * quantity,
  }));
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const home = store === null;
  const shippingFee = home ? (subtotal >= 1500 ? 0 : 120) : subtotal >= 1000 ? 0 : 60;
  const paid = !['PENDING_PAYMENT', 'CANCELLED'].includes(status);
  const paidAt = paid ? new Date(createdAt.getTime() + input.payAfterMinutes * 60_000) : null;
  const shippedAt =
    status === 'SHIPPED' || status === 'COMPLETED' ? new Date(createdAt.getTime() + DAY) : null;
  const completedAt = status === 'COMPLETED' ? new Date(createdAt.getTime() + 3 * DAY) : null;
  const total = subtotal + shippingFee;

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNo: input.orderNo,
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
        invoiceType: input.invoiceType,
        invoiceDonationCode: input.invoiceType === 'DONATION' ? '168001' : null,
        paymentDeadline: status === 'PENDING_PAYMENT' ? (input.paymentDeadline ?? null) : null,
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
                merchantTradeNo: `DEMO${input.orderNo.slice(3)}`,
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
    if (paidAt) {
      events.push({
        type: 'STATUS_CHANGED',
        toStatus: 'PAID',
        at: paidAt,
        message: '付款成功（MOCK）',
        actor: 'SYSTEM',
      });
    }
    if (['PROCESSING', 'SHIPPED', 'COMPLETED'].includes(status) && paidAt) {
      events.push({
        type: 'STATUS_CHANGED',
        toStatus: 'PROCESSING',
        at: new Date(paidAt.getTime() + 2 * HOUR),
        message: '已建立物流單，開始備貨',
        actor: 'ADMIN',
      });
    }
    if (shippedAt) {
      events.push({
        type: 'STATUS_CHANGED',
        toStatus: 'SHIPPED',
        at: shippedAt,
        message: '包裹已寄出',
        actor: 'SYSTEM',
      });
    }
    if (completedAt) {
      events.push({
        type: 'STATUS_CHANGED',
        toStatus: 'COMPLETED',
        at: completedAt,
        message: '顧客已取件／簽收',
        actor: 'SYSTEM',
      });
    }
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
}

/** 日期 + 序號轉成像正式訂單的編號（P64 + 台灣日期 + 5 碼） */
function demoOrderNo(createdAt: Date, seq: number): string {
  const date = new Date(createdAt.getTime() + 8 * HOUR)
    .toISOString()
    .slice(2, 10)
    .replace(/-/g, '');
  const code = String(10000 + seq * 7919)
    .slice(-5)
    .replace(/\d/g, (d) => 'ABCDEFGHJK'[Number(d)]!);
  return `P64${date}${code}`;
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

  for (const [i, { ageDays, createdAt }] of timeline.entries()) {
    const member = members[Math.floor(random() * members.length)]!;
    const status = statusFor(ageDays, random());
    const lineCount = 1 + Math.floor(random() * 3);
    const picked = [...products].sort(() => random() - 0.5).slice(0, lineCount);
    const lines = picked.map((product) => ({ product, quantity: 1 + Math.floor(random() * 2) }));
    const store = STORES[Math.floor(random() * STORES.length)]!;
    await createDemoOrder(prisma, {
      orderNo: demoOrderNo(createdAt, i),
      member,
      status,
      createdAt,
      lines,
      store: random() < 0.3 ? null : store,
      invoiceType: random() < 0.8 ? 'MEMBER_CARRIER' : 'DONATION',
      payAfterMinutes: 3 + random() * 20,
      paymentDeadline: new Date(now + 25 * 60_000),
    });
  }
  return timeline.length;
}

/**
 * 示範會員（demo@paddock64.dev）的兩筆歷史訂單：累計消費 NT$2,398，差 NT$602 升級正式車手，
 * 讓審閱者再買一台就能看到升級通知與優先購資格。
 */
export async function seedDemoMemberOrders(prisma: PrismaClient, email: string): Promise<number> {
  const member = await prisma.member.findUnique({ where: { email } });
  if (!member || (await prisma.order.count({ where: { memberId: member.id } })) > 0) return 0;
  const products = await prisma.product.findMany({
    where: {
      slug: {
        in: [
          'formosa-taxi-95',
          'formosa-night-market-food-truck',
          'sakura-kei-van-89',
          'shiden-rs-coupe-midnight-purple',
          'kaminari-type-s-championship-white',
        ],
      },
    },
    include: { translations: true, images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
  });
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const pick = (slug: string, quantity = 1) => ({ product: bySlug.get(slug)!, quantity });
  const now = Date.now();
  const orders = [
    {
      createdAt: new Date(now - 22 * DAY - 3 * HOUR),
      lines: [
        pick('formosa-taxi-95'),
        pick('formosa-night-market-food-truck'),
        pick('sakura-kei-van-89'),
      ],
    },
    {
      createdAt: new Date(now - 9 * DAY - 5 * HOUR),
      lines: [
        pick('shiden-rs-coupe-midnight-purple', 2),
        pick('kaminari-type-s-championship-white'),
      ],
    },
  ];
  for (const [index, { createdAt, lines }] of orders.entries()) {
    await createDemoOrder(prisma, {
      orderNo: demoOrderNo(createdAt, 900 + index),
      member,
      status: 'COMPLETED',
      createdAt,
      lines,
      store: STORES[0],
      invoiceType: 'MEMBER_CARRIER',
      payAfterMinutes: 6,
    });
  }
  return orders.length;
}

/** 依累計消費重新計算所有會員的等級（示範訂單直接寫入消費金額，不經過訂單狀態機） */
export async function syncTiers(prisma: PrismaClient): Promise<void> {
  const members = await prisma.member.findMany({
    select: { id: true, tier: true, totalSpent: true },
  });
  for (const member of members) {
    const tier = tierFor(member.totalSpent);
    if (tier !== member.tier) {
      await prisma.member.update({
        where: { id: member.id },
        data: { tier, tierUpdatedAt: new Date() },
      });
    }
  }
}

const SHIPMENT_FOR: Partial<Record<OrderStatus, ShipmentStatus>> = {
  PROCESSING: 'CREATED',
  SHIPPED: 'IN_TRANSIT',
  COMPLETED: 'PICKED_UP',
};

/**
 * 示範訂單的電子發票、物流單（模擬服務）與車庫入庫。可重複執行：只補上還沒有的，
 * 號碼由訂單編號推導，每次產生的結果都一樣。
 */
export async function seedDemoFulfilment(prisma: PrismaClient, demoEmail: string): Promise<number> {
  const orders = await prisma.order.findMany({
    where: {
      member: { OR: [{ email: { endsWith: '@example.com' } }, { email: demoEmail }] },
      status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'] },
    },
    include: { invoice: true, shipment: true, items: true },
    orderBy: { createdAt: 'asc' },
  });
  let updated = 0;
  for (const order of orders) {
    // 取件完成的車款停進車庫（以 orderItemId 去重，可重複執行）
    if (order.status === 'COMPLETED') {
      await parkOrderInGarage(prisma, order, order.completedAt ?? order.createdAt);
    }
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
