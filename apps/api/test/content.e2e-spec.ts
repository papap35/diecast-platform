import { createAdmin, createProduct } from './fixtures.js';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

const DAY = 86_400_000;

describe('內容管理 (e2e)', () => {
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

  const event = (overrides: Record<string, unknown> = {}) => ({
    slug: 'taipei-diecast-show',
    type: 'EXHIBITION',
    status: 'DRAFT',
    startsAt: new Date(Date.now() + 10 * DAY).toISOString(),
    endsAt: new Date(Date.now() + 11 * DAY).toISOString(),
    venue: '花博爭艷館',
    address: '臺北市中山區玉門街 1 號',
    url: 'https://example.com/show',
    translations: [
      { locale: 'zh-TW', title: '台北模型車展', summary: '兩天的車展', body: '第一段\n\n第二段' },
      { locale: 'en', title: 'Taipei Diecast Show', summary: 'Two days', body: 'Body' },
    ],
    ...overrides,
  });

  const banner = (overrides: Record<string, unknown> = {}) => ({
    placement: 'HOME_PROMO',
    status: 'PUBLISHED',
    theme: 'NAVY',
    linkUrl: '/events/taipei-diecast-show',
    translations: [
      { locale: 'zh-TW', title: '台北模型車展', subtitle: '11/15–16', ctaLabel: '看活動' },
      { locale: 'en', title: 'Taipei Diecast Show', subtitle: 'Nov 15–16', ctaLabel: 'Details' },
    ],
    ...overrides,
  });

  describe('活動', () => {
    it('草稿在前台看不到；發布後出現；更新翻譯與關聯商品；刪除後消失', async () => {
      const admin = await createAdmin(ctx, ['content:write']);
      const product = await createProduct(ctx.prisma, { saleType: 'LIMITED' });

      const created = await ctx
        .http()
        .post('/v1/admin/events')
        .set(admin.auth)
        .send(event({ productId: product.id }))
        .expect(201);
      expect(created.body).toMatchObject({
        slug: 'taipei-diecast-show',
        status: 'DRAFT',
        title: '台北模型車展',
        product: { id: product.id, sku: product.sku },
      });
      expect(created.body.translations).toHaveLength(2);
      await ctx.http().get('/v1/events/taipei-diecast-show').expect(404);

      const updated = await ctx
        .http()
        .patch(`/v1/admin/events/${created.body.id}`)
        .set(admin.auth)
        .send({
          status: 'PUBLISHED',
          productId: null,
          translations: [
            { locale: 'zh-TW', title: '台北模型車展 2026', summary: '更新', body: '內容' },
          ],
        })
        .expect(200);
      expect(updated.body).toMatchObject({ status: 'PUBLISHED', product: null });
      expect(updated.body.translations).toEqual([
        { locale: 'zh-TW', title: '台北模型車展 2026', summary: '更新', body: '內容' },
      ]);

      const detail = await ctx.http().get('/v1/events/taipei-diecast-show?locale=en').expect(200);
      // 沒有英文翻譯時回退繁中
      expect(detail.body).toMatchObject({ title: '台北模型車展 2026', venue: '花博爭艷館' });
      const list = await ctx.http().get('/v1/admin/events?q=2026').set(admin.auth).expect(200);
      expect(list.body.data).toHaveLength(1);

      await ctx.http().delete(`/v1/admin/events/${created.body.id}`).set(admin.auth).expect(204);
      await ctx.http().get('/v1/events/taipei-diecast-show').expect(404);
    });

    it('驗證：結束早於開始、缺少繁中、商品不存在、slug 重複', async () => {
      const admin = await createAdmin(ctx, ['content:write']);
      const range = await ctx
        .http()
        .post('/v1/admin/events')
        .set(admin.auth)
        .send(event({ endsAt: new Date(Date.now() + DAY).toISOString() }))
        .expect(400);
      expect(range.body.error.details).toEqual([
        { field: 'endsAt', messages: ['結束時間不可早於開始時間'] },
      ]);
      await ctx
        .http()
        .post('/v1/admin/events')
        .set(admin.auth)
        .send(
          event({ translations: [{ locale: 'en', title: 'Only English', summary: '', body: '' }] }),
        )
        .expect(400);
      await ctx
        .http()
        .post('/v1/admin/events')
        .set(admin.auth)
        .send(event({ productId: '01900000-0000-7000-8000-000000000000' }))
        .expect(400);
      await ctx
        .http()
        .post('/v1/admin/events')
        .set(admin.auth)
        .send(event({ url: 'javascript:alert(1)' }))
        .expect(400);

      await ctx.http().post('/v1/admin/events').set(admin.auth).send(event()).expect(201);
      const duplicate = await ctx.http().post('/v1/admin/events').set(admin.auth).send(event());
      expect(duplicate.status).toBe(409);
    });
  });

  describe('公告與首頁橫幅', () => {
    it('只顯示已發布且在上架期間內的橫幅，依排序；草稿、排程中、已下架都不出現', async () => {
      const admin = await createAdmin(ctx, ['content:write']);
      const create = (overrides: Record<string, unknown>) =>
        ctx.http().post('/v1/admin/banners').set(admin.auth).send(banner(overrides)).expect(201);

      const second = await create({ sortOrder: 2 });
      const first = await create({
        sortOrder: 1,
        theme: 'RED',
        translations: [{ locale: 'zh-TW', title: '預購專區', subtitle: null, ctaLabel: null }],
      });
      await create({ status: 'DRAFT' });
      const scheduled = await create({ startsAt: new Date(Date.now() + DAY).toISOString() });
      await create({
        startsAt: new Date(Date.now() - 2 * DAY).toISOString(),
        endsAt: new Date(Date.now() - DAY).toISOString(),
      });
      await create({ placement: 'ANNOUNCEMENT' });

      const promos = await ctx.http().get('/v1/banners?placement=HOME_PROMO&locale=en').expect(200);
      expect(promos.body.map((b: { id: string }) => b.id)).toEqual([first.body.id, second.body.id]);
      // 沒有英文翻譯的回退繁中
      expect(promos.body[0]).toMatchObject({ theme: 'RED', title: '預購專區', ctaLabel: null });
      expect(promos.body[1]).toMatchObject({ title: 'Taipei Diecast Show', ctaLabel: 'Details' });

      const all = await ctx.http().get('/v1/admin/banners').set(admin.auth).expect(200);
      expect(all.body.data.map((b: { state: string }) => b.state).sort()).toEqual([
        'DRAFT',
        'ENDED',
        'LIVE',
        'LIVE',
        'LIVE',
        'SCHEDULED',
      ]);

      // 後台修改立即反映在前台（清除快取）
      await ctx
        .http()
        .patch(`/v1/admin/banners/${scheduled.body.id}`)
        .set(admin.auth)
        .send({ startsAt: null, sortOrder: 0 })
        .expect(200);
      const updated = await ctx.http().get('/v1/banners?placement=HOME_PROMO').expect(200);
      expect(updated.body[0].id).toBe(scheduled.body.id);

      await ctx.http().delete(`/v1/admin/banners/${first.body.id}`).set(admin.auth).expect(204);
      const afterDelete = await ctx.http().get('/v1/banners?placement=HOME_PROMO').expect(200);
      expect(afterDelete.body).toHaveLength(2);
      const announcements = await ctx.http().get('/v1/banners?placement=ANNOUNCEMENT').expect(200);
      expect(announcements.body).toHaveLength(1);
    });

    it('驗證連結格式與期間；沒有內容權限不能管理', async () => {
      const admin = await createAdmin(ctx, ['content:write']);
      for (const linkUrl of ['//evil.example.com', 'javascript:alert(1)', 'events']) {
        await ctx
          .http()
          .post('/v1/admin/banners')
          .set(admin.auth)
          .send(banner({ linkUrl }))
          .expect(400);
      }
      await ctx
        .http()
        .post('/v1/admin/banners')
        .set(admin.auth)
        .send(
          banner({
            startsAt: new Date(Date.now() + DAY).toISOString(),
            endsAt: new Date(Date.now()).toISOString(),
          }),
        )
        .expect(400);
      await ctx.http().get('/v1/banners?placement=SIDEBAR').expect(400);

      const staff = await createAdmin(ctx, ['order:read']);
      await ctx.http().get('/v1/admin/banners').set(staff.auth).expect(403);
      await ctx.http().post('/v1/admin/banners').set(staff.auth).send(banner()).expect(403);
    });
  });
});
