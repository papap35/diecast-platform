import { EmailOutboxService } from '../src/modules/notifications/email-outbox.service.js';
import { RemindersService } from '../src/modules/reminders/reminders.service.js';
import { WishlistService } from '../src/modules/wishlist/wishlist.service.js';
import {
  createAdmin,
  createProduct,
  CVS_CHECKOUT,
  payWithMock,
  placePaidOrder,
  registerMember,
} from './fixtures.js';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

type Auth = Record<string, string>;
const MINUTE = 60_000;

describe('收藏玩家功能 (e2e)', () => {
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

  const order = (auth: Auth, productId: string, quantity = 1, extra = {}) =>
    ctx
      .http()
      .post('/v1/orders')
      .set(auth)
      .send({ ...CVS_CHECKOUT, items: [{ productId, quantity }], ...extra });

  const notifications = async (auth: Auth) =>
    (await ctx.http().get('/v1/me/notifications').set(auth).expect(200)).body;

  const setTier = (memberId: string, tier: string, totalSpent: number) =>
    ctx.prisma.member.update({
      where: { id: memberId },
      data: { tier: tier as never, totalSpent },
    });

  describe('會員等級', () => {
    it('累計消費達門檻自動升級並通知；退款扣回消費後降級', async () => {
      const admin = await createAdmin(ctx);
      const { member, order: placed } = await placePaidOrder(ctx, { price: 3000 });

      const membership = await ctx.http().get('/v1/me/membership').set(member.auth).expect(200);
      expect(membership.body).toMatchObject({
        tier: 'DRIVER',
        totalSpent: 3000,
        next: { tier: 'CHAMPION', threshold: 8000, remaining: 5000 },
      });
      expect(membership.body.tiers.map((t: { tier: string }) => t.tier)).toEqual([
        'ROOKIE',
        'DRIVER',
        'CHAMPION',
        'LEGEND',
      ]);

      const inbox = await notifications(member.auth);
      const types = inbox.data.map((n: { type: string }) => n.type);
      expect(types.sort()).toEqual(['ORDER_PAID', 'TIER_UPGRADED']);
      const upgraded = inbox.data.find((n: { type: string }) => n.type === 'TIER_UPGRADED');
      expect(upgraded.title).toBe('恭喜升級為正式車手');
      expect(upgraded.link).toBe('/account');
      expect(inbox.unreadCount).toBe(2);
      expect(await ctx.prisma.emailMessage.count({ where: { status: 'PENDING' } })).toBe(2);

      await ctx
        .http()
        .post(`/v1/admin/orders/${placed.id}/status`)
        .set(admin.auth)
        .send({ status: 'REFUNDED' })
        .expect(201);
      const after = await ctx.http().get('/v1/me').set(member.auth).expect(200);
      expect(after.body.tier).toBe('ROOKIE');
      const latest = await notifications(member.auth);
      expect(latest.data[0].type).toBe('ORDER_REFUNDED');
      expect(latest.data.map((n: { type: string }) => n.type)).not.toContain('TIER_DOWNGRADED');
    });

    it('通知可標示已讀；Email 外寄匣由排程寄出', async () => {
      const { member } = await placePaidOrder(ctx);
      const read = await ctx
        .http()
        .post('/v1/me/notifications/read')
        .set(member.auth)
        .send({})
        .expect(200);
      expect(read.body.updated).toBe(1);
      const count = await ctx
        .http()
        .get('/v1/me/notifications/unread-count')
        .set(member.auth)
        .expect(200);
      expect(count.body.count).toBe(0);

      expect(await ctx.app.get(EmailOutboxService).sendPending()).toBe(1);
      const email = await ctx.prisma.emailMessage.findFirstOrThrow();
      expect(email).toMatchObject({ status: 'SENT', subject: '[Paddock 64] 付款成功' });
      expect(email.text).toContain('http://web.test/zh-TW/account/orders/');
    });

    it('優先購：等級達標的會員可提前購買，其他人仍要等開賣', async () => {
      const product = await createProduct(ctx.prisma, {
        saleType: 'LIMITED',
        releaseAt: new Date(Date.now() + 60 * MINUTE),
        stock: 20,
      });
      await ctx.prisma.product.update({
        where: { id: product.id },
        data: { earlyAccessTier: 'DRIVER', earlyAccessAt: new Date(Date.now() - MINUTE) },
      });
      const rookie = await registerMember(ctx);
      const driver = await registerMember(ctx);
      await setTier(driver.id, 'DRIVER', 3000);

      const anonymous = await ctx.http().get(`/v1/products/${product.slug}`).expect(200);
      expect(anonymous.body).toMatchObject({
        availability: 'COMING_SOON',
        earlyAccessTier: 'DRIVER',
      });
      const asRookie = await ctx.http().get(`/v1/products/${product.slug}`).set(rookie.auth);
      expect(asRookie.body.availability).toBe('COMING_SOON');
      const asDriver = await ctx.http().get(`/v1/products/${product.slug}`).set(driver.auth);
      expect(asDriver.body.availability).toBe('IN_STOCK');

      const denied = await order(rookie.auth, product.id).expect(409);
      expect(denied.body.error.code).toBe('NOT_RELEASED_YET');
      await order(driver.auth, product.id).expect(201);
    });

    it('冠軍車手免運門檻打六折、傳奇車手全站免運', async () => {
      const product = await createProduct(ctx.prisma, { price: 700 });
      const quote = async (auth: Auth) =>
        (
          await ctx
            .http()
            .post('/v1/cart/quote')
            .set(auth)
            .send({ items: [{ productId: product.id, quantity: 1 }] })
            .expect(200)
        ).body.shippingOptions as { method: string; fee: number; freeThreshold: number }[];
      const member = await registerMember(ctx);
      expect((await quote(member.auth)).find((o) => o.method === 'CVS_711')).toMatchObject({
        fee: 60,
        freeThreshold: 1000,
      });
      await setTier(member.id, 'CHAMPION', 8000);
      expect((await quote(member.auth)).find((o) => o.method === 'CVS_711')).toMatchObject({
        fee: 0,
        freeThreshold: 600,
      });
      await setTier(member.id, 'LEGEND', 20000);
      expect((await quote(member.auth)).every((o) => o.fee === 0)).toBe(true);

      const created = await order(member.auth, product.id).expect(201);
      expect(created.body.shippingFee).toBe(0);
    });
  });

  describe('會員狀態', () => {
    it('一次回傳等級、購物車件數、未讀通知、願望清單與尚未開賣的提醒', async () => {
      const regular = await createProduct(ctx.prisma);
      const upcoming = await createProduct(ctx.prisma, {
        saleType: 'LIMITED',
        releaseAt: new Date(Date.now() + 60 * MINUTE),
      });
      const released = await createProduct(ctx.prisma, {
        saleType: 'LIMITED',
        releaseAt: new Date(Date.now() + 60 * MINUTE),
      });
      const member = await registerMember(ctx);
      await setTier(member.id, 'CHAMPION', 8000);
      await ctx
        .http()
        .put(`/v1/cart/items/${regular.id}`)
        .set(member.auth)
        .send({ quantity: 3 })
        .expect(200);
      await ctx.http().put(`/v1/me/wishlist/${regular.id}`).set(member.auth).expect(204);
      for (const product of [upcoming, released]) {
        await ctx.http().put(`/v1/me/reminders/${product.id}`).set(member.auth).expect(204);
      }
      // 已經開賣的商品不再列在提醒裡
      await ctx.prisma.product.update({
        where: { id: released.id },
        data: { releaseAt: new Date(Date.now() - MINUTE) },
      });
      await ctx.prisma.notification.createMany({
        data: [
          { memberId: member.id, type: 'TIER_UPGRADED', title: '升級', body: '恭喜' },
          {
            memberId: member.id,
            type: 'ORDER_PAID',
            title: '付款',
            body: '完成',
            readAt: new Date(),
          },
        ],
      });

      const state = await ctx.http().get('/v1/me/state').set(member.auth).expect(200);
      expect(state.body).toEqual({
        tier: 'CHAMPION',
        cartCount: 3,
        unreadNotifications: 1,
        wishlistIds: [regular.id],
        reminderIds: [upcoming.id],
      });
      await ctx.http().get('/v1/me/state').expect(401);
    });

    it('後台會員列表可依等級篩選', async () => {
      const admin = await createAdmin(ctx);
      await registerMember(ctx);
      const legend = await registerMember(ctx);
      await setTier(legend.id, 'LEGEND', 20000);

      const res = await ctx.http().get('/v1/admin/members?tier=LEGEND').set(admin.auth).expect(200);
      expect(res.body.data).toEqual([expect.objectContaining({ id: legend.id, tier: 'LEGEND' })]);
      await ctx.http().get('/v1/admin/members?tier=GOLD').set(admin.auth).expect(400);
    });
  });

  describe('限量發售與預購', () => {
    it('限量閘門：售完的請求直接拒絕；取消訂單釋出名額後可以再買', async () => {
      const product = await createProduct(ctx.prisma, {
        saleType: 'LIMITED',
        releaseAt: new Date(Date.now() - MINUTE),
        stock: 1,
      });
      const first = await registerMember(ctx);
      const second = await registerMember(ctx);
      const placed = await order(first.auth, product.id).expect(201);
      const soldOut = await order(second.auth, product.id).expect(409);
      expect(soldOut.body.error.code).toBe('OUT_OF_STOCK');

      await ctx.http().post(`/v1/orders/${placed.body.orderNo}/cancel`).set(first.auth).expect(200);
      await order(second.auth, product.id).expect(201);
    });

    it('同一會員結帳太頻繁時回應 429', async () => {
      const product = await createProduct(ctx.prisma, { stock: 100 });
      const member = await registerMember(ctx);
      const results = await Promise.all(
        Array.from({ length: 12 }, () => order(member.auth, product.id)),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(10);
      const limited = results.filter((r) => r.status === 429);
      expect(limited).toHaveLength(2);
      expect(limited[0]!.body.error.code).toBe('RATE_LIMITED');
    });

    it('預購商品需與現貨分開結帳；預購訂單帶預計出貨時間', async () => {
      const shipAt = new Date('2027-03-01T00:00:00Z');
      const preorder = await createProduct(ctx.prisma, {
        saleType: 'PRE_ORDER',
        releaseAt: new Date(Date.now() - MINUTE),
        stock: 20,
      });
      await ctx.prisma.product.update({
        where: { id: preorder.id },
        data: { expectedShipAt: shipAt },
      });
      const regular = await createProduct(ctx.prisma);
      const member = await registerMember(ctx);

      const items = [
        { productId: preorder.id, quantity: 1 },
        { productId: regular.id, quantity: 1 },
      ];
      const quote = await ctx.http().post('/v1/cart/quote').set(member.auth).send({ items });
      expect(quote.body).toMatchObject({ preorderMixed: true, hasIssues: true });
      const mixed = await ctx
        .http()
        .post('/v1/orders')
        .set(member.auth)
        .send({ ...CVS_CHECKOUT, items })
        .expect(400);
      expect(mixed.body.error.code).toBe('PREORDER_SEPARATE_CHECKOUT');

      const alone = await order(member.auth, preorder.id).expect(201);
      expect(new Date(alone.body.expectedShipAt).toISOString()).toBe(shipAt.toISOString());
      const plain = await order(member.auth, regular.id).expect(201);
      expect(plain.body.expectedShipAt).toBeNull();
    });
  });

  describe('願望清單與發售提醒', () => {
    it('售完時加入願望清單，補貨後通知一次；有貨時加入的不通知', async () => {
      const admin = await createAdmin(ctx);
      const soldOut = await createProduct(ctx.prisma, { stock: 0 });
      const inStock = await createProduct(ctx.prisma, { stock: 3 });
      const member = await registerMember(ctx);
      for (const product of [soldOut, inStock]) {
        await ctx.http().put(`/v1/me/wishlist/${product.id}`).set(member.auth).expect(204);
      }
      await ctx.http().put(`/v1/me/wishlist/${soldOut.id}`).set(member.auth).expect(204);
      const ids = await ctx.http().get('/v1/me/wishlist/ids').set(member.auth).expect(200);
      expect(ids.body.ids).toHaveLength(2);
      const list = await ctx.http().get('/v1/me/wishlist').set(member.auth).expect(200);
      expect(list.body.data.map((i: { product: { id: string } }) => i.product.id)).toEqual([
        inStock.id,
        soldOut.id,
      ]);

      const wishlist = ctx.app.get(WishlistService);
      expect(await wishlist.notifyRestocks()).toBe(0);
      for (const product of [soldOut, inStock]) {
        await ctx
          .http()
          .post(`/v1/admin/products/${product.id}/stock`)
          .set(admin.auth)
          .send({ delta: 5, note: '到貨' })
          .expect(200);
      }
      expect(await wishlist.notifyRestocks()).toBe(1);
      expect(await wishlist.notifyRestocks()).toBe(0);
      const inbox = await notifications(member.auth);
      expect(inbox.data).toHaveLength(1);
      expect(inbox.data[0]).toMatchObject({
        type: 'WISHLIST_RESTOCK',
        link: `/products/${soldOut.slug}`,
      });

      await ctx.http().delete(`/v1/me/wishlist/${soldOut.id}`).set(member.auth).expect(204);
      const remaining = await ctx.http().get('/v1/me/wishlist/ids').set(member.auth);
      expect(remaining.body.ids).toEqual([inStock.id]);
    });

    it('發售提醒：開賣前 15 分鐘通知；符合優先購資格者依優先購時間提醒', async () => {
      const reminders = ctx.app.get(RemindersService);
      const soon = await createProduct(ctx.prisma, {
        saleType: 'LIMITED',
        releaseAt: new Date(Date.now() + 10 * MINUTE),
      });
      const later = await createProduct(ctx.prisma, {
        saleType: 'LIMITED',
        releaseAt: new Date(Date.now() + 120 * MINUTE),
      });
      await ctx.prisma.product.update({
        where: { id: later.id },
        data: { earlyAccessTier: 'DRIVER', earlyAccessAt: new Date(Date.now() + 5 * MINUTE) },
      });
      const released = await createProduct(ctx.prisma, {
        releaseAt: new Date(Date.now() - MINUTE),
      });

      const rookie = await registerMember(ctx);
      const driver = await registerMember(ctx);
      await setTier(driver.id, 'DRIVER', 3000);
      for (const member of [rookie, driver]) {
        for (const product of [soon, later]) {
          await ctx.http().put(`/v1/me/reminders/${product.id}`).set(member.auth).expect(204);
        }
      }
      const notAllowed = await ctx
        .http()
        .put(`/v1/me/reminders/${released.id}`)
        .set(rookie.auth)
        .expect(409);
      expect(notAllowed.body.error.code).toBe('REMINDER_NOT_AVAILABLE');

      // 兩人都收到 soon；只有正式車手收到 later 的優先購提醒
      expect(await reminders.sendDue()).toBe(3);
      expect(await reminders.sendDue()).toBe(0);
      const rookieInbox = await notifications(rookie.auth);
      expect(rookieInbox.data).toHaveLength(1);
      const driverInbox = await notifications(driver.auth);
      expect(driverInbox.data).toHaveLength(2);
      expect(
        driverInbox.data.some((n: { body: string }) => n.body.includes('正式車手優先購')),
      ).toBe(true);

      const mine = await ctx.http().get('/v1/me/reminders').set(rookie.auth).expect(200);
      expect(mine.body.data.map((r: { product: { id: string } }) => r.product.id)).toEqual([
        soon.id,
        later.id,
      ]);
    });
  });

  describe('我的車庫', () => {
    it('訂單完成自動入庫；可手動登錄、編輯與公開分享（不含購入價）；退貨時移除', async () => {
      const admin = await createAdmin(ctx);
      const { member, order: placed } = await placePaidOrder(ctx, { price: 880, quantity: 2 });
      for (const status of ['PROCESSING', 'SHIPPED', 'COMPLETED']) {
        await ctx
          .http()
          .post(`/v1/admin/orders/${placed.id}/status`)
          .set(admin.auth)
          .send({ status })
          .expect(201);
      }
      const custom = await ctx
        .http()
        .post('/v1/me/garage')
        .set(member.auth)
        .send({
          name: 'Skyline GT-R R34',
          brandName: 'Tomica',
          scale: '1:64',
          pricePaid: 320,
          quantity: 1,
          note: '在夜市買的',
        })
        .expect(201);
      expect(custom.body).toMatchObject({ source: 'MANUAL', productId: null, condition: 'SEALED' });
      await ctx
        .http()
        .patch(`/v1/me/garage/${custom.body.id}`)
        .set(member.auth)
        .send({ condition: 'OPENED', isFavorite: true })
        .expect(200);

      const garage = await ctx.http().get('/v1/me/garage').set(member.auth).expect(200);
      expect(garage.body.items.map((i: { source: string }) => i.source)).toEqual([
        'MANUAL',
        'ORDER',
      ]);
      expect(garage.body.items[1]).toMatchObject({ quantity: 2, pricePaid: 880 });
      expect(garage.body.stats).toMatchObject({ models: 2, cars: 3 });
      expect(garage.body.totalPaid).toBe(880 * 2 + 320);

      const other = await registerMember(ctx);
      await ctx
        .http()
        .patch(`/v1/me/garage/${custom.body.id}`)
        .set(other.auth)
        .send({ isFavorite: false })
        .expect(404);

      await ctx.http().get('/v1/garages/my-diecast').expect(404);
      await ctx
        .http()
        .put('/v1/me/garage/settings')
        .set(member.auth)
        .send({ public: true, handle: 'my-diecast' })
        .expect(200);
      const shared = await ctx.http().get('/v1/garages/my-diecast').expect(200);
      expect(shared.body.items).toHaveLength(2);
      expect(
        shared.body.items.every(
          (i: { pricePaid: unknown; note: unknown }) => i.pricePaid === null && i.note === null,
        ),
      ).toBe(true);
      const taken = await ctx
        .http()
        .put('/v1/me/garage/settings')
        .set(other.auth)
        .send({ public: true, handle: 'my-diecast' })
        .expect(409);
      expect(taken.body.error.code).toBe('GARAGE_HANDLE_TAKEN');
      await ctx
        .http()
        .put('/v1/me/garage/settings')
        .set(other.auth)
        .send({ public: true, handle: 'admin' })
        .expect(409);

      await ctx
        .http()
        .post(`/v1/admin/orders/${placed.id}/status`)
        .set(admin.auth)
        .send({ status: 'REFUNDED', note: '鑑賞期退貨' })
        .expect(201);
      const afterReturn = await ctx.http().get('/v1/me/garage').set(member.auth).expect(200);
      expect(afterReturn.body.items.map((i: { source: string }) => i.source)).toEqual(['MANUAL']);
    });
  });

  describe('通知與活動', () => {
    it('超商到店時通知取貨', async () => {
      const admin = await createAdmin(ctx);
      const { member, order: placed } = await placePaidOrder(ctx);
      await ctx.http().post(`/v1/admin/orders/${placed.id}/shipment`).set(admin.auth).expect(201);
      await ctx
        .http()
        .post(`/v1/admin/orders/${placed.id}/shipment/simulate`)
        .set(admin.auth)
        .send({ status: 'ARRIVED' })
        .expect(201);
      const inbox = await notifications(member.auth);
      expect(inbox.data.map((n: { type: string }) => n.type).sort()).toEqual([
        'ORDER_ARRIVED',
        'ORDER_PAID',
        'ORDER_SHIPPED',
      ]);
      const arrived = inbox.data.find((n: { type: string }) => n.type === 'ORDER_ARRIVED');
      expect(arrived.body).toContain(CVS_CHECKOUT.cvsStoreName);
    });

    it('活動列表只列已發布、尚未結束的活動', async () => {
      const make = (slug: string, status: 'DRAFT' | 'PUBLISHED', startsInDays: number) =>
        ctx.prisma.event.create({
          data: {
            slug,
            type: 'EXHIBITION',
            status,
            startsAt: new Date(Date.now() + startsInDays * 86_400_000),
            endsAt: new Date(Date.now() + (startsInDays + 1) * 86_400_000),
            venue: '花博爭艷館',
            translations: {
              create: [
                { locale: 'zh-TW', title: `活動 ${slug}`, summary: '摘要', body: '內容' },
                { locale: 'en', title: `Event ${slug}`, summary: 'Summary', body: 'Body' },
              ],
            },
          },
        });
      await make('expo', 'PUBLISHED', 10);
      await make('meetup', 'PUBLISHED', 3);
      await make('draft', 'DRAFT', 5);
      await make('past', 'PUBLISHED', -5);

      const list = await ctx.http().get('/v1/events?locale=en').expect(200);
      expect(list.body.data.map((e: { slug: string }) => e.slug)).toEqual(['meetup', 'expo']);
      expect(list.body.data[0].title).toBe('Event meetup');
      const detail = await ctx.http().get('/v1/events/expo').expect(200);
      expect(detail.body).toMatchObject({ body: '內容', venue: '花博爭艷館', product: null });
      await ctx.http().get('/v1/events/draft').expect(404);
    });
  });

  it('會員付款後才看得到自己的通知（不同會員互不相干）', async () => {
    const product = await createProduct(ctx.prisma);
    const member = await registerMember(ctx);
    const other = await registerMember(ctx);
    const created = await order(member.auth, product.id).expect(201);
    await payWithMock(ctx, member, created.body.orderNo);
    expect((await notifications(member.auth)).unreadCount).toBe(1);
    expect((await notifications(other.auth)).unreadCount).toBe(0);
  });
});
