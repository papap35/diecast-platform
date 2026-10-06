/**
 * 收藏玩家功能的示範資料：活動、示範會員的願望清單、發售提醒、手動登錄的車庫與通知紀錄。
 * 場地與地址皆為虛構；時間以種子執行當下為基準，重新執行會更新活動時間。
 */
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { renderNotification } from '../../src/modules/notifications/notification-templates.js';

type L10n = { 'zh-TW': string; en: string; 'zh-CN': string };

/** 相對時間：N 天後的台灣時間幾點，或某個商品開賣時間的前後幾分鐘 */
type When =
  { days: number; hour: number; minute: number } | { release: string; offsetMinutes: number };

interface SeedEvent {
  slug: string;
  type: 'EXHIBITION' | 'MEETUP' | 'LAUNCH' | 'ONLINE';
  status: 'DRAFT' | 'PUBLISHED';
  startsAt: When;
  endsAt: When;
  venue: string;
  address: string | null;
  /** 封面使用的商品圖（/static/products/{cover}.svg） */
  cover: string;
  product: string | null;
  title: L10n;
  summary: L10n;
  body: L10n;
}

export const EVENTS: SeedEvent[] = [
  {
    slug: 'paddock64-diecast-expo',
    type: 'EXHIBITION',
    status: 'PUBLISHED',
    startsAt: { days: 12, hour: 10, minute: 0 },
    endsAt: { days: 14, hour: 18, minute: 0 },
    venue: 'Paddock 64 台北旗艦館（示範場地）',
    address: '臺北市信義區示範路 64 號',
    cover: 'endurance-legends-gift-box',
    product: null,
    title: {
      'zh-TW': 'Paddock 64 年度模型車展',
      en: 'Paddock 64 Annual Diecast Expo',
      'zh-CN': 'Paddock 64 年度模型车展',
    },
    summary: {
      'zh-TW': '三天展期、六大品牌、超過 300 台展示車款，現場限定色與交換會。',
      en: 'Three days, six brands and 300+ models on display, plus show-exclusive colours and a swap meet.',
      'zh-CN': '三天展期、六大品牌、超过 300 台展示车款，现场限定色与交换会。',
    },
    body: {
      'zh-TW':
        'Paddock 64 年度模型車展回來了！今年集結 Kaze Models、Apex Miniatures、Formosa Diecast 等六個品牌，展出超過 300 台車款，從 1:64 街車到 1:18 收藏級模型一次看個夠。\n\n現場設有「交換會」區，歡迎帶著你的重複收藏來交流；每天下午 3 點有改裝講座，由資深玩家分享舊化與輪框改裝技巧。\n\n會員出示會員卡（App 會員頁）即可兌換限定徽章，冠軍車手以上另享現場優先入場。',
      en: 'The Paddock 64 Annual Diecast Expo is back! Six brands including Kaze Models, Apex Miniatures and Formosa Diecast bring more than 300 models, from 1:64 street cars to 1:18 collector pieces.\n\nBring your duplicates to the swap meet area, and join the 3 pm customising talks where veteran collectors share weathering and wheel-swap tips.\n\nShow your member card (in the app) for an exclusive pin. Champion members and above get priority entry.',
      'zh-CN':
        'Paddock 64 年度模型车展回来了！今年集结 Kaze Models、Apex Miniatures、Formosa Diecast 等六个品牌，展出超过 300 台车款，从 1:64 街车到 1:18 收藏级模型一次看个够。\n\n现场设有「交换会」区，欢迎带着你的重复收藏来交流；每天下午 3 点有改装讲座，由资深玩家分享旧化与轮框改装技巧。\n\n会员出示会员卡（App 会员页）即可兑换限定徽章，冠军车手以上另享现场优先入场。',
    },
  },
  {
    slug: 'jdm-night-meetup',
    type: 'MEETUP',
    status: 'PUBLISHED',
    startsAt: { days: 5, hour: 19, minute: 30 },
    endsAt: { days: 5, hour: 22, minute: 0 },
    venue: 'Paddock 64 台中店（示範場地）',
    address: '臺中市西屯區示範大道 128 號',
    cover: 'shiden-rs-coupe-midnight-purple',
    product: null,
    title: {
      'zh-TW': '週五 JDM 之夜車聚',
      en: 'Friday JDM Night Meetup',
      'zh-CN': '周五 JDM 之夜车聚',
    },
    summary: {
      'zh-TW': '帶上你最愛的日系車款，和同好一起拍照、交流、交換。',
      en: 'Bring your favourite Japanese cars for photos, chats and trades.',
      'zh-CN': '带上你最爱的日系车款，和同好一起拍照、交流、交换。',
    },
    body: {
      'zh-TW':
        '這週五晚上，台中店變身 JDM 主題車聚！現場準備夜景街道拍攝台，歡迎帶著你最愛的日系車款來拍照交流。\n\n活動免費參加，現場消費滿 NT$1,000 加贈 Kaze Models 貼紙組。',
      en: 'This Friday our Taichung store hosts a JDM-themed meetup, complete with a night-street photo diorama. Bring your favourite Japanese cars and meet fellow collectors.\n\nFree entry. Spend NT$1,000 on the night and get a Kaze Models sticker set.',
      'zh-CN':
        '这周五晚上，台中店变身 JDM 主题车聚！现场准备夜景街道拍摄台，欢迎带着你最爱的日系车款来拍照交流。\n\n活动免费参加，现场消费满 NT$1,000 加赠 Kaze Models 贴纸组。',
    },
  },
  {
    slug: 'vortex-liquid-chrome-launch',
    type: 'LAUNCH',
    status: 'PUBLISHED',
    startsAt: { release: 'vortex-gt3-liquid-chrome', offsetMinutes: -60 },
    endsAt: { release: 'vortex-gt3-liquid-chrome', offsetMinutes: 60 },
    venue: '線上直播＋台北旗艦館',
    address: null,
    cover: 'vortex-gt3-liquid-chrome',
    product: 'vortex-gt3-liquid-chrome',
    title: {
      'zh-TW': 'Vortex GT3「液態鉻」發售之夜',
      en: 'Vortex GT3 Liquid Chrome Launch Night',
      'zh-CN': 'Vortex GT3「液态铬」发售之夜',
    },
    summary: {
      'zh-TW': '限量 300 台液態鉻車殼，正式車手以上開賣前 1 小時優先購。',
      en: '300 liquid-chrome shells. Driver members and above get one hour of early access.',
      'zh-CN': '限量 300 台液态铬车壳，正式车手以上开卖前 1 小时优先购。',
    },
    body: {
      'zh-TW':
        'Apex Miniatures 年度限定 Vortex GT3「液態鉻」將於當晚 20:00 開賣，全球限量 300 台、每人限購 2 台。\n\n正式車手以上會員可在開賣前 1 小時優先購買；在商品頁設定「發售提醒」，開始前 15 分鐘會通知你。\n\n發售當晚旗艦館同步直播開箱，現場另有實車鍍鉻展示。',
      en: "Apex Miniatures' limited Vortex GT3 \"Liquid Chrome\" goes on sale at 8 pm: 300 pieces worldwide, two per customer.\n\nDriver members and above can buy one hour early. Set a release reminder on the product page and we'll notify you 15 minutes before your window opens.\n\nWe'll stream the unboxing live from the flagship store on launch night.",
      'zh-CN':
        'Apex Miniatures 年度限定 Vortex GT3「液态铬」将于当晚 20:00 开卖，全球限量 300 台、每人限购 2 台。\n\n正式车手以上会员可在开卖前 1 小时优先购买；在商品页设置「发售提醒」，开始前 15 分钟会通知你。\n\n发售当晚旗舰馆同步直播开箱，现场另有实车镀铬展示。',
    },
  },
  {
    slug: 'comet-lmp-unboxing-live',
    type: 'ONLINE',
    status: 'PUBLISHED',
    startsAt: { release: 'comet-lmp-hybrid-8', offsetMinutes: -1440 },
    endsAt: { release: 'comet-lmp-hybrid-8', offsetMinutes: -1380 },
    venue: 'YouTube 直播（示範）',
    address: null,
    cover: 'comet-lmp-hybrid-8',
    product: 'comet-lmp-hybrid-8',
    title: {
      'zh-TW': '直播開箱：Comet LMP Hybrid #8',
      en: 'Live Unboxing: Comet LMP Hybrid #8',
      'zh-CN': '直播开箱：Comet LMP Hybrid #8',
    },
    summary: {
      'zh-TW': '開賣前一天搶先看 1:43 耐力賽原型車的細節與包裝。',
      en: 'A day before launch, see every detail of the 1:43 endurance prototype.',
      'zh-CN': '开卖前一天抢先看 1:43 耐力赛原型车的细节与包装。',
    },
    body: {
      'zh-TW':
        'Pit Lane Collectibles 1:43 Comet LMP Hybrid #8 開賣前一天，我們會在直播中完整開箱：碳纖維紋路、可拆式車殼、展示底座與編號證書。\n\n冠軍車手以上會員可在開賣前 30 分鐘優先購買。',
      en: "The day before the Pit Lane Collectibles 1:43 Comet LMP Hybrid #8 goes on sale, we'll unbox it live: carbon weave, removable body, display base and numbered certificate.\n\nChampion members and above can buy 30 minutes before the public launch.",
      'zh-CN':
        'Pit Lane Collectibles 1:43 Comet LMP Hybrid #8 开卖前一天，我们会在直播中完整开箱：碳纤维纹路、可拆式车壳、展示底座与编号证书。\n\n冠军车手以上会员可在开卖前 30 分钟优先购买。',
    },
  },
  {
    slug: 'formosa-taxi-day',
    type: 'LAUNCH',
    status: 'PUBLISHED',
    startsAt: { days: -20, hour: 14, minute: 0 },
    endsAt: { days: -20, hour: 17, minute: 0 },
    venue: 'Paddock 64 台北旗艦館（示範場地）',
    address: '臺北市信義區示範路 64 號',
    cover: 'formosa-taxi-95',
    product: 'formosa-taxi-95',
    title: { 'zh-TW': 'Formosa 小黃日', en: 'Formosa Taxi Day', 'zh-CN': 'Formosa 小黄日' },
    summary: {
      'zh-TW': 'Formosa Diecast 台灣計程車系列發表會（已結束）。',
      en: 'Launch of the Formosa Diecast Taiwan taxi series (ended).',
      'zh-CN': 'Formosa Diecast 台湾出租车系列发表会（已结束）。',
    },
    body: {
      'zh-TW': 'Formosa Diecast 台灣計程車系列發表會，感謝大家的參與！',
      en: 'Thanks to everyone who joined the Formosa Diecast Taiwan taxi launch!',
      'zh-CN': 'Formosa Diecast 台湾出租车系列发表会，感谢大家的参与！',
    },
  },
  {
    slug: 'spring-swap-meet',
    type: 'MEETUP',
    status: 'DRAFT',
    startsAt: { days: 40, hour: 13, minute: 0 },
    endsAt: { days: 40, hour: 18, minute: 0 },
    venue: 'Paddock 64 高雄店（示範場地）',
    address: '高雄市苓雅區示範路 21 號',
    cover: 'big-sky-pickup-78',
    product: null,
    title: {
      'zh-TW': '春季交換會（籌備中）',
      en: 'Spring Swap Meet (planning)',
      'zh-CN': '春季交换会（筹备中）',
    },
    summary: {
      'zh-TW': '高雄店首場交換會，細節確認中。',
      en: 'Our first swap meet in Kaohsiung. Details coming soon.',
      'zh-CN': '高雄店首场交换会，细节确认中。',
    },
    body: { 'zh-TW': '細節確認中。', en: 'Details coming soon.', 'zh-CN': '细节确认中。' },
  },
];

const DAY = 86_400_000;

function resolve(when: When, now: Date, releases: Map<string, Date | null>): Date {
  if ('release' in when) {
    const release = releases.get(when.release);
    if (!release) throw new Error(`活動參照的商品沒有開賣時間：${when.release}`);
    return new Date(release.getTime() + when.offsetMinutes * 60_000);
  }
  // 以台灣時間的日期與時刻表示
  const taipei = new Date(now.getTime() + 8 * 3_600_000 + when.days * DAY);
  taipei.setUTCHours(when.hour, when.minute, 0, 0);
  return new Date(taipei.getTime() - 8 * 3_600_000);
}

export async function seedEvents(prisma: PrismaClient): Promise<void> {
  const now = new Date();
  const products = await prisma.product.findMany({
    where: { slug: { in: EVENTS.flatMap((event) => (event.product ? [event.product] : [])) } },
    select: { id: true, slug: true, releaseAt: true },
  });
  const ids = new Map(products.map((product) => [product.slug, product.id]));
  const releases = new Map(products.map((product) => [product.slug, product.releaseAt]));
  for (const event of EVENTS) {
    const data = {
      type: event.type,
      status: event.status,
      startsAt: resolve(event.startsAt, now, releases),
      endsAt: resolve(event.endsAt, now, releases),
      venue: event.venue,
      address: event.address,
      coverImageUrl: `/static/products/${event.cover}.svg`,
      productId: event.product ? (ids.get(event.product) ?? null) : null,
    };
    const saved = await prisma.event.upsert({
      where: { slug: event.slug },
      create: { slug: event.slug, ...data },
      update: data,
    });
    await prisma.eventTranslation.deleteMany({ where: { eventId: saved.id } });
    await prisma.eventTranslation.createMany({
      data: (['zh-TW', 'en', 'zh-CN'] as const).map((locale) => ({
        eventId: saved.id,
        locale,
        title: event.title[locale],
        summary: event.summary[locale],
        body: event.body[locale],
      })),
    });
  }
}

/**
 * 示範會員的收藏玩家資料（只在還沒有時建立）：
 * 願望清單（含一台售完、補貨會通知的車款）、發售提醒、兩台手動登錄的車與公開車庫、通知紀錄。
 */
export async function seedDemoMemberExtras(prisma: PrismaClient, email: string): Promise<void> {
  const member = await prisma.member.findUnique({ where: { email } });
  if (!member) return;
  const products = await prisma.product.findMany({
    where: {
      slug: {
        in: [
          'thunder-valley-69-fastback-raven-black',
          'comet-lmp-hybrid-7',
          'shiden-rs-coupe-pearl-white',
          'vortex-gt3-liquid-chrome',
        ],
      },
    },
    select: { id: true, slug: true, releaseAt: true },
  });
  const id = (slug: string) => products.find((product) => product.slug === slug)?.id;

  for (const slug of [
    'shiden-rs-coupe-pearl-white',
    'comet-lmp-hybrid-7',
    'thunder-valley-69-fastback-raven-black',
  ]) {
    const productId = id(slug);
    if (!productId) continue;
    await prisma.wishlistItem.upsert({
      where: { memberId_productId: { memberId: member.id, productId } },
      create: { memberId: member.id, productId },
      update: {},
    });
  }

  const drop = products.find((product) => product.slug === 'vortex-gt3-liquid-chrome');
  if (drop?.releaseAt && drop.releaseAt > new Date()) {
    await prisma.releaseReminder.upsert({
      where: { memberId_productId: { memberId: member.id, productId: drop.id } },
      create: { memberId: member.id, productId: drop.id },
      update: { notifiedAt: null },
    });
  }

  const manual = await prisma.garageItem.count({
    where: { memberId: member.id, orderItemId: null },
  });
  if (manual === 0) {
    await prisma.garageItem.createMany({
      data: [
        {
          memberId: member.id,
          name: 'Kaze Models Shiden RS Coupe（東京展場限定色）',
          brandName: 'Kaze Models',
          scale: '1:64',
          condition: 'SEALED',
          pricePaid: 1200,
          acquiredAt: new Date('2025-11-15T03:00:00Z'),
          note: '去年東京展場排了兩小時才買到',
          isFavorite: true,
        },
        {
          memberId: member.id,
          name: '童年的紅色掀背車',
          brandName: '無品牌',
          scale: '1:64',
          condition: 'PLAYWORN',
          acquiredAt: new Date('2003-07-01T03:00:00Z'),
          note: '小時候在文具店買的第一台，車漆都磨掉了',
        },
      ],
    });
  }
  if (!member.garageHandle) {
    await prisma.member.update({
      where: { id: member.id },
      data: { garageHandle: 'demo-garage', garagePublic: true },
    });
  }

  if ((await prisma.notification.count({ where: { memberId: member.id } })) === 0) {
    const orders = await prisma.order.findMany({
      where: { memberId: member.id, status: 'COMPLETED' },
      orderBy: { createdAt: 'asc' },
    });
    const history = orders.flatMap((order) => [
      {
        type: 'ORDER_PAID' as const,
        at: order.paidAt!,
        params: { orderNo: order.orderNo, total: order.total },
      },
      { type: 'ORDER_SHIPPED' as const, at: order.shippedAt!, params: { orderNo: order.orderNo } },
      {
        type: 'ORDER_ARRIVED' as const,
        at: new Date(order.shippedAt!.getTime() + DAY),
        params: { orderNo: order.orderNo, store: order.cvsStoreName ?? '' },
      },
    ]);
    await prisma.notification.createMany({
      data: history.map(({ type, at, params }) => {
        const content = renderNotification(type, 'zh-TW', params);
        const orderNo = params.orderNo;
        return {
          memberId: member.id,
          type,
          title: content.title,
          body: content.body,
          link: `/account/orders/${orderNo}`,
          readAt: new Date(at.getTime() + 3_600_000),
          createdAt: at,
        };
      }),
    });
  }
}
