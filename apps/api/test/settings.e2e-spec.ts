import { SettingsService } from '../src/modules/settings/settings.service.js';
import { createAdmin, createProduct, CVS_CHECKOUT, registerMember } from './fixtures.js';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

type Auth = Record<string, string>;

const DEFAULTS = {
  homeDeliveryFee: 120,
  homeFreeShippingThreshold: 1500,
  cvsFee: 60,
  cvsFreeShippingThreshold: 1000,
  paymentTimeoutMinutes: 30,
  limitedPaymentTimeoutMinutes: 10,
};

describe('系統設定 (e2e)', () => {
  let ctx: TestContext;
  let admin: { auth: Auth };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    // 設定有快取，清空資料表後也要把快取換回預設值
    await ctx.app.get(SettingsService).update(DEFAULTS);
    admin = await createAdmin(ctx, ['settings:write']);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const save = (body: Record<string, unknown>) =>
    ctx
      .http()
      .put('/v1/admin/settings')
      .set(admin.auth)
      .send({ ...DEFAULTS, ...body });

  it('修改運費與付款期限後，購物車、結帳與會員等級權益立即套用，並記到操作紀錄', async () => {
    const before = await ctx.http().get('/v1/settings').expect(200);
    expect(before.body).toMatchObject(DEFAULTS);

    const saved = await save({
      cvsFee: 80,
      cvsFreeShippingThreshold: 1200,
      paymentTimeoutMinutes: 45,
    }).expect(200);
    expect(saved.body).toMatchObject({ cvsFee: 80, cvsFreeShippingThreshold: 1200 });
    expect((await ctx.http().get('/v1/settings').expect(200)).body).toMatchObject({
      cvsFee: 80,
      paymentTimeoutMinutes: 45,
    });

    const product = await createProduct(ctx.prisma, { price: 1000 });
    const member = await registerMember(ctx);
    const cart = await ctx
      .http()
      .put(`/v1/cart/items/${product.id}`)
      .set(member.auth)
      .send({ quantity: 1 })
      .expect(200);
    const options = Object.fromEntries(
      cart.body.shippingOptions.map((o: { method: string }) => [o.method, o]),
    );
    // 1,000 未達新的超商門檻 1,200；宅配維持原設定
    expect(options.CVS_711).toEqual({ method: 'CVS_711', fee: 80, freeThreshold: 1200 });
    expect(options.CVS_FAMILY).toMatchObject({ fee: 80, freeThreshold: 1200 });
    expect(options.HOME_DELIVERY).toEqual({
      method: 'HOME_DELIVERY',
      fee: 120,
      freeThreshold: 1500,
    });

    const startedAt = Date.now();
    const order = await ctx
      .http()
      .post('/v1/orders')
      .set(member.auth)
      .send(CVS_CHECKOUT)
      .expect(201);
    expect(order.body).toMatchObject({ subtotal: 1000, shippingFee: 80, total: 1080 });
    const deadline = new Date(order.body.paymentDeadline).getTime();
    expect(deadline - startedAt).toBeGreaterThan(44 * 60_000);
    expect(deadline - startedAt).toBeLessThan(46 * 60_000);

    // 冠軍車手的免運門檻是一般門檻的六折
    const membership = await ctx.http().get('/v1/me/membership').set(member.auth).expect(200);
    const champion = membership.body.tiers.find((t: { tier: string }) => t.tier === 'CHAMPION');
    expect(champion).toMatchObject({ cvsFreeShipping: 720, homeFreeShipping: 900 });

    const log = await ctx.prisma.auditLog.findFirstOrThrow({
      where: { action: 'settings.update' },
    });
    expect(log).toMatchObject({
      targetType: 'Setting',
      changes: expect.objectContaining({ cvsFee: 80 }),
    });
  });

  it('數值範圍與限量付款期限檢查；只有系統設定權限可以修改', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ cvsFee: -1 }, 'cvsFee'],
      [{ homeDeliveryFee: 12.5 }, 'homeDeliveryFee'],
      [{ paymentTimeoutMinutes: 5 }, 'paymentTimeoutMinutes'],
      [
        { paymentTimeoutMinutes: 20, limitedPaymentTimeoutMinutes: 30 },
        'limitedPaymentTimeoutMinutes',
      ],
    ];
    for (const [body, field] of cases) {
      const res = await save(body).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(field);
    }
    const { cvsFee: _omitted, ...missing } = DEFAULTS;
    await ctx.http().put('/v1/admin/settings').set(admin.auth).send(missing).expect(400);

    const staff = await createAdmin(ctx, ['order:read', 'report:read']);
    await ctx.http().get('/v1/admin/settings').set(staff.auth).expect(403);
    await ctx.http().put('/v1/admin/settings').set(staff.auth).send(DEFAULTS).expect(403);
    expect((await ctx.http().get('/v1/settings').expect(200)).body).toMatchObject(DEFAULTS);
  });
});
