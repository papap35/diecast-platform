import type { MemberTier, SaleType } from '../../generated/prisma/client.js';
import { meetsTier } from '../members/tiers.js';

export const Availability = {
  IN_STOCK: 'IN_STOCK',
  LOW_STOCK: 'LOW_STOCK',
  SOLD_OUT: 'SOLD_OUT',
  COMING_SOON: 'COMING_SOON',
  PREORDER_OPEN: 'PREORDER_OPEN',
  PREORDER_CLOSED: 'PREORDER_CLOSED',
} as const;
export type Availability = (typeof Availability)[keyof typeof Availability];

export const LOW_STOCK_THRESHOLD = 5;

export interface AvailabilityInput {
  saleType: SaleType;
  stock: number;
  releaseAt: Date | null;
  preorderClosesAt: Date | null;
  earlyAccessTier?: MemberTier | null;
  earlyAccessAt?: Date | null;
}

/** 優先購：已到優先購時間、尚未正式開賣，且會員等級達標 */
export function hasEarlyAccess(
  product: AvailabilityInput,
  now: Date,
  tier: MemberTier | null | undefined,
): boolean {
  return (
    !!product.earlyAccessAt &&
    !!product.earlyAccessTier &&
    product.earlyAccessAt <= now &&
    meetsTier(tier, product.earlyAccessTier)
  );
}

/**
 * 商品的販售狀態（純函式，前台顯示與結帳檢查共用同一套規則）。
 * - 開賣時間未到：COMING_SOON（限量發售、預購、以及設定了上架時間的現貨）；
 *   傳入會員等級時，符合優先購資格的會員視同已開賣
 * - 預購：開放期間內 PREORDER_OPEN，截止後 PREORDER_CLOSED，名額用完 SOLD_OUT
 * - 其餘依庫存：0 → SOLD_OUT，≤5 → LOW_STOCK，否則 IN_STOCK
 */
export function computeAvailability(
  product: AvailabilityInput,
  now: Date = new Date(),
  tier?: MemberTier | null,
): Availability {
  if (product.releaseAt && product.releaseAt > now && !hasEarlyAccess(product, now, tier)) {
    return Availability.COMING_SOON;
  }

  if (product.saleType === 'PRE_ORDER') {
    if (product.preorderClosesAt && product.preorderClosesAt <= now)
      return Availability.PREORDER_CLOSED;
    return product.stock > 0 ? Availability.PREORDER_OPEN : Availability.SOLD_OUT;
  }

  if (product.stock <= 0) return Availability.SOLD_OUT;
  if (product.stock <= LOW_STOCK_THRESHOLD) return Availability.LOW_STOCK;
  return Availability.IN_STOCK;
}

export function isPurchasable(availability: Availability): boolean {
  return (
    availability === Availability.IN_STOCK ||
    availability === Availability.LOW_STOCK ||
    availability === Availability.PREORDER_OPEN
  );
}
