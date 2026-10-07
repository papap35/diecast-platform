import { createAdmin, placePaidOrder } from './fixtures.js';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

type Auth = Record<string, string>;

describe('後台會員車庫 (e2e)', () => {
  let ctx: TestContext;
  let admin: { auth: Auth };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    admin = await createAdmin(ctx, ['member:read', 'member:write']);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  /** 一台訂單入庫的收藏（另外登錄購入價與備註）＋一台手動登錄，並公開車庫 */
  const seed = async () => {
    const { member, order, product } = await placePaidOrder(ctx, { price: 1200 });
    const orderItem = await ctx.prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    await ctx.prisma.garageItem.create({
      data: {
        memberId: member.id,
        productId: product.id,
        orderItemId: orderItem.id,
        name: orderItem.name,
        brandName: 'Brand A',
        scale: '1:64',
        pricePaid: 1200,
        note: '生日禮物',
        isFavorite: true,
      },
    });
    await ctx
      .http()
      .post('/v1/me/garage')
      .set(member.auth)
      .send({
        name: '老爸留下的 1:43 金龜車',
        brandName: 'Other',
        scale: '1:43',
        quantity: 2,
        pricePaid: 800,
        note: '不賣',
      })
      .expect(201);
    await ctx
      .http()
      .put('/v1/me/garage/settings')
      .set(member.auth)
      .send({ public: true, handle: 'beetle-dad' })
      .expect(200);
    return { member, order };
  };

  it('檢視會員收藏：不含購入價與備註，訂單入庫的收藏帶出來源訂單', async () => {
    const { member, order } = await seed();
    const res = await ctx
      .http()
      .get(`/v1/admin/members/${member.id}/garage`)
      .set(admin.auth)
      .expect(200);
    expect(res.body.settings).toEqual({ public: true, handle: 'beetle-dad' });
    expect(res.body.stats).toMatchObject({ models: 2, cars: 3 });
    const [favorite, manual] = res.body.items;
    expect(favorite).toMatchObject({
      source: 'ORDER',
      isFavorite: true,
      order: { id: order.id, orderNo: order.orderNo },
    });
    expect(manual).toMatchObject({
      source: 'MANUAL',
      name: '老爸留下的 1:43 金龜車',
      quantity: 2,
      order: null,
    });
    for (const item of res.body.items) {
      expect(item).not.toHaveProperty('pricePaid');
      expect(item).not.toHaveProperty('note');
    }

    const list = await ctx
      .http()
      .get('/v1/admin/members?garage=public')
      .set(admin.auth)
      .expect(200);
    expect(list.body.data.map((m: { id: string }) => m.id)).toEqual([member.id]);
    expect(list.body.data[0].garagePublic).toBe(true);
    await ctx
      .http()
      .get('/v1/admin/members/00000000-0000-7000-8000-000000000000/garage')
      .set(admin.auth)
      .expect(404);
  });

  it('把不當的公開車庫設為不公開；只有會員管理權限可以操作', async () => {
    const { member } = await seed();
    await ctx.http().get('/v1/garages/beetle-dad').expect(200);

    const viewer = await createAdmin(ctx, ['member:read']);
    await ctx.http().get(`/v1/admin/members/${member.id}/garage`).set(viewer.auth).expect(200);
    await ctx
      .http()
      .post(`/v1/admin/members/${member.id}/garage/hide`)
      .set(viewer.auth)
      .expect(403);

    const hidden = await ctx
      .http()
      .post(`/v1/admin/members/${member.id}/garage/hide`)
      .set(admin.auth)
      .expect(200);
    expect(hidden.body).toEqual({ public: false, handle: 'beetle-dad' });
    await ctx.http().get('/v1/garages/beetle-dad').expect(404);

    const log = await ctx.prisma.auditLog.findFirstOrThrow({
      where: { action: 'member.garage_hide' },
    });
    expect(log).toMatchObject({ targetType: 'Member', targetId: member.id });
  });
});
