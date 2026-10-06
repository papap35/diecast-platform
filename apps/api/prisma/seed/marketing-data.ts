/**
 * 行銷的示範資料：四張不同類型的優惠券（已存在的優惠碼不覆蓋，保留後台的修改）。
 */
import type { PrismaClient } from '../../src/generated/prisma/client.js';

const DAY = 86_400_000;

export async function seedCoupons(prisma: PrismaClient): Promise<void> {
  const expo = await prisma.event.findUnique({
    where: { slug: 'paddock64-diecast-expo' },
    select: { startsAt: true, endsAt: true },
  });
  const now = Date.now();
  const coupons = [
    {
      code: 'WELCOME100',
      name: '新會員首購折 100',
      type: 'FIXED' as const,
      value: 100,
      minSubtotal: 1000,
      perMemberLimit: 1,
    },
    {
      code: 'DRIVER10',
      name: '正式車手以上 9 折（最高折 500）',
      type: 'PERCENT' as const,
      value: 10,
      maxDiscount: 500,
      minTier: 'DRIVER' as const,
      perMemberLimit: 3,
    },
    {
      code: 'FREESHIP',
      name: '滿 500 免運',
      type: 'FREE_SHIPPING' as const,
      value: 0,
      minSubtotal: 500,
      usageLimit: 200,
      perMemberLimit: 1,
      endsAt: new Date(now + 30 * DAY),
    },
    {
      code: 'EXPO200',
      name: '年度車展期間滿 2,000 折 200',
      type: 'FIXED' as const,
      value: 200,
      minSubtotal: 2000,
      perMemberLimit: 1,
      startsAt: expo?.startsAt ?? new Date(now + 12 * DAY),
      endsAt: expo?.endsAt ?? new Date(now + 14 * DAY),
    },
  ];
  for (const coupon of coupons) {
    await prisma.coupon.upsert({ where: { code: coupon.code }, create: coupon, update: {} });
  }
}

/** 一封示範電子報草稿（已有電子報時不建立） */
export async function seedCampaigns(prisma: PrismaClient): Promise<void> {
  if ((await prisma.campaign.count()) > 0) return;
  await prisma.campaign.create({
    data: {
      name: '十月新品快報',
      minTier: null,
      translations: {
        create: [
          {
            locale: 'zh-TW',
            subject: '十月新品快報：液態鉻 GT3 限量開賣',
            body: '{{name}} 你好：\n\n限量 300 台的 Vortex GT3「液態鉻」收藏家版即將開賣，正式車手以上會員可提前 1 小時優先購。\n\n本月還有三款 1:18 預購新品，以及 Paddock 64 年度模型車展的活動消息，歡迎到官網看看。',
          },
          {
            locale: 'en',
            subject: 'October drops: Liquid Chrome GT3',
            body: 'Hi {{name}},\n\nOnly 300 of the Vortex GT3 "Liquid Chrome" collector edition are coming soon, with one-hour early access for Driver members and above.\n\nThis month also brings three new 1:18 pre-orders and news about the Paddock 64 Annual Diecast Expo.',
          },
        ],
      },
    },
  });
}
