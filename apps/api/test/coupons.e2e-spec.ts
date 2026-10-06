import {
  createAdmin,
  createProduct,
  CVS_CHECKOUT,
  payWithMock,
  registerMember,
} from './fixtures.js';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

type Auth = Record<string, string>;

describe('優惠券 (e2e)', () => {
  let ctx: TestContext;
  let admin: { auth: Auth };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    admin = await createAdmin(ctx, ['marketing:write', 'order:read', 'order:write']);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const createCoupon = (body: Record<string, unknown>) =>
    ctx
      .http()
      .post('/v1/admin/coupons')
      .set(admin.auth)
      .send({ name: '測試優惠', type: 'FIXED', value: 100, ...body });

  const checkout = (auth: Auth, productId: string, quantity: number, couponCode?: string) =>
    ctx
      .http()
      .post('/v1/orders')
      .set(auth)
      .send({ ...CVS_CHECKOUT, items: [{ productId, quantity }], couponCode });

  const coupon = (code: string) => ctx.prisma.coupon.findUniqueOrThrow({ where: { code } });

  it('折抵商品並分攤到各列；運費依折扣後金額；每人限用一次', async () => {
    await createCoupon({ code: 'welcome100', minSubtotal: 1000 }).expect(201);
    const product = await createProduct(ctx.prisma, { price: 399, stock: 10 });
    const member = await registerMember(ctx);

    const preview = await ctx
      .http()
      .post('/v1/coupons/preview')
      .set(member.auth)
      .send({
        code: 'Welcome100',
        shippingMethod: 'CVS_711',
        items: [{ productId: product.id, quantity: 3 }],
      })
      .expect(200);
    // 3 × 399 = 1,197，折 100 → 1,097 仍達超商免運 1,000
    expect(preview.body).toEqual({
      code: 'WELCOME100',
      name: '測試優惠',
      type: 'FIXED',
      subtotal: 1197,
      discount: 100,
      shippingFee: 0,
      shippingDiscount: 0,
      total: 1097,
    });

    const order = await checkout(member.auth, product.id, 3, 'welcome100').expect(201);
    expect(order.body).toMatchObject({
      subtotal: 1197,
      discountTotal: 100,
      shippingFee: 0,
      total: 1097,
      couponCode: 'WELCOME100',
    });
    expect(order.body.items[0]).toMatchObject({ lineTotal: 1197, discount: 100 });
    expect(await coupon('WELCOME100')).toMatchObject({ usedCount: 1 });

    const again = await checkout(member.auth, product.id, 3, 'WELCOME100').expect(409);
    expect(again.body.error.code).toBe('COUPON_ALREADY_USED');

    // 付款金額與發票金額都是折扣後的金額
    await payWithMock(ctx, member, order.body.orderNo);
    const paid = await ctx.prisma.order.findUniqueOrThrow({
      where: { id: order.body.id },
      include: { invoice: true, payments: true },
    });
    expect(paid.status).toBe('PAID');
    expect(paid.invoice?.amount).toBe(1097);
    expect(paid.payments[0]?.amount).toBe(1097);
  });

  it('規則不符時回傳明確的錯誤代碼', async () => {
    const regular = await createProduct(ctx.prisma, { price: 500 });
    const limited = await createProduct(ctx.prisma, { price: 2000, saleType: 'LIMITED' });
    const member = await registerMember(ctx);
    await createCoupon({ code: 'MIN1000', minSubtotal: 1000 }).expect(201);
    await createCoupon({ code: 'VIPONLY', minTier: 'CHAMPION' }).expect(201);
    await createCoupon({ code: 'OFF', isActive: false }).expect(201);
    await createCoupon({ code: 'FREESHIP', type: 'FREE_SHIPPING', value: 0 }).expect(201);

    const preview = (code: string, productId: string, quantity = 1) =>
      ctx
        .http()
        .post('/v1/coupons/preview')
        .set(member.auth)
        .send({ code, shippingMethod: 'HOME_DELIVERY', items: [{ productId, quantity }] });

    const cases: [string, string, number, string][] = [
      ['NOPE', regular.id, 1, 'COUPON_NOT_FOUND'],
      ['MIN1000', regular.id, 1, 'COUPON_MIN_SUBTOTAL'],
      ['VIPONLY', regular.id, 1, 'COUPON_TIER_REQUIRED'],
      ['OFF', regular.id, 1, 'COUPON_UNAVAILABLE'],
      // 限量商品預設不適用
      ['MIN1000', limited.id, 1, 'COUPON_NOT_APPLICABLE'],
      // 宅配滿 1,500 已免運，不需要免運券
      ['FREESHIP', regular.id, 3, 'COUPON_NOT_APPLICABLE'],
    ];
    for (const [code, productId, quantity, expected] of cases) {
      const res = await preview(code, productId, quantity);
      expect([res.status, res.body.error?.code]).toEqual([
        expected === 'COUPON_NOT_FOUND' ? 404 : 400,
        expected,
      ]);
    }
    const details = await preview('MIN1000', regular.id);
    expect(details.body.error.details).toEqual({ minSubtotal: 1000, eligibleSubtotal: 500 });

    const freeShipping = await preview('FREESHIP', regular.id, 1).expect(200);
    expect(freeShipping.body).toMatchObject({ shippingFee: 0, shippingDiscount: 120, total: 500 });
    // 結帳失敗時不會扣庫存、不會留下訂單
    await checkout(member.auth, limited.id, 1, 'MIN1000').expect(400);
    expect(await ctx.prisma.order.count()).toBe(0);
  });

  it('總量上限：同時搶用也不會超發', async () => {
    await createCoupon({ code: 'FIRST3', usageLimit: 3 }).expect(201);
    const product = await createProduct(ctx.prisma, { price: 600, stock: 20 });
    const members = await Promise.all(Array.from({ length: 8 }, () => registerMember(ctx)));

    const results = await Promise.all(
      members.map((member) => checkout(member.auth, product.id, 1, 'FIRST3')),
    );
    const statuses = results.map((res) => res.status).sort();
    expect(statuses).toEqual([201, 201, 201, 409, 409, 409, 409, 409]);
    expect(
      results
        .filter((res) => res.status === 409)
        .every((res) => res.body.error.code === 'COUPON_USED_UP'),
    ).toBe(true);
    expect(await coupon('FIRST3')).toMatchObject({ usedCount: 3 });
    expect(await ctx.prisma.couponRedemption.count()).toBe(3);
    // 失敗的請求沒有扣到庫存
    expect((await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(
      17,
    );
  });

  it('未付款取消會退回使用次數；付款後退款不退回', async () => {
    await createCoupon({ code: 'ONCE', perMemberLimit: 1 }).expect(201);
    const product = await createProduct(ctx.prisma, { price: 800, stock: 10 });
    const member = await registerMember(ctx);

    const first = await checkout(member.auth, product.id, 1, 'ONCE').expect(201);
    await ctx.http().post(`/v1/orders/${first.body.orderNo}/cancel`).set(member.auth).expect(200);
    expect(await coupon('ONCE')).toMatchObject({ usedCount: 0 });
    const released = await ctx.prisma.couponRedemption.findUniqueOrThrow({
      where: { orderId: first.body.id },
    });
    expect(released.releasedAt).not.toBeNull();

    const second = await checkout(member.auth, product.id, 1, 'ONCE').expect(201);
    await payWithMock(ctx, member, second.body.orderNo);
    await ctx
      .http()
      .post(`/v1/admin/orders/${second.body.id}/status`)
      .set(admin.auth)
      .send({ status: 'REFUNDED' })
      .expect(201);
    expect(await coupon('ONCE')).toMatchObject({ usedCount: 1 });
    const third = await checkout(member.auth, product.id, 1, 'ONCE').expect(409);
    expect(third.body.error.code).toBe('COUPON_ALREADY_USED');
  });

  it('後台：驗證面額、優惠碼不重複、上限不低於已使用、用過的不能刪除、依狀態篩選', async () => {
    const percent = await createCoupon({ code: 'pct95', type: 'PERCENT', value: 95 }).expect(400);
    expect(percent.body.error.details).toEqual([
      { field: 'value', messages: ['百分比折扣需介於 1～90'] },
    ]);
    const created = await createCoupon({
      code: 'autumn-15',
      type: 'PERCENT',
      value: 15,
      maxDiscount: 300,
      usageLimit: 10,
    }).expect(201);
    expect(created.body).toMatchObject({
      code: 'AUTUMN-15',
      state: 'ACTIVE',
      usedCount: 0,
      totalDiscount: 0,
    });
    const duplicate = await createCoupon({ code: 'AUTUMN-15' }).expect(409);
    expect(duplicate.body.error.code).toBe('COUPON_CODE_TAKEN');
    await createCoupon({
      code: 'LATER',
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
    }).expect(201);

    const product = await createProduct(ctx.prisma, { price: 1000 });
    const member = await registerMember(ctx);
    await checkout(member.auth, product.id, 2, 'autumn-15').expect(201);

    const detail = await ctx
      .http()
      .get(`/v1/admin/coupons/${created.body.id}`)
      .set(admin.auth)
      .expect(200);
    expect(detail.body).toMatchObject({ usedCount: 1, totalDiscount: 300 });
    expect(detail.body.redemptions).toHaveLength(1);
    expect(detail.body.redemptions[0]).toMatchObject({ amount: 300, releasedAt: null });

    await ctx
      .http()
      .patch(`/v1/admin/coupons/${created.body.id}`)
      .set(admin.auth)
      .send({ usageLimit: 0 })
      .expect(400);
    const inUse = await ctx
      .http()
      .delete(`/v1/admin/coupons/${created.body.id}`)
      .set(admin.auth)
      .expect(409);
    expect(inUse.body.error.code).toBe('COUPON_IN_USE');
    await ctx
      .http()
      .patch(`/v1/admin/coupons/${created.body.id}`)
      .set(admin.auth)
      .send({ isActive: false })
      .expect(200);

    const states = async (state: string) =>
      (
        await ctx.http().get(`/v1/admin/coupons?state=${state}`).set(admin.auth).expect(200)
      ).body.data.map((c: { code: string }) => c.code);
    expect(await states('DISABLED')).toEqual(['AUTUMN-15']);
    expect(await states('SCHEDULED')).toEqual(['LATER']);
    expect(await states('ACTIVE')).toEqual([]);

    const staff = await createAdmin(ctx, ['order:read']);
    await ctx.http().get('/v1/admin/coupons').set(staff.auth).expect(403);
  });
});
