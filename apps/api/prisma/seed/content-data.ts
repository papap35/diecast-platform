/**
 * 內容管理的示範資料：全站公告與首頁活動橫幅（只在還沒有任何橫幅時建立，避免覆蓋後台的修改）。
 */
import type { PrismaClient } from '../../src/generated/prisma/client.js';

type L10n = { 'zh-TW': string; en: string; 'zh-CN': string };

interface SeedBanner {
  placement: 'ANNOUNCEMENT' | 'HOME_PROMO';
  theme: 'INK' | 'RED' | 'NAVY' | 'GOLD';
  linkUrl: string;
  imageUrl: string | null;
  sortOrder: number;
  title: L10n;
  subtitle: L10n | null;
  ctaLabel: L10n | null;
}

export const BANNERS: SeedBanner[] = [
  {
    placement: 'ANNOUNCEMENT',
    theme: 'INK',
    linkUrl: '/products/vortex-gt3-liquid-chrome',
    imageUrl: null,
    sortOrder: 0,
    title: {
      'zh-TW': '限量 300 台「Vortex GT3 液態鉻」即將開賣，正式車手以上提前 1 小時優先購',
      en: 'Only 300 made: Vortex GT3 "Liquid Chrome" drops soon. Driver members and up get 1-hour early access',
      'zh-CN': '限量 300 台「Vortex GT3 液态铬」即将开卖，正式车手以上提前 1 小时优先购',
    },
    subtitle: null,
    ctaLabel: null,
  },
  {
    placement: 'HOME_PROMO',
    theme: 'NAVY',
    linkUrl: '/events/paddock64-diecast-expo',
    imageUrl: '/static/products/endurance-legends-gift-box.svg',
    sortOrder: 1,
    title: {
      'zh-TW': 'Paddock 64 年度模型車展',
      en: 'Paddock 64 Annual Diecast Expo',
      'zh-CN': 'Paddock 64 年度模型车展',
    },
    subtitle: {
      'zh-TW': '三天展期、六大品牌、現場限定色與交換會',
      en: 'Three days, six brands, show-exclusive colours and a swap meet',
      'zh-CN': '三天展期、六大品牌、现场限定色与交换会',
    },
    ctaLabel: { 'zh-TW': '活動詳情', en: 'Event details', 'zh-CN': '活动详情' },
  },
  {
    placement: 'HOME_PROMO',
    theme: 'GOLD',
    linkUrl: '/products?availability=preorder',
    imageUrl: '/static/products/vortex-gt3-r-24-1-18.svg',
    sortOrder: 2,
    title: { 'zh-TW': '預購專區', en: 'Pre-orders', 'zh-CN': '预购专区' },
    subtitle: {
      'zh-TW': '即將到港的 1:18 與 1:43 新車款，現在就能先鎖定',
      en: 'Lock in upcoming 1:18 and 1:43 models before they land',
      'zh-CN': '即将到港的 1:18 与 1:43 新车款，现在就能先锁定',
    },
    ctaLabel: { 'zh-TW': '看預購車款', en: 'Browse pre-orders', 'zh-CN': '看预购车款' },
  },
  {
    placement: 'HOME_PROMO',
    theme: 'RED',
    linkUrl: '/account/garage',
    imageUrl: '/static/products/formosa-taxi-95.svg',
    sortOrder: 3,
    title: {
      'zh-TW': '打造你的線上車庫',
      en: 'Build your online garage',
      'zh-CN': '打造你的在线车库',
    },
    subtitle: {
      'zh-TW': '登錄收藏、看品牌分布，還能公開分享給車友',
      en: 'Log your collection, see your brand mix and share it with friends',
      'zh-CN': '登录收藏、看品牌分布，还能公开分享给车友',
    },
    ctaLabel: { 'zh-TW': '開始登錄', en: 'Start logging', 'zh-CN': '开始登录' },
  },
];

export async function seedBanners(prisma: PrismaClient): Promise<void> {
  if ((await prisma.banner.count()) > 0) return;
  for (const banner of BANNERS) {
    await prisma.banner.create({
      data: {
        placement: banner.placement,
        status: 'PUBLISHED',
        theme: banner.theme,
        linkUrl: banner.linkUrl,
        imageUrl: banner.imageUrl,
        sortOrder: banner.sortOrder,
        translations: {
          create: (['zh-TW', 'en', 'zh-CN'] as const).map((locale) => ({
            locale,
            title: banner.title[locale],
            subtitle: banner.subtitle?.[locale] ?? null,
            ctaLabel: banner.ctaLabel?.[locale] ?? null,
          })),
        },
      },
    });
  }
}
