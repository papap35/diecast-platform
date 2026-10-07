import { createAdmin, registerMember } from './fixtures.js';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

/**
 * 公開示範環境：示範帳號（帳密公開）不能被訪客改密碼、停用或刪除。
 * DEMO_MODE 在建立 app 時讀取，所以這個測試檔自己開一個示範模式的 app。
 */
describe('示範模式 (e2e)', () => {
  let ctx: TestContext;
  const previous = { DEMO_MODE: process.env.DEMO_MODE, DEMO_ACCOUNTS: process.env.DEMO_ACCOUNTS };

  beforeAll(async () => {
    process.env.DEMO_MODE = 'true';
    process.env.DEMO_ACCOUNTS = 'demo-admin@example.com,Demo-Member@example.com';
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const locked = (res: { body: { error: { code: string } } }) =>
    expect(res.body.error.code).toBe('DEMO_ACCOUNT_LOCKED');

  it('示範管理員：不能改自己的密碼，也不能被其他管理員停用或重設密碼', async () => {
    const demo = await createAdmin(ctx, ['*'], 'demo-admin@example.com');
    const owner = await createAdmin(ctx, ['*'], 'owner@example.com');

    locked(
      await ctx
        .http()
        .post('/v1/admin/auth/password')
        .set(demo.auth)
        .send({ currentPassword: 'Admin-pass-123', newPassword: 'Another-pass-456' })
        .expect(403),
    );
    locked(
      await ctx
        .http()
        .patch(`/v1/admin/admins/${demo.profile.id}`)
        .set(owner.auth)
        .send({ isActive: false })
        .expect(403),
    );
    locked(
      await ctx
        .http()
        .post(`/v1/admin/admins/${demo.profile.id}/password`)
        .set(owner.auth)
        .send({ password: 'Another-pass-456' })
        .expect(403),
    );
    // 一般管理員照常
    await ctx
      .http()
      .post('/v1/admin/auth/password')
      .set(owner.auth)
      .send({ currentPassword: 'Admin-pass-123', newPassword: 'Another-pass-456' })
      .expect(204);
  });

  it('示範會員：不能改密碼、刪除帳號或被停權；一般會員不受影響', async () => {
    const admin = await createAdmin(ctx, ['member:read', 'member:write']);
    const demo = await registerMember(ctx, 'demo-member@example.com');
    const someone = await registerMember(ctx);

    locked(
      await ctx
        .http()
        .post('/v1/me/password')
        .set(demo.auth)
        .send({ currentPassword: 'Sup3r-secret', newPassword: 'Another-secret-9' })
        .expect(403),
    );
    locked(
      await ctx
        .http()
        .delete('/v1/me')
        .set(demo.auth)
        .send({ password: 'Sup3r-secret' })
        .expect(403),
    );
    locked(
      await ctx
        .http()
        .patch(`/v1/admin/members/${demo.id}/status`)
        .set(admin.auth)
        .send({ status: 'SUSPENDED' })
        .expect(403),
    );
    // 示範會員仍可修改個人資料（每天重整時還原）
    await ctx.http().patch('/v1/me').set(demo.auth).send({ name: '新名字' }).expect(200);

    await ctx
      .http()
      .post('/v1/me/password')
      .set(someone.auth)
      .send({ currentPassword: 'Sup3r-secret', newPassword: 'Another-secret-9' })
      .expect(204);
  });
});
