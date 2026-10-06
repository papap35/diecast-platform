import { CampaignsService } from '../src/modules/marketing/campaigns.service.js';
import { createAdmin, registerMember } from './fixtures.js';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

type Auth = Record<string, string>;

describe('電子報 (e2e)', () => {
  let ctx: TestContext;
  let admin: { auth: Auth; profile: { email: string } };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    admin = await createAdmin(ctx, ['marketing:write'], 'marketer@example.com');
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const campaigns = () => ctx.app.get(CampaignsService);

  /** 建立會員並設定訂閱、等級與語系 */
  const member = async (optIn: boolean, tier = 'ROOKIE', locale = 'zh-TW') => {
    const m = await registerMember(ctx);
    await ctx.prisma.member.update({
      where: { id: m.id },
      data: { marketingOptIn: optIn, tier: tier as never, locale },
    });
    return m;
  };

  const draft = (body: Record<string, unknown> = {}) =>
    ctx
      .http()
      .post('/v1/admin/campaigns')
      .set(admin.auth)
      .send({
        name: '十月新品',
        translations: [
          { locale: 'zh-TW', subject: '十月新品到貨', body: '{{name}} 你好：\n\n十月新品上架了。' },
          {
            locale: 'en',
            subject: 'New in October',
            body: 'Hi {{name}},\n\nNew arrivals are here.',
          },
        ],
        ...body,
      });

  it('只寄給訂閱且等級達標的會員；依語系挑內容並帶入名稱與退訂連結；重跑不會重複寄', async () => {
    const zh = await member(true, 'DRIVER', 'zh-TW');
    const en = await member(true, 'LEGEND', 'en');
    await member(true, 'ROOKIE');
    await member(false, 'LEGEND');
    const suspended = await member(true, 'LEGEND');
    await ctx.prisma.member.update({ where: { id: suspended.id }, data: { status: 'SUSPENDED' } });

    const created = await draft({ minTier: 'DRIVER' }).expect(201);
    expect(created.body).toMatchObject({
      status: 'DRAFT',
      audienceCount: 2,
      subject: '十月新品到貨',
    });

    const scheduled = await ctx
      .http()
      .post(`/v1/admin/campaigns/${created.body.id}/schedule`)
      .set(admin.auth)
      .send({})
      .expect(200);
    expect(scheduled.body.status).toBe('SCHEDULED');
    // 排程中不能修改
    const locked = await ctx
      .http()
      .patch(`/v1/admin/campaigns/${created.body.id}`)
      .set(admin.auth)
      .send({ name: '改名' })
      .expect(409);
    expect(locked.body.error.code).toBe('CAMPAIGN_NOT_EDITABLE');

    expect(await campaigns().processDue()).toBe(1);
    const messages = await ctx.prisma.emailMessage.findMany({
      where: { campaignId: created.body.id },
      orderBy: { to: 'asc' },
    });
    expect(messages).toHaveLength(2);
    const zhMail = messages.find((m) => m.subject === '十月新品到貨')!;
    const enMail = messages.find((m) => m.subject === 'New in October')!;
    expect(zhMail.text).toContain('測試會員 你好');
    expect(zhMail.text).toMatch(/不想再收到：http:\/\/web\.test\/zh-TW\/unsubscribe\?token=/);
    expect(enMail.text).toContain('Hi 測試會員');
    expect(enMail.text).toContain('/en/unsubscribe?token=');
    expect(zhMail.unsubscribeUrl).toMatch(
      /^http:\/\/api\.test\/v1\/unsubscribe\/one-click\?token=/,
    );
    expect([zhMail.to, enMail.to].sort()).toEqual(
      [
        (await ctx.prisma.member.findUniqueOrThrow({ where: { id: zh.id } })).email,
        (await ctx.prisma.member.findUniqueOrThrow({ where: { id: en.id } })).email,
      ].sort(),
    );

    const sent = await ctx
      .http()
      .get(`/v1/admin/campaigns/${created.body.id}`)
      .set(admin.auth)
      .expect(200);
    expect(sent.body).toMatchObject({
      status: 'SENT',
      audienceCount: 2,
      stats: { pending: 2, sent: 0, failed: 0 },
    });

    // 模擬寫入外寄匣到一半中斷：狀態改回寄送中再跑一次，不會重複寫入
    await ctx.prisma.campaign.update({
      where: { id: created.body.id },
      data: { status: 'SENDING' },
    });
    await campaigns().processDue();
    expect(await ctx.prisma.emailMessage.count({ where: { campaignId: created.body.id } })).toBe(2);
  });

  it('退訂：前台確認頁與一鍵退訂都會取消訂閱；偽造的權杖無效', async () => {
    const subscriber = await member(true);
    const created = await draft().expect(201);
    await ctx
      .http()
      .post(`/v1/admin/campaigns/${created.body.id}/schedule`)
      .set(admin.auth)
      .send({})
      .expect(200);
    await campaigns().processDue();
    const mail = await ctx.prisma.emailMessage.findFirstOrThrow({
      where: { campaignId: created.body.id },
    });
    const token = new URL(mail.unsubscribeUrl!).searchParams.get('token')!;

    const forged = await ctx
      .http()
      .post('/v1/unsubscribe')
      .send({ token: `${subscriber.id}.forged-signature` })
      .expect(400);
    expect(forged.body.error.code).toBe('UNSUBSCRIBE_INVALID');

    await ctx
      .http()
      .post(`/v1/unsubscribe/one-click?token=${encodeURIComponent(token)}`)
      .type('form')
      .send('List-Unsubscribe=One-Click')
      .expect(200);
    expect(
      (await ctx.prisma.member.findUniqueOrThrow({ where: { id: subscriber.id } })).marketingOptIn,
    ).toBe(false);

    // 前台確認頁送出（重複退訂也成功）
    await ctx.http().post('/v1/unsubscribe').send({ token }).expect(204);
    const next = await draft({ name: '十一月' }).expect(201);
    expect(next.body.audienceCount).toBe(0);
  });

  it('排程時間未到不寄；取消排程回到草稿；測試信寄給自己；寄出後不能刪除', async () => {
    await member(true);
    const created = await draft().expect(201);
    const later = new Date(Date.now() + 3_600_000).toISOString();
    await ctx
      .http()
      .post(`/v1/admin/campaigns/${created.body.id}/schedule`)
      .set(admin.auth)
      .send({ scheduledAt: later })
      .expect(200);
    expect(await campaigns().processDue()).toBe(0);
    const cancelled = await ctx
      .http()
      .post(`/v1/admin/campaigns/${created.body.id}/cancel`)
      .set(admin.auth)
      .expect(200);
    expect(cancelled.body).toMatchObject({ status: 'DRAFT', scheduledAt: null });

    await ctx
      .http()
      .post(`/v1/admin/campaigns/${created.body.id}/test`)
      .set(admin.auth)
      .send({ locale: 'en' })
      .expect(204);
    const test = await ctx.prisma.emailMessage.findFirstOrThrow({
      where: { to: 'marketer@example.com' },
    });
    expect(test).toMatchObject({ subject: '［測試］New in October', campaignId: null });
    expect(test.text).toContain('Hi 管理員');

    await ctx
      .http()
      .post(`/v1/admin/campaigns/${created.body.id}/schedule`)
      .set(admin.auth)
      .send({})
      .expect(200);
    await campaigns().processDue();
    await ctx.http().delete(`/v1/admin/campaigns/${created.body.id}`).set(admin.auth).expect(409);
    await ctx
      .http()
      .post(`/v1/admin/campaigns/${created.body.id}/cancel`)
      .set(admin.auth)
      .expect(409);

    const list = await ctx
      .http()
      .get('/v1/admin/campaigns?status=SENT')
      .set(admin.auth)
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    const staff = await createAdmin(ctx, ['order:read']);
    await ctx.http().get('/v1/admin/campaigns').set(staff.auth).expect(403);
  });
});
