import {
  createAdmin,
  createCatalogBasics,
  createProduct,
  CVS_CHECKOUT,
  registerMember,
} from './fixtures.js';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

describe('後台 (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  async function paidOrder(quantity = 1) {
    const product = await createProduct(ctx.prisma, { price: 1000, stock: 10 });
    const member = await registerMember(ctx);
    const order = await ctx
      .http()
      .post('/v1/orders')
      .set(member.auth)
      .send({ ...CVS_CHECKOUT, items: [{ productId: product.id, quantity }] })
      .expect(201);
    const start = await ctx
      .http()
      .post(`/v1/orders/${order.body.orderNo}/payments`)
      .set(member.auth)
      .send({})
      .expect(201);
    await ctx
      .http()
      .post(`/v1/payments/mock/${start.body.merchantTradeNo}/complete`)
      .type('form')
      .send({ result: 'success' })
      .expect(303);
    return { product, member, order: order.body };
  }

  it('後台登入後可取得自己的角色與權限', async () => {
    const admin = await createAdmin(ctx, ['order:read']);
    const res = await ctx.http().get('/v1/admin/auth/me').set(admin.auth).expect(200);
    expect(res.body.role.permissions).toEqual(['order:read']);
  });

  it('權限不足時回傳 403；停用帳號立即無法使用', async () => {
    const support = await createAdmin(ctx, ['product:read', 'order:read'], 'cs@example.com');
    const { brand, category } = await createCatalogBasics(ctx.prisma);
    const res = await ctx
      .http()
      .post('/v1/admin/products')
      .set(support.auth)
      .send({
        slug: 'x',
        sku: 'X-1',
        brandId: brand.id,
        categoryId: category.id,
        scale: '1:64',
        price: 100,
        stock: 1,
        status: 'ACTIVE',
        saleType: 'REGULAR',
        translations: [{ locale: 'zh-TW', name: 'X', description: 'x' }],
      })
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');

    await ctx.prisma.adminUser.update({
      where: { email: 'cs@example.com' },
      data: { isActive: false },
    });
    await ctx.http().get('/v1/admin/products').set(support.auth).expect(401);
  });

  it('建立商品（含翻譯與初始庫存）、調整庫存並留下異動紀錄', async () => {
    const admin = await createAdmin(ctx);
    const { brand, category } = await createCatalogBasics(ctx.prisma);

    const created = await ctx
      .http()
      .post('/v1/admin/products')
      .set(admin.auth)
      .send({
        slug: 'new-car',
        sku: 'NEW-001',
        brandId: brand.id,
        categoryId: category.id,
        scale: '1:64',
        price: 480,
        stock: 20,
        status: 'ACTIVE',
        saleType: 'LIMITED',
        releaseAt: new Date(Date.now() + 86_400_000).toISOString(),
        purchaseLimit: 2,
        translations: [
          { locale: 'zh-TW', name: '新車', description: '描述' },
          { locale: 'en', name: 'New Car', description: 'Description' },
        ],
        images: [{ url: '/static/products/new-car.svg' }],
      })
      .expect(201);
    expect(created.body).toMatchObject({ stock: 20, availability: 'COMING_SOON', soldCount: 0 });
    expect(created.body.images[0].url).toBe('http://api.test/static/products/new-car.svg');

    const adjusted = await ctx
      .http()
      .post(`/v1/admin/products/${created.body.id}/stock`)
      .set(admin.auth)
      .send({ delta: -5, note: '盤點損壞' })
      .expect(200);
    expect(adjusted.body.stock).toBe(15);

    await ctx
      .http()
      .post(`/v1/admin/products/${created.body.id}/stock`)
      .set(admin.auth)
      .send({ delta: -100 })
      .expect(400);

    const movements = await ctx
      .http()
      .get(`/v1/admin/products/${created.body.id}/stock-movements`)
      .set(admin.auth)
      .expect(200);
    expect(movements.body.map((m: { delta: number }) => m.delta)).toEqual([-5, 20]);
  });

  it('建立商品時缺少繁中內容或限量商品沒有開賣時間會被拒絕', async () => {
    const admin = await createAdmin(ctx);
    const { brand, category } = await createCatalogBasics(ctx.prisma);
    const base = {
      slug: 'bad',
      sku: 'BAD-1',
      brandId: brand.id,
      categoryId: category.id,
      scale: '1:64',
      price: 1,
      stock: 0,
      status: 'DRAFT',
    };
    const noZh = await ctx
      .http()
      .post('/v1/admin/products')
      .set(admin.auth)
      .send({
        ...base,
        saleType: 'REGULAR',
        translations: [{ locale: 'en', name: 'X', description: 'x' }],
      })
      .expect(400);
    expect(noZh.body.error.code).toBe('VALIDATION_FAILED');

    const noRelease = await ctx
      .http()
      .post('/v1/admin/products')
      .set(admin.auth)
      .send({
        ...base,
        saleType: 'LIMITED',
        translations: [{ locale: 'zh-TW', name: 'X', description: 'x' }],
      })
      .expect(400);
    expect(noRelease.body.error.details[0].field).toBe('releaseAt');
  });

  it('訂單出貨流程：已付款 → 處理中 → 已出貨 → 已完成，不能跳過或倒退', async () => {
    const admin = await createAdmin(ctx);
    const { order } = await paidOrder();

    const detail = await ctx.http().get(`/v1/admin/orders/${order.id}`).set(admin.auth).expect(200);
    expect(detail.body.status).toBe('PAID');
    expect(detail.body.nextStatuses).toEqual(['PROCESSING', 'REFUNDED']);

    const skip = await ctx
      .http()
      .post(`/v1/admin/orders/${order.id}/status`)
      .set(admin.auth)
      .send({ status: 'COMPLETED' })
      .expect(409);
    expect(skip.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    for (const status of ['PROCESSING', 'SHIPPED', 'COMPLETED']) {
      await ctx
        .http()
        .post(`/v1/admin/orders/${order.id}/status`)
        .set(admin.auth)
        .send({ status, note: status === 'SHIPPED' ? '7-11 取貨編號 A123' : undefined })
        .expect(201);
    }
    const done = await ctx.http().get(`/v1/admin/orders/${order.id}`).set(admin.auth).expect(200);
    expect(done.body.status).toBe('COMPLETED');
    expect(done.body.events.map((e: { toStatus: string }) => e.toStatus)).toEqual([
      'PENDING_PAYMENT',
      'PAID',
      'PROCESSING',
      'SHIPPED',
      'COMPLETED',
    ]);
  });

  it('退款會釋放庫存並扣回會員累計消費；不能手動改成已付款', async () => {
    const admin = await createAdmin(ctx);
    const { order, product, member } = await paidOrder(2);
    expect((await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(
      8,
    );

    await ctx
      .http()
      .post(`/v1/admin/orders/${order.id}/status`)
      .set(admin.auth)
      .send({ status: 'REFUNDED', note: '客戶要求取消' })
      .expect(201);
    expect((await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(
      10,
    );
    expect(
      (await ctx.prisma.member.findUniqueOrThrow({ where: { id: member.id } })).totalSpent,
    ).toBe(0);

    const another = await registerMember(ctx);
    const pending = await ctx
      .http()
      .post('/v1/orders')
      .set(another.auth)
      .send({ ...CVS_CHECKOUT, items: [{ productId: product.id, quantity: 1 }] })
      .expect(201);
    await ctx
      .http()
      .post(`/v1/admin/orders/${pending.body.id}/status`)
      .set(admin.auth)
      .send({ status: 'PAID' })
      .expect(400);
  });

  it('儀表板統計今日營收、待出貨與熱銷商品', async () => {
    const admin = await createAdmin(ctx);
    await paidOrder(2);
    const res = await ctx.http().get('/v1/admin/dashboard').set(admin.auth).expect(200);
    expect(res.body.kpis).toMatchObject({ todayRevenue: 2000, todayOrders: 1, toShipCount: 1 });
    expect(res.body.salesTrend).toHaveLength(14);
    expect(res.body.salesTrend.at(-1).revenue).toBe(2000);
    expect(res.body.topProducts[0]).toMatchObject({ quantity: 2, revenue: 2000 });
  });

  it('停權會員後，該會員的 refresh token 立即失效', async () => {
    const admin = await createAdmin(ctx);
    const res = await ctx
      .http()
      .post('/v1/auth/register')
      .send({ email: 'bad@example.com', password: 'Sup3r-secret', name: '測試' })
      .expect(201);

    await ctx
      .http()
      .patch(`/v1/admin/members/${res.body.member.id}/status`)
      .set(admin.auth)
      .send({ status: 'SUSPENDED' })
      .expect(200);

    const refresh = await ctx
      .http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: res.body.tokens.refreshToken })
      .expect(403);
    expect(refresh.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});
