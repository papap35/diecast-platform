import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import type {
  CouponType,
  MemberTier,
  SaleType,
  ShippingMethod,
} from '../../generated/prisma/client.js';
import { meetsTier } from '../members/tiers.js';
import { calculateShippingFee, type ShippingRates } from '../orders/order-rules.js';

/** 計價需要的優惠券規則（使用次數另外由資料庫檢查） */
export interface CouponRule {
  type: CouponType;
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  minTier: MemberTier | null;
  appliesToLimited: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export interface PricingLine {
  saleType: SaleType;
  lineTotal: number;
}

export interface OrderPricing {
  subtotal: number;
  /** 優惠券折抵的商品金額 */
  discount: number;
  /** 每一列分攤到的折扣（順序與輸入相同） */
  lineDiscounts: number[];
  shippingFee: number;
  /** 免運券省下的運費 */
  shippingDiscount: number;
  total: number;
}

/**
 * 訂單計價。折扣只折商品、不折運費；滿額免運以折扣後的商品金額判斷。
 * 限量商品預設不適用優惠券（優惠券可設定為適用）。規則不符時丟出對應的錯誤代碼。
 */
export function priceOrder(
  lines: PricingLine[],
  method: ShippingMethod,
  tier: MemberTier,
  rates: ShippingRates,
  coupon?: CouponRule,
  now = new Date(),
): OrderPricing {
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  if (!coupon) {
    const shippingFee = calculateShippingFee(method, subtotal, tier, rates);
    return {
      subtotal,
      discount: 0,
      lineDiscounts: lines.map(() => 0),
      shippingFee,
      shippingDiscount: 0,
      total: subtotal + shippingFee,
    };
  }

  if (
    !coupon.isActive ||
    (coupon.startsAt && coupon.startsAt > now) ||
    (coupon.endsAt && coupon.endsAt <= now)
  ) {
    throw AppException.badRequest(ErrorCode.COUPON_UNAVAILABLE, '這張優惠券目前不能使用');
  }
  if (coupon.minTier && !meetsTier(tier, coupon.minTier)) {
    throw AppException.badRequest(ErrorCode.COUPON_TIER_REQUIRED, '會員等級未達優惠券的使用資格', {
      minTier: coupon.minTier,
    });
  }
  const eligible = lines.map((line) => coupon.appliesToLimited || line.saleType !== 'LIMITED');
  const eligibleSubtotal = lines.reduce(
    (sum, line, index) => sum + (eligible[index] ? line.lineTotal : 0),
    0,
  );
  if (eligibleSubtotal === 0) {
    throw AppException.badRequest(
      ErrorCode.COUPON_NOT_APPLICABLE,
      '購物車中沒有適用這張優惠券的商品',
    );
  }
  if (eligibleSubtotal < coupon.minSubtotal) {
    throw AppException.badRequest(ErrorCode.COUPON_MIN_SUBTOTAL, '未達優惠券的使用門檻', {
      minSubtotal: coupon.minSubtotal,
      eligibleSubtotal,
    });
  }

  if (coupon.type === 'FREE_SHIPPING') {
    const shippingDiscount = calculateShippingFee(method, subtotal, tier, rates);
    if (shippingDiscount === 0) {
      throw AppException.badRequest(
        ErrorCode.COUPON_NOT_APPLICABLE,
        '這筆訂單已經免運，不需要使用免運券',
      );
    }
    return {
      subtotal,
      discount: 0,
      lineDiscounts: lines.map(() => 0),
      shippingFee: 0,
      shippingDiscount,
      total: subtotal,
    };
  }

  const raw =
    coupon.type === 'FIXED' ? coupon.value : Math.floor((eligibleSubtotal * coupon.value) / 100);
  const discount = Math.min(raw, coupon.maxDiscount ?? Infinity, eligibleSubtotal);
  const shippingFee = calculateShippingFee(method, subtotal - discount, tier, rates);
  return {
    subtotal,
    discount,
    lineDiscounts: allocateDiscount(
      discount,
      lines.map((line, index) => ({ amount: line.lineTotal, eligible: eligible[index]! })),
    ),
    shippingFee,
    shippingDiscount: 0,
    total: subtotal - discount + shippingFee,
  };
}

/**
 * 把折扣依金額比例分攤到適用的各列（最大餘數法）：
 * 每列先取整數部分，剩下的 1 元依小數部分由大到小補上，加總剛好等於折扣。
 */
export function allocateDiscount(
  discount: number,
  lines: { amount: number; eligible: boolean }[],
): number[] {
  const base = lines.reduce((sum, line) => sum + (line.eligible ? line.amount : 0), 0);
  if (discount <= 0 || base === 0) return lines.map(() => 0);
  const exact = lines.map((line) => (line.eligible ? (discount * line.amount) / base : 0));
  const shares = exact.map(Math.floor);
  let remainder = discount - shares.reduce((sum, share) => sum + share, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - shares[index]! }))
    .filter(({ index }) => lines[index]!.eligible)
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of order) {
    if (remainder <= 0) break;
    shares[index]! += 1;
    remainder -= 1;
  }
  return shares;
}

/**
 * 發票品項的單價必須是整數：實收金額除不盡數量時拆成兩列，
 * 例如 3 件共 1,097 元 → 2 件 × 366 + 1 件 × 365。
 */
export function splitInvoiceLine(
  quantity: number,
  amount: number,
): { quantity: number; unitPrice: number }[] {
  const unitPrice = Math.floor(amount / quantity);
  const extra = amount - unitPrice * quantity;
  if (extra === 0) return [{ quantity, unitPrice }];
  return [
    { quantity: extra, unitPrice: unitPrice + 1 },
    { quantity: quantity - extra, unitPrice },
  ];
}
