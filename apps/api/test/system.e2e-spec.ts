import { createAdmin, createProduct, placePaidOrder } from './fixtures.js';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

type Auth = Record<string, string>;

describe('後台系統管理 (e2e)', () => {
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

  const login = (email: string, password: string) =>
    ctx.http().post('/v1/admin/auth/login').send({ email, password });

  const bearer = (accessToken: string): Auth => ({ Authorization: `Bearer ${accessToken}` });

  const activeSessions = (adminId: string) =>
    ctx.prisma.authSession.count({
      where: { subjectType: 'ADMIN', subjectId: adminId, revokedAt: null },
    });

  it('新增自訂角色與管理員：權限依角色生效，調整角色權限立即生效', async () => {
    const owner = await createAdmin(ctx);
    const roles = await ctx.http().get('/v1/admin/roles').set(owner.auth).expect(200);
    expect(roles.body.permissions).toEqual(
      expect.arrayContaining(['product:write', 'admin:manage']),
    );
    expect(roles.body.permissions).not.toContain('*');

    const role = await ctx
      .http()
      .post('/v1/admin/roles')
      .set(owner.auth)
      .send({
        key: 'catalog_editor',
        name: '商品編輯',
        permissions: ['product:write', 'product:read', 'dashboard:read'],
      })
      .expect(201);
    expect(role.body).toMatchObject({
      isSystem: false,
      isLocked: false,
      adminCount: 0,
      // 依權限清單的順序排列
      permissions: ['dashboard:read', 'product:read', 'product:write'],
    });
    const invalid = await ctx
      .http()
      .post('/v1/admin/roles')
      .set(owner.auth)
      .send({ key: 'hacker', name: '全部', permissions: ['*'] })
      .expect(400);
    expect(invalid.body.error.code).toBe('VALIDATION_FAILED');

    const created = await ctx
      .http()
      .post('/v1/admin/admins')
      .set(owner.auth)
      .send({
        email: 'Editor@Example.com',
        name: '小編',
        roleId: role.body.id,
        password: 'Editor-pass-123',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      email: 'editor@example.com',
      isActive: true,
      role: { key: 'catalog_editor', name: '商品編輯' },
    });
    const duplicate = await ctx
      .http()
      .post('/v1/admin/admins')
      .set(owner.auth)
      .send({
        email: 'editor@example.com',
        name: '重複',
        roleId: role.body.id,
        password: 'x'.repeat(10),
      })
      .expect(409);
    expect(duplicate.body.error.code).toBe('EMAIL_TAKEN');

    const session = await login('editor@example.com', 'Editor-pass-123').expect(200);
    const editor = bearer(session.body.tokens.accessToken);
    await ctx.http().get('/v1/admin/products').set(editor).expect(200);
    await ctx.http().get('/v1/admin/orders').set(editor).expect(403);
    await ctx.http().get('/v1/admin/admins').set(editor).expect(403);

    await ctx
      .http()
      .patch(`/v1/admin/roles/${role.body.id}`)
      .set(owner.auth)
      .send({ permissions: ['product:read', 'product:write', 'order:read'] })
      .expect(200);
    await ctx.http().get('/v1/admin/orders').set(editor).expect(200);

    const inUse = await ctx.http().delete(`/v1/admin/roles/${role.body.id}`).set(owner.auth);
    expect(inUse.status).toBe(409);
    expect(inUse.body.error.code).toBe('ROLE_IN_USE');
    const unused = await ctx
      .http()
      .post('/v1/admin/roles')
      .set(owner.auth)
      .send({ key: 'temp_role', name: '暫時', permissions: [] })
      .expect(201);
    await ctx.http().delete(`/v1/admin/roles/${unused.body.id}`).set(owner.auth).expect(204);
  });

  it('停用管理員立即失效並登出所有裝置；重設密碼後舊 token 與舊密碼都不能用', async () => {
    const owner = await createAdmin(ctx);
    const staff = await createAdmin(ctx, ['order:read'], 'staff@example.com');
    expect(await activeSessions(staff.profile.id)).toBe(1);

    await ctx
      .http()
      .patch(`/v1/admin/admins/${staff.profile.id}`)
      .set(owner.auth)
      .send({ isActive: false })
      .expect(200);
    const disabled = await ctx.http().get('/v1/admin/orders').set(staff.auth).expect(401);
    expect(disabled.body.error.code).toBe('ACCOUNT_DISABLED');
    expect(await activeSessions(staff.profile.id)).toBe(0);
    const blocked = await login('staff@example.com', 'Admin-pass-123').expect(403);
    expect(blocked.body.error.code).toBe('ACCOUNT_DISABLED');

    await ctx
      .http()
      .patch(`/v1/admin/admins/${staff.profile.id}`)
      .set(owner.auth)
      .send({ isActive: true })
      .expect(200);
    const session = await login('staff@example.com', 'Admin-pass-123').expect(200);
    const before = bearer(session.body.tokens.accessToken);
    await ctx.http().get('/v1/admin/orders').set(before).expect(200);

    // token 的簽發時間以秒為單位：隔一秒再重設，舊 token 才確定早於重設時間
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await ctx
      .http()
      .post(`/v1/admin/admins/${staff.profile.id}/password`)
      .set(owner.auth)
      .send({ password: 'New-staff-pass-1' })
      .expect(204);
    const expired = await ctx.http().get('/v1/admin/orders').set(before).expect(401);
    expect(expired.body.error.code).toBe('TOKEN_INVALID');
    await login('staff@example.com', 'Admin-pass-123').expect(401);
    const fresh = await login('staff@example.com', 'New-staff-pass-1').expect(200);
    await ctx.http().get('/v1/admin/orders').set(bearer(fresh.body.tokens.accessToken)).expect(200);
  });

  it('不能停用自己或改自己的角色；至少保留一位超級管理員；超管角色不可修改', async () => {
    const owner = await createAdmin(ctx);
    const self = await ctx
      .http()
      .patch(`/v1/admin/admins/${owner.profile.id}`)
      .set(owner.auth)
      .send({ isActive: false })
      .expect(409);
    expect(self.body.error.code).toBe('CANNOT_MODIFY_SELF');
    // 送出相同的角色與啟用狀態（表單常見）只改名字是可以的
    const renamed = await ctx
      .http()
      .patch(`/v1/admin/admins/${owner.profile.id}`)
      .set(owner.auth)
      .send({ name: '店長', roleId: owner.profile.role.id, isActive: true })
      .expect(200);
    expect(renamed.body.name).toBe('店長');
    const selfReset = await ctx
      .http()
      .post(`/v1/admin/admins/${owner.profile.id}/password`)
      .set(owner.auth)
      .send({ password: 'Another-pass-1' })
      .expect(409);
    expect(selfReset.body.error.code).toBe('CANNOT_MODIFY_SELF');

    const manager = await createAdmin(ctx, ['admin:manage']);
    const last = await ctx
      .http()
      .patch(`/v1/admin/admins/${owner.profile.id}`)
      .set(manager.auth)
      .send({ roleId: manager.profile.role.id })
      .expect(409);
    expect(last.body.error.code).toBe('LAST_SUPER_ADMIN');

    // 有第二位超管後就可以調整
    const second = await createAdmin(ctx);
    await ctx
      .http()
      .patch(`/v1/admin/admins/${owner.profile.id}`)
      .set(second.auth)
      .send({ isActive: false })
      .expect(200);

    const locked = await ctx
      .http()
      .patch(`/v1/admin/roles/${second.profile.role.id}`)
      .set(second.auth)
      .send({ name: '改名' })
      .expect(409);
    expect(locked.body.error.code).toBe('ROLE_LOCKED');
    const lockout = await ctx
      .http()
      .patch(`/v1/admin/roles/${manager.profile.role.id}`)
      .set(manager.auth)
      .send({ permissions: ['order:read'] })
      .expect(409);
    expect(lockout.body.error.code).toBe('CANNOT_MODIFY_SELF');
  });

  it('修改自己的密碼：目前的密碼錯誤時拒絕；成功後所有裝置要重新登入', async () => {
    const owner = await createAdmin(ctx, ['*'], 'owner@example.com');
    const wrong = await ctx
      .http()
      .post('/v1/admin/auth/password')
      .set(owner.auth)
      .send({ currentPassword: 'not-my-password', newPassword: 'Brand-new-pass-1' })
      .expect(400);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    const short = await ctx
      .http()
      .post('/v1/admin/auth/password')
      .set(owner.auth)
      .send({ currentPassword: 'Admin-pass-123', newPassword: 'short' })
      .expect(400);
    expect(short.body.error.code).toBe('VALIDATION_FAILED');

    await ctx
      .http()
      .post('/v1/admin/auth/password')
      .set(owner.auth)
      .send({ currentPassword: 'Admin-pass-123', newPassword: 'Brand-new-pass-1' })
      .expect(204);
    expect(await activeSessions(owner.profile.id)).toBe(0);
    await login('owner@example.com', 'Admin-pass-123').expect(401);
    await login('owner@example.com', 'Brand-new-pass-1').expect(200);
  });

  it('操作紀錄：記錄後台寫入與登入、遮蔽密碼，並可依動作與資料篩選', async () => {
    const owner = await createAdmin(ctx, ['*'], 'owner@example.com');
    const product = await createProduct(ctx.prisma);
    await ctx
      .http()
      .post(`/v1/admin/products/${product.id}/stock`)
      .set(owner.auth)
      .send({ delta: 3, note: '盤點' })
      .expect(200);
    const { order } = await placePaidOrder(ctx);
    await ctx
      .http()
      .post(`/v1/admin/orders/${order.id}/status`)
      .set(owner.auth)
      .send({ status: 'PROCESSING' })
      .expect(201);
    const roles = await ctx.http().get('/v1/admin/roles').set(owner.auth).expect(200);
    await ctx
      .http()
      .post('/v1/admin/admins')
      .set(owner.auth)
      .send({
        email: 'new@example.com',
        name: '新人',
        roleId: roles.body.data[0].id,
        password: 'Secret-pass-123',
      })
      .expect(201);
    await login('owner@example.com', 'wrong-password').expect(401);
    // 不存在的帳號登入失敗不記錄
    await login('nobody@example.com', 'wrong-password').expect(401);

    const logs = await ctx.http().get('/v1/admin/audit-logs').set(owner.auth).expect(200);
    expect(logs.body.data.map((log: { action: string }) => log.action)).toEqual([
      'auth.login_failed',
      'admin.create',
      'order.status',
      'product.stock',
      'auth.login',
    ]);
    const find = (action: string) =>
      logs.body.data.find((log: { action: string }) => log.action === action);
    expect(find('admin.create')).toMatchObject({
      targetType: 'AdminUser',
      targetLabel: 'new@example.com',
      admin: { email: 'owner@example.com' },
      changes: { email: 'new@example.com', password: '[REDACTED]' },
    });
    expect(find('order.status')).toMatchObject({
      targetType: 'Order',
      targetId: order.id,
      targetLabel: order.orderNo,
      changes: { status: 'PROCESSING' },
    });
    expect(find('product.stock')).toMatchObject({
      targetId: product.id,
      targetLabel: product.sku,
      changes: { delta: 3, note: '盤點' },
    });
    expect(find('auth.login_failed').ip).toBeTruthy();

    const filtered = await ctx
      .http()
      .get(`/v1/admin/audit-logs?action=order&targetId=${order.id}`)
      .set(owner.auth)
      .expect(200);
    expect(filtered.body.data).toHaveLength(1);
    const byAdmin = await ctx
      .http()
      .get(`/v1/admin/audit-logs?adminId=${owner.profile.id}&action=auth.login`)
      .set(owner.auth)
      .expect(200);
    expect(byAdmin.body.meta.total).toBe(1);

    const staff = await createAdmin(ctx, ['order:read']);
    await ctx.http().get('/v1/admin/audit-logs').set(staff.auth).expect(403);
  });
});
