/**
 * 限量發售壓力測試的資料工具（只在本機或專用測試資料庫使用）：
 *
 *   tsx loadtest/drop-data.ts prepare   建立測試會員與限量商品，輸出 loadtest/.data/drop.json
 *   tsx loadtest/drop-data.ts verify    驗證沒有超賣：成立訂單數 = 庫存、庫存歸零且不為負
 *   tsx loadtest/drop-data.ts cleanup   刪除壓測產生的會員、訂單與商品
 *
 * 會員直接寫入資料庫並以 JWT_SECRET 簽發 access token，省去註冊時的密碼雜湊，
 * 讓壓測只量測「搶購」本身。
 */
import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const DATA_FILE = 'loadtest/.data/drop.json';
const EMAIL_DOMAIN = '@loadtest.invalid';
const SLUG_PREFIX = 'loadtest-drop-';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

interface DropData {
  productId: string;
  slug: string;
  stock: number;
  releaseAt: string;
  tokens: string[];
}

async function prepare(): Promise<void> {
  const members = Number(process.env.LOADTEST_MEMBERS ?? 1000);
  const stock = Number(process.env.LOADTEST_STOCK ?? 300);
  const releaseIn = Number(process.env.LOADTEST_RELEASE_IN ?? 45);
  const run = Date.now().toString(36);

  const [brand, category] = await Promise.all([
    prisma.brand.findFirstOrThrow(),
    prisma.category.findFirstOrThrow(),
  ]);
  const releaseAt = new Date(Date.now() + releaseIn * 1000);
  const product = await prisma.product.create({
    data: {
      slug: `${SLUG_PREFIX}${run}`,
      sku: `LT-${run}`.toUpperCase(),
      brandId: brand.id,
      categoryId: category.id,
      scale: '1:64',
      price: 990,
      stock,
      status: 'ACTIVE',
      saleType: 'LIMITED',
      releaseAt,
      purchaseLimit: 1,
      translations: {
        create: [{ locale: 'zh-TW', name: `壓力測試限量車 ${run}`, description: '壓力測試用商品' }],
      },
    },
  });

  // 密碼雜湊無效：這些帳號不能用密碼登入，只用下面簽發的 token
  await prisma.member.createMany({
    data: Array.from({ length: members }, (_, i) => ({
      email: `lt-${run}-${i}${EMAIL_DOMAIN}`,
      name: `壓測會員 ${i}`,
      passwordHash: 'loadtest-no-password-login',
    })),
  });
  const created = await prisma.member.findMany({
    where: { email: { startsWith: `lt-${run}-` } },
    select: { id: true },
  });
  const jwt = new JwtService({
    secret: process.env.JWT_SECRET!,
    signOptions: { issuer: 'paddock64' },
  });
  const tokens = created.map((member) =>
    jwt.sign({ typ: 'access' }, { subject: member.id, audience: 'member', expiresIn: 3600 }),
  );

  mkdirSync('loadtest/.data', { recursive: true });
  const data: DropData = {
    productId: product.id,
    slug: product.slug,
    stock,
    releaseAt: releaseAt.toISOString(),
    tokens,
  };
  writeFileSync(DATA_FILE, JSON.stringify(data));
  console.log(
    `已建立 ${tokens.length} 位會員、限量商品 ${product.slug}（庫存 ${stock}），${releaseIn} 秒後開賣`,
  );
}

async function verify(): Promise<void> {
  const data = JSON.parse(readFileSync(DATA_FILE, 'utf8')) as DropData;
  const [product, orders, sold] = await Promise.all([
    prisma.product.findUniqueOrThrow({ where: { id: data.productId }, select: { stock: true } }),
    prisma.order.count({ where: { items: { some: { productId: data.productId } } } }),
    prisma.orderItem.aggregate({
      where: { productId: data.productId },
      _sum: { quantity: true },
    }),
  ]);
  const result = {
    stock: data.stock,
    remaining: product.stock,
    orders,
    sold: sold._sum.quantity ?? 0,
  };
  const ok = result.remaining === 0 && result.sold === data.stock && result.orders === data.stock;
  console.log(JSON.stringify(result), ok ? '✔ 沒有超賣也沒有少賣' : '✘ 數量不符');
  if (!ok) process.exitCode = 1;
}

async function cleanup(): Promise<void> {
  const members = { email: { endsWith: EMAIL_DOMAIN } };
  const { count: orders } = await prisma.order.deleteMany({ where: { member: members } });
  const { count: deleted } = await prisma.member.deleteMany({ where: members });
  const products = await prisma.product.findMany({
    where: { slug: { startsWith: SLUG_PREFIX } },
    select: { id: true },
  });
  await prisma.stockMovement.deleteMany({
    where: { productId: { in: products.map((product) => product.id) } },
  });
  const { count: removed } = await prisma.product.deleteMany({
    where: { slug: { startsWith: SLUG_PREFIX } },
  });
  console.log(`已刪除 ${orders} 筆訂單、${deleted} 位會員、${removed} 個商品`);
}

const command = process.argv[2];
const commands: Record<string, () => Promise<void>> = { prepare, verify, cleanup };
if (!commands[command ?? '']) {
  console.error('用法：tsx loadtest/drop-data.ts <prepare|verify|cleanup>');
  process.exit(1);
}
await commands[command!]!();
await prisma.$disconnect();
