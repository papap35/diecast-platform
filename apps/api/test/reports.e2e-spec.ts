import {
  createAdmin,
  createProduct,
  CVS_CHECKOUT,
  payWithMock,
  registerMember,
} from './fixtures.js';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

type Auth = Record<string, string>;
type Member = Awaited<ReturnType<typeof registerMember>>;
type Product = Awaited<ReturnType<typeof createProduct>>;
interface Placed {
  id: string;
  orderNo: string;
}

const HOME_CHECKOUT = {
  shippingMethod: 'HOME_DELIVERY',
  recipientName: '林小華',
  recipientPhone: '0987654321',
  postalCode: '407756',
  city: '臺中市',
  district: '西屯區',
  addressLine: '福星路 300 號',
  invoiceType: 'MEMBER_CARRIER',
};

/** 2026-03-01（週日）～ 03-07，前一期為 02-22 ～ 02-28 */
const RANGE = 'from=2026-03-01&to=2026-03-07';

describe('報表 (e2e)', () => {
  let ctx: TestContext;
  let admin: { auth: Auth };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    admin = await createAdmin(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const order = async (
    member: Member,
    items: [Product, number][],
    options: { home?: boolean; coupon?: string } = {},
  ): Promise<Placed> => {
    const res = await ctx
      .http()
      .post('/v1/orders')
      .set(member.auth)
      .send({
        ...(options.home ? HOME_CHECKOUT : CVS_CHECKOUT),
        items: items.map(([product, quantity]) => ({ productId: product.id, quantity })),
        couponCode: options.coupon,
      })
      .expect(201);
    return res.body;
  };

  /** 付款後把付款時間改到指定時間點，下單時間為付款前 10 分鐘 */
  const pay = async (member: Member, placed: Placed, paidAt: string) => {
    await payWithMock(ctx, member, placed.orderNo);
    const at = new Date(paidAt);
    await ctx.prisma.order.update({
      where: { id: placed.id },
      data: { paidAt: at, createdAt: new Date(at.getTime() - 10 * 60_000) },
    });
  };

  /**
   * 測試資料（台北時間）：
   * - o1 m1 A×2 超商 2,000 免運，03-02 09:00 付款
   * - o2 m2 B×1 宅配 500 + 120，03-04 01:00 付款（UTC 仍是 03-03，驗證以台北日期歸日）
   * - o3 m1 A×1 超商 折 100 → 900 + 60，03-04 10:00 付款
   * - o4 m2 B×2 超商 1,000，03-05 付款、03-06 退款 → 不計營收、計入退款
   * - o5 m1 B×1 未付款
   * - o6 m2 A×1 02-25 付款 → 前一期
   */
  const seed = async () => {
    const a = await createProduct(ctx.prisma, { price: 1000, stock: 20 });
    const b = await createProduct(ctx.prisma, { price: 500, stock: 20 });
    // B 的分類放到第一層分類底下，報表依第一層加總
    const parent = await ctx.prisma.category.create({
      data: { slug: 'parent', translations: { create: [{ locale: 'zh-TW', name: '工作車' }] } },
    });
    await ctx.prisma.category.update({
      where: { id: b.categoryId },
      data: { parentId: parent.id },
    });
    await ctx.prisma.coupon.create({
      data: { code: 'SAVE100', name: '折 100', type: 'FIXED', value: 100 },
    });
    const m1 = await registerMember(ctx);
    const m2 = await registerMember(ctx);

    const o1 = await order(m1, [[a, 2]]);
    await pay(m1, o1, '2026-03-02T01:00:00Z');
    const o2 = await order(m2, [[b, 1]], { home: true });
    await pay(m2, o2, '2026-03-03T17:00:00Z');
    const o3 = await order(m1, [[a, 1]], { coupon: 'SAVE100' });
    await pay(m1, o3, '2026-03-04T02:00:00Z');
    const o4 = await order(m2, [[b, 2]]);
    await pay(m2, o4, '2026-03-05T02:00:00Z');
    await ctx
      .http()
      .post(`/v1/admin/orders/${o4.id}/status`)
      .set(admin.auth)
      .send({ status: 'REFUNDED', note: '顧客取消' })
      .expect(201);
    await ctx.prisma.orderEvent.updateMany({
      where: { orderId: o4.id, toStatus: 'REFUNDED' },
      data: { createdAt: new Date('2026-03-06T02:00:00Z') },
    });
    const o5 = await order(m1, [[b, 1]]);
    await ctx.prisma.order.update({
      where: { id: o5.id },
      data: { createdAt: new Date('2026-03-06T03:00:00Z'), recipientName: '=HYPERLINK("x")' },
    });
    const o6 = await order(m2, [[a, 1]]);
    await pay(m2, o6, '2026-02-25T04:00:00Z');

    // 會員等級與註冊日固定下來（付款會自動升級，這裡直接指定）
    await ctx.prisma.member.update({
      where: { id: m1.id },
      data: { tier: 'CHAMPION', createdAt: new Date('2026-03-01T00:00:00Z') },
    });
    await ctx.prisma.member.update({
      where: { id: m2.id },
      data: { tier: 'ROOKIE', createdAt: new Date('2026-02-01T00:00:00Z') },
    });
    return { a, b, parent, o1, o2, o3, o4, o5, o6 };
  };

  it('銷售報表：總計、前期比較、依台北日期補齊趨勢，以及各種分析', async () => {
    const { a, b, parent } = await seed();
    const res = await ctx
      .http()
      .get(`/v1/admin/reports/sales?${RANGE}`)
      .set(admin.auth)
      .expect(200);
    const report = res.body;

    expect(report).toMatchObject({
      from: '2026-03-01',
      to: '2026-03-07',
      granularity: 'day',
      previousFrom: '2026-02-22',
      previousTo: '2026-02-28',
    });
    expect(report.totals).toEqual({
      revenue: 3580,
      orders: 3,
      units: 4,
      averageOrderValue: 1193,
      customers: 2,
      discount: 100,
      shippingFee: 180,
      refundOrders: 1,
      refundAmount: 1000,
      newMembers: 1,
    });
    expect(report.previous).toMatchObject({ revenue: 1000, orders: 1, units: 1, refundOrders: 0 });

    expect(report.trend).toEqual([
      { date: '2026-03-01', revenue: 0, orders: 0 },
      { date: '2026-03-02', revenue: 2000, orders: 1 },
      { date: '2026-03-03', revenue: 0, orders: 0 },
      { date: '2026-03-04', revenue: 1580, orders: 2 },
      { date: '2026-03-05', revenue: 0, orders: 0 },
      { date: '2026-03-06', revenue: 0, orders: 0 },
      { date: '2026-03-07', revenue: 0, orders: 0 },
    ]);

    // 商品實收已扣掉分攤的優惠（A：3,000 - 100）
    expect(report.byBrand).toEqual([
      { key: a.brandId, label: expect.any(String), revenue: 2900, units: 3 },
      { key: b.brandId, label: expect.any(String), revenue: 500, units: 1 },
    ]);
    expect(report.byCategory).toEqual([
      { key: a.categoryId, label: expect.stringMatching(/^分類/), revenue: 2900, units: 3 },
      { key: parent.id, label: '工作車', revenue: 500, units: 1 },
    ]);
    expect(report.bySaleType).toEqual([
      { saleType: 'REGULAR', revenue: 3400, units: 4 },
      { saleType: 'PRE_ORDER', revenue: 0, units: 0 },
      { saleType: 'LIMITED', revenue: 0, units: 0 },
    ]);
    expect(report.byShipping).toEqual(
      expect.arrayContaining([
        { method: 'HOME_DELIVERY', orders: 1, revenue: 620 },
        { method: 'CVS_711', orders: 2, revenue: 2960 },
        { method: 'CVS_FAMILY', orders: 0, revenue: 0 },
      ]),
    );
    expect(report.byTier).toEqual([
      { tier: 'ROOKIE', members: 1, customers: 1, revenue: 620 },
      { tier: 'DRIVER', members: 0, customers: 0, revenue: 0 },
      { tier: 'CHAMPION', members: 1, customers: 1, revenue: 2960 },
      { tier: 'LEGEND', members: 0, customers: 0, revenue: 0 },
    ]);
    expect(report.topProducts).toEqual([
      { productId: a.id, sku: a.sku, name: expect.any(String), revenue: 2900, units: 3 },
      { productId: b.id, sku: b.sku, name: expect.any(String), revenue: 500, units: 1 },
    ]);
    expect(report.coupons).toEqual([
      {
        couponId: expect.any(String),
        code: 'SAVE100',
        name: '折 100',
        orders: 1,
        discount: 100,
        revenue: 960,
      },
    ]);

    // 依週：03-01 是週日，屬於 02-23 那一週
    const weekly = await ctx
      .http()
      .get(`/v1/admin/reports/sales?${RANGE}&granularity=week`)
      .set(admin.auth)
      .expect(200);
    expect(weekly.body.trend).toEqual([
      { date: '2026-02-23', revenue: 0, orders: 0 },
      { date: '2026-03-02', revenue: 3580, orders: 3 },
    ]);
    const monthly = await ctx
      .http()
      .get('/v1/admin/reports/sales?from=2026-01-15&to=2026-03-31&granularity=month')
      .set(admin.auth)
      .expect(200);
    expect(monthly.body.trend).toEqual([
      { date: '2026-01-01', revenue: 0, orders: 0 },
      { date: '2026-02-01', revenue: 1000, orders: 1 },
      { date: '2026-03-01', revenue: 3580, orders: 3 },
    ]);
  });

  it('期間參數：迄日早於起日、期間過長、不存在的日期都回 400', async () => {
    const cases = [
      ['from=2026-03-08&to=2026-03-01', 'to'],
      ['from=2025-01-01&to=2026-03-01', 'from'],
      ['from=2026-02-30', 'from'],
      ['granularity=year', 'granularity'],
    ] as const;
    for (const [query, field] of cases) {
      const res = await ctx
        .http()
        .get(`/v1/admin/reports/sales?${query}`)
        .set(admin.auth)
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(field);
    }
    // 依月可以看較長的期間
    await ctx
      .http()
      .get('/v1/admin/reports/sales?from=2025-01-01&to=2026-03-01&granularity=month')
      .set(admin.auth)
      .expect(200);
  });

  it('訂單明細 CSV：依下單時間、台北時間格式、防公式注入，匯出會記到操作紀錄', async () => {
    const { o1, o2, o3, o4, o5 } = await seed();
    const res = await ctx
      .http()
      .get(`/v1/admin/reports/orders.csv?${RANGE}`)
      .set(admin.auth)
      .expect(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="orders_2026-03-01_2026-03-07.csv"',
    );
    const text = res.text;
    expect(text.startsWith('﻿訂單編號,下單時間,付款時間,狀態,會員 Email,收件人,')).toBe(true);
    const lines = text.trimEnd().split('\r\n');
    // 表頭 + o1～o5（o6 在 2 月下單）
    expect(lines).toHaveLength(6);
    expect(lines.slice(1).map((line) => line.split(',')[0])).toEqual(
      [o1, o2, o3, o4, o5].map((o) => o.orderNo),
    );
    const row2 = lines[2]!.split(',');
    expect(row2.slice(1, 4)).toEqual(['2026-03-04 00:50', '2026-03-04 01:00', '已付款']);
    expect(row2.slice(5, 12)).toEqual(['林小華', '宅配', '1', '500', '0', '120', '620']);
    expect(lines[4]).toContain(',已退款,');
    expect(lines[5]).toContain(`,待付款,`);
    expect(lines[5]).toContain(`,"'=HYPERLINK(""x"")",`);
    expect(lines[3]).toContain(',SAVE100,');

    const refunded = await ctx
      .http()
      .get(`/v1/admin/reports/orders.csv?${RANGE}&status=REFUNDED`)
      .set(admin.auth)
      .expect(200);
    expect(refunded.text.trimEnd().split('\r\n')).toHaveLength(2);
    expect(refunded.headers['content-disposition']).toContain('_refunded.csv');

    const log = await ctx.prisma.auditLog.findFirstOrThrow({
      where: { action: 'report.export_orders' },
      orderBy: { createdAt: 'asc' },
    });
    expect(log).toMatchObject({
      targetType: 'Report',
      targetLabel: 'orders_2026-03-01_2026-03-07.csv',
      changes: { from: '2026-03-01', to: '2026-03-07' },
    });
  });

  it('商品銷售 CSV 依商品加總；權限：訂單明細另外需要訂單檢視權限', async () => {
    const { a } = await seed();
    const products = await ctx
      .http()
      .get(`/v1/admin/reports/products.csv?${RANGE}`)
      .set(admin.auth)
      .expect(200);
    const lines = products.text.trimEnd().split('\r\n');
    expect(lines[0]).toBe(
      '﻿SKU,商品名稱,品牌,分類,銷售型態,售出件數,商品金額,優惠折抵,商品實收,目前庫存',
    );
    expect(lines).toHaveLength(3);
    const first = lines[1]!.split(',');
    expect(first[0]).toBe(a.sku);
    expect(first.slice(4, 9)).toEqual(['現貨', '3', '3000', '100', '2900']);

    const analyst = await createAdmin(ctx, ['report:read']);
    await ctx.http().get(`/v1/admin/reports/sales?${RANGE}`).set(analyst.auth).expect(200);
    await ctx.http().get(`/v1/admin/reports/products.csv`).set(analyst.auth).expect(200);
    await ctx.http().get(`/v1/admin/reports/orders.csv`).set(analyst.auth).expect(403);
    const staff = await createAdmin(ctx, ['order:read']);
    await ctx.http().get('/v1/admin/reports/sales').set(staff.auth).expect(403);
  });
});
