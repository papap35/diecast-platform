import { EmailOutboxService } from '../src/modules/notifications/email-outbox.service.js';
import { createAdmin, registerMember } from './fixtures.js';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

type Auth = Record<string, string>;

describe('寄信紀錄 (e2e)', () => {
  let ctx: TestContext;
  let admin: { auth: Auth };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    admin = await createAdmin(ctx, ['admin:manage']);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const at = (minute: number) => new Date(Date.UTC(2026, 9, 6, 1, minute));

  /** 通知信（寄給會員）、電子報、測試信各一封 */
  const seed = async () => {
    const member = await registerMember(ctx, 'collector@example.com');
    const notification = await ctx.prisma.notification.create({
      data: {
        memberId: member.id,
        type: 'ORDER_SHIPPED',
        title: '訂單已出貨',
        body: '你的訂單已出貨',
      },
    });
    const campaign = await ctx.prisma.campaign.create({
      data: { name: '十月新品', status: 'SENT' },
    });
    const shipped = await ctx.prisma.emailMessage.create({
      data: {
        to: 'collector@example.com',
        subject: '[Paddock 64] 訂單已出貨',
        text: '你的訂單已出貨',
        notificationId: notification.id,
        status: 'FAILED',
        attempts: 5,
        lastError: 'Resend HTTP 503',
        createdAt: at(0),
      },
    });
    const newsletter = await ctx.prisma.emailMessage.create({
      data: {
        to: 'collector@example.com',
        subject: '十月新品到貨',
        text: '十月新品上架了',
        campaignId: campaign.id,
        unsubscribeUrl: 'http://api.test/v1/unsubscribe/one-click?token=x',
        status: 'SENT',
        attempts: 1,
        sentAt: at(2),
        createdAt: at(1),
      },
    });
    const test = await ctx.prisma.emailMessage.create({
      data: {
        to: 'marketer@example.com',
        subject: '［測試］十月新品到貨',
        text: '測試',
        createdAt: at(3),
      },
    });
    return { member, campaign, shipped, newsletter, test };
  };

  it('列表依時間新到舊、可依狀態、類型與關鍵字篩選，並附各狀態封數', async () => {
    const { shipped, newsletter, test } = await seed();
    const all = await ctx.http().get('/v1/admin/emails').set(admin.auth).expect(200);
    expect(all.body.stats).toEqual({ pending: 1, sent: 1, failed: 1 });
    expect(all.body.data.map((m: { id: string }) => m.id)).toEqual([
      test.id,
      newsletter.id,
      shipped.id,
    ]);
    expect(all.body.data.map((m: { kind: string }) => m.kind)).toEqual([
      'OTHER',
      'CAMPAIGN',
      'NOTIFICATION',
    ]);
    expect(all.body.data[0]).not.toHaveProperty('text');

    const failed = await ctx
      .http()
      .get('/v1/admin/emails?status=FAILED')
      .set(admin.auth)
      .expect(200);
    expect(failed.body.data).toHaveLength(1);
    expect(failed.body.data[0]).toMatchObject({
      id: shipped.id,
      attempts: 5,
      lastError: 'Resend HTTP 503',
    });
    // 篩選不影響統計
    expect(failed.body.stats).toEqual(all.body.stats);

    const campaigns = await ctx
      .http()
      .get('/v1/admin/emails?kind=CAMPAIGN')
      .set(admin.auth)
      .expect(200);
    expect(campaigns.body.data.map((m: { id: string }) => m.id)).toEqual([newsletter.id]);
    const search = await ctx
      .http()
      .get(`/v1/admin/emails?q=${encodeURIComponent('MARKETER')}`)
      .set(admin.auth)
      .expect(200);
    expect(search.body.data.map((m: { id: string }) => m.id)).toEqual([test.id]);
  });

  it('內容頁帶出會員、通知類型與電子報；失敗的信可以重新排入，其他狀態不行', async () => {
    const { member, campaign, shipped, newsletter } = await seed();
    const detail = await ctx
      .http()
      .get(`/v1/admin/emails/${shipped.id}`)
      .set(admin.auth)
      .expect(200);
    expect(detail.body).toMatchObject({
      text: '你的訂單已出貨',
      memberId: member.id,
      notificationType: 'ORDER_SHIPPED',
      campaign: null,
    });
    const letter = await ctx
      .http()
      .get(`/v1/admin/emails/${newsletter.id}`)
      .set(admin.auth)
      .expect(200);
    expect(letter.body.campaign).toEqual({ id: campaign.id, name: '十月新品' });

    const retried = await ctx
      .http()
      .post(`/v1/admin/emails/${shipped.id}/retry`)
      .set(admin.auth)
      .expect(200);
    expect(retried.body).toMatchObject({ status: 'PENDING', attempts: 0, nextAttemptAt: null });
    const again = await ctx
      .http()
      .post(`/v1/admin/emails/${newsletter.id}/retry`)
      .set(admin.auth)
      .expect(409);
    expect(again.body.error.code).toBe('EMAIL_NOT_RETRYABLE');
    await ctx
      .http()
      .post('/v1/admin/emails/00000000-0000-7000-8000-000000000000/retry')
      .set(admin.auth)
      .expect(404);

    const log = await ctx.prisma.auditLog.findFirstOrThrow({ where: { action: 'email.retry' } });
    expect(log).toMatchObject({ targetType: 'EmailMessage', targetId: shipped.id });

    const staff = await createAdmin(ctx, ['member:read', 'order:read']);
    await ctx.http().get('/v1/admin/emails').set(staff.auth).expect(403);
  });

  it('寄送失敗後間隔拉長重試，第 5 次失敗標記為失敗；全部重新排入後寄出', async () => {
    const outbox = ctx.app.get(EmailOutboxService);
    const deliver = vi
      .spyOn(outbox as unknown as { deliver: () => Promise<void> }, 'deliver')
      .mockRejectedValue(new Error('Resend HTTP 503'));
    const message = await ctx.prisma.emailMessage.create({
      data: { to: 'someone@example.com', subject: '測試', text: '內容' },
    });
    const state = () => ctx.prisma.emailMessage.findUniqueOrThrow({ where: { id: message.id } });

    let now = new Date();
    const gaps: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      expect(await outbox.sendPending(50, now)).toBe(0);
      const current = await state();
      expect(current.attempts).toBe(i + 1);
      if (current.nextAttemptAt) {
        gaps.push((current.nextAttemptAt.getTime() - now.getTime()) / 60_000);
        // 還沒到重試時間不會再寄
        await outbox.sendPending(50, now);
        expect((await state()).attempts).toBe(i + 1);
        now = new Date(current.nextAttemptAt.getTime() + 1000);
      }
    }
    expect(gaps).toEqual([1, 5, 15, 60]);
    expect(await state()).toMatchObject({ status: 'FAILED', nextAttemptAt: null });

    const retried = await ctx
      .http()
      .post('/v1/admin/emails/retry-failed')
      .set(admin.auth)
      .expect(200);
    expect(retried.body).toEqual({ count: 1 });
    deliver.mockResolvedValue(undefined);
    expect(await outbox.sendPending()).toBe(1);
    expect(await state()).toMatchObject({ status: 'SENT', attempts: 1, lastError: null });
  });
});
