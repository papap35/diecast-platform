import { createTestApp, resetDatabase, type TestContext } from './utils.js';

describe('會員認證 (e2e)', () => {
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

  const register = (email = 'collector@example.com') =>
    ctx.http().post('/v1/auth/register').send({ email, password: 'Sup3r-secret', name: '收藏家' });

  it('註冊後回傳會員資料與權杖，並可用 access token 讀取 /me', async () => {
    const res = await register().expect(201);
    expect(res.body.member).toMatchObject({ email: 'collector@example.com', locale: 'zh-TW' });
    expect(res.body.tokens.accessToken).toBeTruthy();

    const me = await ctx
      .http()
      .get('/v1/me')
      .set('Authorization', `Bearer ${res.body.tokens.accessToken}`)
      .expect(200);
    expect(me.body.email).toBe('collector@example.com');
  });

  it('重複註冊回傳 EMAIL_TAKEN；Email 不分大小寫', async () => {
    await register().expect(201);
    const res = await register('Collector@Example.com').expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('輸入格式錯誤時回傳欄位明細', async () => {
    const res = await ctx
      .http()
      .post('/v1/auth/register')
      .send({ email: 'not-an-email', password: '123', name: '' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password', 'name']));
  });

  it('密碼錯誤回傳 INVALID_CREDENTIALS', async () => {
    await register().expect(201);
    const res = await ctx
      .http()
      .post('/v1/auth/login')
      .send({ email: 'collector@example.com', password: 'wrong-password' })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('refresh token 會輪替；舊 token 重複使用時整組登入作廢', async () => {
    const { body } = await register().expect(201);
    const first = body.tokens.refreshToken as string;

    const rotated = await ctx
      .http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: first })
      .expect(200);
    const second = rotated.body.refreshToken as string;
    expect(second).not.toBe(first);

    // 模擬超過寬限期後才被拿來重複使用（例如 token 外洩）
    await ctx.prisma.authSession.updateMany({
      where: { rotatedAt: { not: null } },
      data: { rotatedAt: new Date(Date.now() - 60_000) },
    });
    const reuse = await ctx
      .http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: first })
      .expect(401);
    expect(reuse.body.error.code).toBe('TOKEN_REUSED');

    // 偵測到重複使用後，新的 token 也一併失效
    const after = await ctx
      .http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: second })
      .expect(401);
    expect(after.body.error.code).toBe('TOKEN_REUSED');
  });

  it('寬限期內同一個 refresh token 的並發刷新都會成功（不誤判為盜用）', async () => {
    const { body } = await register().expect(201);
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        ctx.http().post('/v1/auth/refresh').send({ refreshToken: body.tokens.refreshToken }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    for (const r of results) {
      await ctx
        .http()
        .get('/v1/me')
        .set('Authorization', `Bearer ${r.body.accessToken}`)
        .expect(200);
    }
  });

  it('沒有帶 token 或 token 無效時回傳 401', async () => {
    await ctx.http().get('/v1/me').expect(401);
    const res = await ctx.http().get('/v1/me').set('Authorization', 'Bearer nope').expect(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('會員 token 不能呼叫後台 API', async () => {
    const { body } = await register().expect(201);
    await ctx
      .http()
      .get('/v1/admin/auth/me')
      .set('Authorization', `Bearer ${body.tokens.accessToken}`)
      .expect(401);
  });

  it('刪除帳號後個資去識別化，且無法再登入', async () => {
    const { body } = await register().expect(201);
    await ctx
      .http()
      .delete('/v1/me')
      .set('Authorization', `Bearer ${body.tokens.accessToken}`)
      .send({ password: 'Sup3r-secret' })
      .expect(204);

    const member = await ctx.prisma.member.findUniqueOrThrow({ where: { id: body.member.id } });
    expect(member.status).toBe('DELETED');
    expect(member.email).not.toContain('collector');

    await ctx
      .http()
      .post('/v1/auth/login')
      .send({ email: 'collector@example.com', password: 'Sup3r-secret' })
      .expect(401);
  });
});
