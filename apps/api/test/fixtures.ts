import type { PrismaService } from '../src/infra/prisma/prisma.service.js';
import type { TestContext } from './utils.js';

let seq = 0;

export async function createCatalogBasics(prisma: PrismaService) {
  seq += 1;
  const brand = await prisma.brand.create({ data: { slug: `brand-${seq}`, name: `Brand ${seq}` } });
  const category = await prisma.category.create({
    data: {
      slug: `category-${seq}`,
      translations: { create: [{ locale: 'zh-TW', name: `分類 ${seq}` }] },
    },
  });
  return { brand, category };
}

export interface ProductOverrides {
  stock?: number;
  price?: number;
  saleType?: 'REGULAR' | 'PRE_ORDER' | 'LIMITED';
  releaseAt?: Date | null;
  preorderClosesAt?: Date | null;
  purchaseLimit?: number | null;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}

export async function createProduct(prisma: PrismaService, overrides: ProductOverrides = {}) {
  const { brand, category } = await createCatalogBasics(prisma);
  seq += 1;
  return prisma.product.create({
    data: {
      slug: `product-${seq}`,
      sku: `SKU-${seq}`,
      brandId: brand.id,
      categoryId: category.id,
      scale: '1:64',
      price: overrides.price ?? 500,
      stock: overrides.stock ?? 10,
      status: overrides.status ?? 'ACTIVE',
      saleType: overrides.saleType ?? 'REGULAR',
      releaseAt: overrides.releaseAt ?? null,
      preorderClosesAt: overrides.preorderClosesAt ?? null,
      purchaseLimit: overrides.purchaseLimit ?? null,
      translations: {
        create: [
          { locale: 'zh-TW', name: `測試商品 ${seq}`, description: '描述' },
          { locale: 'en', name: `Test Product ${seq}`, description: 'Description' },
        ],
      },
      images: { create: [{ url: `/static/products/test-${seq}.svg`, sortOrder: 0 }] },
    },
  });
}

export async function registerMember(ctx: TestContext, email = `member${++seq}@example.com`) {
  const res = await ctx
    .http()
    .post('/v1/auth/register')
    .send({ email, password: 'Sup3r-secret', name: '測試會員' })
    .expect(201);
  return {
    id: res.body.member.id as string,
    token: res.body.tokens.accessToken as string,
    auth: { Authorization: `Bearer ${res.body.tokens.accessToken}` },
  };
}

export const CVS_CHECKOUT = {
  shippingMethod: 'CVS_711',
  recipientName: '王小明',
  recipientPhone: '0912345678',
  cvsStoreId: '131386',
  cvsStoreName: '台北建國門市',
  cvsStoreAddress: '台北市中山區建國北路一段 100 號',
  invoiceType: 'MEMBER_CARRIER',
};

export interface OrderOptions {
  quantity?: number;
  price?: number;
  stock?: number;
  checkout?: Record<string, unknown>;
}

/** 新會員下單一件新商品（預設超商取貨） */
export async function placeOrder(ctx: TestContext, options: OrderOptions = {}) {
  const product = await createProduct(ctx.prisma, {
    price: options.price ?? 1000,
    stock: options.stock ?? 10,
  });
  const member = await registerMember(ctx);
  const order = await ctx
    .http()
    .post('/v1/orders')
    .set(member.auth)
    .send({
      ...(options.checkout ?? CVS_CHECKOUT),
      items: [{ productId: product.id, quantity: options.quantity ?? 1 }],
    })
    .expect(201);
  return { product, member, order: order.body };
}

/** 以模擬金流完成付款 */
export async function payWithMock(
  ctx: TestContext,
  member: { auth: Record<string, string> },
  orderNo: string,
) {
  const start = await ctx
    .http()
    .post(`/v1/orders/${orderNo}/payments`)
    .set(member.auth)
    .send({})
    .expect(201);
  await ctx
    .http()
    .post(`/v1/payments/mock/${start.body.merchantTradeNo}/complete`)
    .type('form')
    .send({ result: 'success' })
    .expect(303);
}

export async function placePaidOrder(ctx: TestContext, options: OrderOptions = {}) {
  const placed = await placeOrder(ctx, options);
  await payWithMock(ctx, placed.member, placed.order.orderNo);
  return placed;
}

export async function createAdmin(
  ctx: TestContext,
  permissions: string[] = ['*'],
  emailAddress?: string,
) {
  seq += 1;
  const email = emailAddress ?? `admin${seq}@example.com`;
  const { hashPassword } = await import('../src/common/security/password.js');
  const role = await ctx.prisma.role.create({
    data: { key: `role-${seq}`, name: `Role ${seq}`, permissions },
  });
  await ctx.prisma.adminUser.create({
    data: {
      email,
      name: '管理員',
      passwordHash: await hashPassword('Admin-pass-123'),
      roleId: role.id,
    },
  });
  const res = await ctx
    .http()
    .post('/v1/admin/auth/login')
    .send({ email, password: 'Admin-pass-123' })
    .expect(200);
  return {
    auth: { Authorization: `Bearer ${res.body.tokens.accessToken}` },
    profile: res.body.admin,
  };
}
