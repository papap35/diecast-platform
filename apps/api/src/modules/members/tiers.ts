import type { MemberTier } from '../../generated/prisma/client.js';

/** 等級由低到高 */
export const TIER_ORDER: readonly MemberTier[] = ['ROOKIE', 'DRIVER', 'CHAMPION', 'LEGEND'];

/** 升級門檻：累計有效消費（新台幣）。調整時需一併更新 migration 中既有會員的換算 */
export const TIER_THRESHOLDS: Record<MemberTier, number> = {
  ROOKIE: 0,
  DRIVER: 3_000,
  CHAMPION: 8_000,
  LEGEND: 20_000,
};

/** 依累計消費計算等級；退款扣回消費後會降級 */
export function tierFor(totalSpent: number): MemberTier {
  return [...TIER_ORDER].reverse().find((tier) => totalSpent >= TIER_THRESHOLDS[tier]) ?? 'ROOKIE';
}

export function tierRank(tier: MemberTier): number {
  return TIER_ORDER.indexOf(tier);
}

/** tier 是否達到 required 以上 */
export function meetsTier(tier: MemberTier | null | undefined, required: MemberTier): boolean {
  return !!tier && tierRank(tier) >= tierRank(required);
}

export function nextTier(tier: MemberTier): MemberTier | null {
  return TIER_ORDER[tierRank(tier) + 1] ?? null;
}
