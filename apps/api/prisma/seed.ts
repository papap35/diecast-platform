/**
 * 示範資料種子（可重複執行）。
 * - 角色、管理員、示範會員、品牌、分類、商品皆以唯一鍵 upsert
 * - 既有商品「不覆寫庫存」，只更新內容與發售時間（重新執行即可刷新限量發售的倒數）
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/common/security/password.js';
import { Permission } from '../src/modules/auth/permissions.js';
import { BRANDS, CATEGORIES, PRODUCTS, type SeedProduct } from './seed/catalog-data.js';
import { seedDemoMemberExtras, seedEvents } from './seed/collector-data.js';
import { seedBanners } from './seed/content-data.js';
import { seedCampaigns, seedCoupons } from './seed/marketing-data.js';
import {
  seedDemoFulfilment,
  seedDemoMemberOrders,
  seedDemoOrders,
  syncTiers,
} from './seed/demo-orders.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const DEMO_ACCOUNTS = {
  superAdmin: { email: 'admin@paddock64.dev', password: 'Paddock64!admin', name: '系統管理員' },
  operator: { email: 'ops@paddock64.dev', password: 'Paddock64!ops', name: '營運小編' },
  support: { email: 'cs@paddock64.dev', password: 'Paddock64!cs', name: '客服人員' },
  member: { email: 'demo@paddock64.dev', password: 'Paddock64!demo', name: '示範會員' },
} as const;

/**
 * 種子資料的相對時間。一天以上的開賣時間對齊台灣時間晚上 8 點（實際發售常見的時段），
 * 一天內的（例如「剛開賣」）只對齊整點。
 */
function relativeTime(now: Date, hours: number): Date {
  const target = new Date(now.getTime() + hours * HOUR);
  if (Math.abs(hours) < 24) {
    target.setUTCMinutes(0, 0, 0);
    return target;
  }
  const taipei = new Date(target.getTime() + 8 * HOUR);
  taipei.setUTCHours(20, 0, 0, 0);
  return new Date(taipei.getTime() - 8 * HOUR);
}

async function seedRoles() {
  const roles = [
    { key: 'super_admin', name: '超級管理員', description: '擁有所有權限', permissions: ['*'] },
    {
      key: 'operator',
      name: '營運人員',
      description: '商品、訂單、內容與行銷管理',
      permissions: [
        Permission.DashboardRead,
        Permission.ProductRead,
        Permission.ProductWrite,
        Permission.CatalogWrite,
        Permission.OrderRead,
        Permission.OrderWrite,
        Permission.MemberRead,
        Permission.ContentWrite,
        Permission.MarketingWrite,
        Permission.ReportRead,
      ],
    },
    {
      key: 'customer_service',
      name: '客服人員',
      description: '查詢訂單與會員、處理訂單狀態',
      permissions: [
        Permission.DashboardRead,
        Permission.ProductRead,
        Permission.OrderRead,
        Permission.OrderWrite,
        Permission.MemberRead,
      ],
    },
  ];
  const byKey = new Map<string, string>();
  for (const role of roles) {
    const saved = await prisma.role.upsert({
      where: { key: role.key },
      create: { ...role, isSystem: true },
      update: { name: role.name, description: role.description, permissions: role.permissions },
    });
    byKey.set(role.key, saved.id);
  }
  return byKey;
}

async function seedAdmins(roleIds: Map<string, string>) {
  const admins = [
    { ...DEMO_ACCOUNTS.superAdmin, role: 'super_admin' },
    { ...DEMO_ACCOUNTS.operator, role: 'operator' },
    { ...DEMO_ACCOUNTS.support, role: 'customer_service' },
  ];
  for (const admin of admins) {
    await prisma.adminUser.upsert({
      where: { email: admin.email },
      create: {
        email: admin.email,
        name: admin.name,
        passwordHash: await hashPassword(admin.password),
        roleId: roleIds.get(admin.role)!,
      },
      update: { roleId: roleIds.get(admin.role)!, isActive: true },
    });
  }
}

async function seedMember() {
  const { email, password, name } = DEMO_ACCOUNTS.member;
  await prisma.member.upsert({
    where: { email },
    create: {
      email,
      name,
      phone: '0912345678',
      passwordHash: await hashPassword(password),
      marketingOptIn: true,
    },
    update: { status: 'ACTIVE' },
  });
}

async function seedBrands() {
  const ids = new Map<string, string>();
  for (const brand of BRANDS) {
    const data = {
      name: brand.name,
      country: brand.country,
      sortOrder: brand.sortOrder,
      logoUrl: `/static/brands/${brand.slug}.svg`,
    };
    const saved = await prisma.brand.upsert({
      where: { slug: brand.slug },
      create: { slug: brand.slug, ...data },
      update: data,
    });
    await prisma.brandTranslation.deleteMany({ where: { brandId: saved.id } });
    await prisma.brandTranslation.createMany({
      data: Object.entries(brand.description).map(([locale, description]) => ({
        brandId: saved.id,
        locale,
        description,
      })),
    });
    ids.set(brand.slug, saved.id);
  }
  return ids;
}

async function seedCategories() {
  const ids = new Map<string, string>();
  // 父分類先建立
  const ordered = [...CATEGORIES].sort((a, b) => Number(!!a.parent) - Number(!!b.parent));
  for (const category of ordered) {
    const data = {
      sortOrder: category.sortOrder,
      parentId: category.parent ? ids.get(category.parent)! : null,
    };
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      create: { slug: category.slug, ...data },
      update: data,
    });
    await prisma.categoryTranslation.deleteMany({ where: { categoryId: saved.id } });
    await prisma.categoryTranslation.createMany({
      data: Object.entries(category.name).map(([locale, name]) => ({
        categoryId: saved.id,
        locale,
        name,
        description: category.description?.[locale as keyof typeof category.name] ?? null,
      })),
    });
    ids.set(category.slug, saved.id);
  }
  return ids;
}

async function seedProducts(brandIds: Map<string, string>, categoryIds: Map<string, string>) {
  const now = new Date();
  // 讓「最新上架」排序有層次：清單越前面的商品越新
  const total = PRODUCTS.length;

  for (const [index, product] of PRODUCTS.entries()) {
    const data = productData(product, now, brandIds, categoryIds);
    const existing = await prisma.product.findUnique({ where: { slug: product.slug } });

    const saved = existing
      ? await prisma.product.update({ where: { id: existing.id }, data })
      : await prisma.product.create({
          data: {
            ...data,
            slug: product.slug,
            stock: product.stock,
            createdAt: new Date(now.getTime() - (total - index) * 6 * HOUR),
          },
        });

    if (!existing && product.stock > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: saved.id,
          delta: product.stock,
          balance: product.stock,
          reason: 'ADMIN_ADJUSTMENT',
          note: '示範資料初始庫存',
          // 早於所有示範訂單，異動紀錄依時間排序才合理
          createdAt: new Date(now.getTime() - 30 * DAY),
        },
      });
    }

    await prisma.productTranslation.deleteMany({ where: { productId: saved.id } });
    await prisma.productTranslation.createMany({
      data: Object.entries(product.copy).map(([locale, copy]) => ({
        productId: saved.id,
        locale,
        name: copy.name,
        subtitle: copy.subtitle ?? null,
        description: copy.description,
      })),
    });

    await prisma.productImage.deleteMany({ where: { productId: saved.id } });
    await prisma.productImage.createMany({
      data: ['', '-front', '-rear'].map((suffix, sortOrder) => ({
        productId: saved.id,
        url: `/static/products/${product.slug}${suffix}.svg`,
        alt: product.copy.en.name,
        sortOrder,
      })),
    });
  }
}

function productData(
  product: SeedProduct,
  now: Date,
  brandIds: Map<string, string>,
  categoryIds: Map<string, string>,
) {
  return {
    sku: product.sku,
    brandId: brandIds.get(product.brand)!,
    categoryId: categoryIds.get(product.category)!,
    scale: product.scale,
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? null,
    status: product.status ?? 'ACTIVE',
    saleType: product.saleType ?? 'REGULAR',
    releaseAt:
      product.releaseInHours !== undefined ? relativeTime(now, product.releaseInHours) : null,
    preorderClosesAt:
      product.preorderClosesInDays !== undefined
        ? new Date(now.getTime() + product.preorderClosesInDays * DAY)
        : null,
    expectedShipAt:
      product.expectedShipInDays !== undefined
        ? new Date(now.getTime() + product.expectedShipInDays * DAY)
        : null,
    earlyAccessTier: product.earlyAccess?.tier ?? null,
    earlyAccessAt:
      product.earlyAccess && product.releaseInHours !== undefined
        ? new Date(
            relativeTime(now, product.releaseInHours).getTime() -
              product.earlyAccess.minutesBefore * 60_000,
          )
        : null,
    purchaseLimit: product.purchaseLimit ?? null,
    isFeatured: product.isFeatured ?? false,
    specs: product.specs,
  };
}

async function main() {
  const roleIds = await seedRoles();
  await seedAdmins(roleIds);
  await seedMember();
  const brandIds = await seedBrands();
  const categoryIds = await seedCategories();
  await seedProducts(brandIds, categoryIds);
  const orders = await seedDemoOrders(prisma);
  await seedDemoMemberOrders(prisma, DEMO_ACCOUNTS.member.email);
  await seedDemoFulfilment(prisma, DEMO_ACCOUNTS.member.email);
  await syncTiers(prisma);
  await seedEvents(prisma);
  await seedBanners(prisma);
  await seedCoupons(prisma);
  await seedCampaigns(prisma);
  await seedDemoMemberExtras(prisma, DEMO_ACCOUNTS.member.email);

  console.log(`✔ 示範資料建立完成${orders ? `（新增 ${orders} 筆示範訂單）` : ''}`);
  console.log(`  後台：${DEMO_ACCOUNTS.superAdmin.email} / ${DEMO_ACCOUNTS.superAdmin.password}`);
  console.log(`  會員：${DEMO_ACCOUNTS.member.email} / ${DEMO_ACCOUNTS.member.password}`);
}

await main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
