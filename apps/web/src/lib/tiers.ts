import type { Schemas } from '@paddock64/api-client';

export type Tier = Schemas['MemberTier'];

/** 會員等級由低到高（與 API 相同） */
export const TIER_ORDER: readonly Tier[] = ['ROOKIE', 'DRIVER', 'CHAMPION', 'LEGEND'];

export function meetsTier(tier: Tier | null | undefined, required: Tier): boolean {
  return !!tier && TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(required);
}
