import type { MemberTier } from '../../generated/prisma/client.js';
import { freeShippingThreshold } from '../orders/order-rules.js';
import type { MembershipDto, TierInfoDto } from './dto/membership.dto.js';
import { nextTier, TIER_ORDER, TIER_THRESHOLDS, tierRank } from './tiers.js';

/** 各等級門檻與權益（前台會員中心、等級說明頁共用） */
export function tierTable(): TierInfoDto[] {
  return TIER_ORDER.map((tier) => ({
    tier,
    threshold: TIER_THRESHOLDS[tier],
    homeFreeShipping: freeShippingThreshold('HOME_DELIVERY', tier),
    cvsFreeShipping: freeShippingThreshold('CVS_711', tier),
    earlyAccess: tierRank(tier) >= tierRank('DRIVER'),
  }));
}

export function toMembership(member: {
  tier: MemberTier;
  totalSpent: number;
  tierUpdatedAt: Date | null;
}): MembershipDto {
  const next = nextTier(member.tier);
  return {
    tier: member.tier,
    totalSpent: member.totalSpent,
    tierUpdatedAt: member.tierUpdatedAt,
    next: next
      ? {
          tier: next,
          threshold: TIER_THRESHOLDS[next],
          remaining: Math.max(0, TIER_THRESHOLDS[next] - member.totalSpent),
        }
      : null,
    tiers: tierTable(),
  };
}
