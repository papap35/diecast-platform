import type { Locale } from '../../common/i18n/locale.js';
import type { MemberTier, NotificationType } from '../../generated/prisma/client.js';

/** 通知內容的參數（字串化後放入模板） */
export interface NotificationParams {
  orderNo?: string;
  total?: number;
  store?: string;
  product?: string;
  /** 已依語系格式化的時間 */
  time?: string;
  tier?: MemberTier;
  /** 逾期自動取消（否則為客服取消） */
  expired?: boolean;
  /** 發售提醒是否為優先購 */
  early?: boolean;
}

export interface NotificationContent {
  title: string;
  body: string;
}

type Template = (p: NotificationParams) => NotificationContent;

export const TIER_NAMES: Record<Locale, Record<MemberTier, string>> = {
  'zh-TW': { ROOKIE: '新手車手', DRIVER: '正式車手', CHAMPION: '冠軍車手', LEGEND: '傳奇車手' },
  en: { ROOKIE: 'Rookie', DRIVER: 'Driver', CHAMPION: 'Champion', LEGEND: 'Legend' },
  'zh-CN': { ROOKIE: '新手车手', DRIVER: '正式车手', CHAMPION: '冠军车手', LEGEND: '传奇车手' },
};

const TIER_PERKS: Record<Locale, Record<MemberTier, string>> = {
  'zh-TW': {
    ROOKIE: '會員專屬通知',
    DRIVER: '限量車款優先購（依商品設定）',
    CHAMPION: '限量車款優先購、免運門檻六折',
    LEGEND: '限量車款優先購、全站免運',
  },
  en: {
    ROOKIE: 'member updates',
    DRIVER: 'early access to selected drops',
    CHAMPION: 'early access to selected drops and a 40% lower free-shipping threshold',
    LEGEND: 'early access to selected drops and free shipping on every order',
  },
  'zh-CN': {
    ROOKIE: '会员专属通知',
    DRIVER: '限量车款优先购（依商品设置）',
    CHAMPION: '限量车款优先购、免运门槛六折',
    LEGEND: '限量车款优先购、全站免运',
  },
};

function templates(locale: Locale): Record<NotificationType, Template> {
  const tierName = (tier?: MemberTier) => TIER_NAMES[locale][tier ?? 'ROOKIE'];
  const perks = (tier?: MemberTier) => TIER_PERKS[locale][tier ?? 'ROOKIE'];
  const money = (amount?: number) => (amount ?? 0).toLocaleString('en-US');
  const byLocale: Record<Locale, Record<NotificationType, Template>> = {
    'zh-TW': {
      ORDER_PAID: (p) => ({
        title: '付款成功',
        body: `訂單 ${p.orderNo} 已收到 NT$${money(p.total)} 付款，我們會盡快安排出貨。`,
      }),
      ORDER_SHIPPED: (p) => ({
        title: '訂單已出貨',
        body: `訂單 ${p.orderNo} 已寄出，可以在訂單頁查看物流進度。`,
      }),
      ORDER_ARRIVED: (p) => ({
        title: '包裹已到店',
        body: `訂單 ${p.orderNo} 已送達 ${p.store}，請於 7 天內攜帶證件取貨。`,
      }),
      ORDER_CANCELLED: (p) => ({
        title: '訂單已取消',
        body: p.expired
          ? `付款期限已過，訂單 ${p.orderNo} 已自動取消，保留的商品已釋出。`
          : `訂單 ${p.orderNo} 已由客服取消。`,
      }),
      ORDER_REFUNDED: (p) => ({
        title: '訂單已退款',
        body: `訂單 ${p.orderNo} 已辦理退款 NT$${money(p.total)}，款項將依原付款方式退回。`,
      }),
      RELEASE_REMINDER: (p) => ({
        title: `即將開賣：${p.product}`,
        body: p.early
          ? `你的${tierName(p.tier)}優先購將於 ${p.time} 開始，記得準時上線！`
          : `${p.product} 將於 ${p.time} 開賣，記得準時上線！`,
      }),
      WISHLIST_RESTOCK: (p) => ({
        title: `補貨通知：${p.product}`,
        body: `你願望清單中的 ${p.product} 補貨了，數量有限。`,
      }),
      TIER_UPGRADED: (p) => ({
        title: `恭喜升級為${tierName(p.tier)}`,
        body: `你的會員等級已升級為${tierName(p.tier)}，現在可享：${perks(p.tier)}。`,
      }),
    },
    en: {
      ORDER_PAID: (p) => ({
        title: 'Payment received',
        body: `We received NT$${money(p.total)} for order ${p.orderNo} and will ship it soon.`,
      }),
      ORDER_SHIPPED: (p) => ({
        title: 'Your order has shipped',
        body: `Order ${p.orderNo} is on its way. Track it on the order page.`,
      }),
      ORDER_ARRIVED: (p) => ({
        title: 'Ready for pickup',
        body: `Order ${p.orderNo} has arrived at ${p.store}. Please pick it up with your ID within 7 days.`,
      }),
      ORDER_CANCELLED: (p) => ({
        title: 'Order cancelled',
        body: p.expired
          ? `Order ${p.orderNo} was cancelled because the payment deadline passed. The reserved items have been released.`
          : `Order ${p.orderNo} was cancelled by our support team.`,
      }),
      ORDER_REFUNDED: (p) => ({
        title: 'Order refunded',
        body: `Order ${p.orderNo} has been refunded (NT$${money(p.total)}) to your original payment method.`,
      }),
      RELEASE_REMINDER: (p) => ({
        title: `Dropping soon: ${p.product}`,
        body: p.early
          ? `Your ${tierName(p.tier)} early access starts at ${p.time}. Don't miss it!`
          : `${p.product} goes on sale at ${p.time}. Don't miss it!`,
      }),
      WISHLIST_RESTOCK: (p) => ({
        title: `Back in stock: ${p.product}`,
        body: `${p.product} from your wishlist is back in stock. Quantities are limited.`,
      }),
      TIER_UPGRADED: (p) => ({
        title: `You're now a ${tierName(p.tier)}`,
        body: `Your new membership perks: ${perks(p.tier)}.`,
      }),
    },
    'zh-CN': {
      ORDER_PAID: (p) => ({
        title: '付款成功',
        body: `订单 ${p.orderNo} 已收到 NT$${money(p.total)} 付款，我们会尽快安排出货。`,
      }),
      ORDER_SHIPPED: (p) => ({
        title: '订单已出货',
        body: `订单 ${p.orderNo} 已寄出，可以在订单页查看物流进度。`,
      }),
      ORDER_ARRIVED: (p) => ({
        title: '包裹已到店',
        body: `订单 ${p.orderNo} 已送达 ${p.store}，请于 7 天内携带证件取货。`,
      }),
      ORDER_CANCELLED: (p) => ({
        title: '订单已取消',
        body: p.expired
          ? `付款期限已过，订单 ${p.orderNo} 已自动取消，保留的商品已发布。`
          : `订单 ${p.orderNo} 已由客服取消。`,
      }),
      ORDER_REFUNDED: (p) => ({
        title: '订单已退款',
        body: `订单 ${p.orderNo} 已办理退款 NT$${money(p.total)}，款项将依原付款方式退回。`,
      }),
      RELEASE_REMINDER: (p) => ({
        title: `即将开卖：${p.product}`,
        body: p.early
          ? `你的${tierName(p.tier)}优先购将于 ${p.time} 开始，记得准时上线！`
          : `${p.product} 将于 ${p.time} 开卖，记得准时上线！`,
      }),
      WISHLIST_RESTOCK: (p) => ({
        title: `补货通知：${p.product}`,
        body: `你愿望清单中的 ${p.product} 补货了，数量有限。`,
      }),
      TIER_UPGRADED: (p) => ({
        title: `恭喜升级为${tierName(p.tier)}`,
        body: `你的会员等级已升级为${tierName(p.tier)}，现在可享：${perks(p.tier)}。`,
      }),
    },
  };
  return byLocale[locale];
}

/** 依會員語系產生通知標題與內容（通知在建立當下就以會員語系存好，切換語系不影響已收到的通知） */
export function renderNotification(
  type: NotificationType,
  locale: Locale,
  params: NotificationParams,
): NotificationContent {
  return templates(locale)[type](params);
}

const DATE_LOCALES: Record<Locale, string> = { 'zh-TW': 'zh-TW', en: 'en-US', 'zh-CN': 'zh-CN' };

/** 通知中的時間：台灣時間，例如「10/12 20:00」 */
export function formatNotificationTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
