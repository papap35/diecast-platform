import type { Schemas } from '@paddock64/api-client';
import { useTranslations } from 'next-intl';
import { Badge, type Tone } from './ui/badge';

type OrderStatus = Schemas['OrderDto']['status'];
type ProductStatus = Schemas['AdminProductDto']['status'];
type Availability = Schemas['AdminProductDto']['availability'];
type MemberStatus = Schemas['AdminMemberDto']['status'];

const ORDER_TONE: Record<OrderStatus, Tone> = {
  PENDING_PAYMENT: 'warn',
  PAID: 'info',
  PROCESSING: 'info',
  SHIPPED: 'dark',
  COMPLETED: 'ok',
  CANCELLED: 'neutral',
  REFUNDED: 'neutral',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations('orders.statuses');
  return <Badge tone={ORDER_TONE[status]}>{t(status)}</Badge>;
}

const PRODUCT_TONE: Record<ProductStatus, Tone> = {
  DRAFT: 'neutral',
  ACTIVE: 'ok',
  ARCHIVED: 'neutral',
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const t = useTranslations('products.statuses');
  return <Badge tone={PRODUCT_TONE[status]}>{t(status)}</Badge>;
}

const AVAILABILITY_TONE: Record<Availability, Tone> = {
  IN_STOCK: 'ok',
  LOW_STOCK: 'warn',
  SOLD_OUT: 'neutral',
  COMING_SOON: 'dark',
  PREORDER_OPEN: 'info',
  PREORDER_CLOSED: 'neutral',
};

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  const t = useTranslations('products.availabilities');
  return <Badge tone={AVAILABILITY_TONE[availability]}>{t(availability)}</Badge>;
}

const MEMBER_TONE: Record<MemberStatus, Tone> = {
  ACTIVE: 'ok',
  SUSPENDED: 'accent',
  DELETED: 'neutral',
};

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  const t = useTranslations('members.statuses');
  return <Badge tone={MEMBER_TONE[status]}>{t(status)}</Badge>;
}

type ContentStatus = Schemas['AdminEventDto']['status'];
type BannerState = Schemas['AdminBannerDto']['state'];

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  const t = useTranslations('content.statuses');
  return <Badge tone={status === 'PUBLISHED' ? 'ok' : 'neutral'}>{t(status)}</Badge>;
}

const BANNER_TONE: Record<BannerState, Tone> = {
  LIVE: 'ok',
  SCHEDULED: 'info',
  DRAFT: 'neutral',
  ENDED: 'neutral',
};

export function BannerStateBadge({ state }: { state: BannerState }) {
  const t = useTranslations('banners.states');
  return <Badge tone={BANNER_TONE[state]}>{t(state)}</Badge>;
}

type CouponState = Schemas['AdminCouponDto']['state'];

const COUPON_TONE: Record<CouponState, Tone> = {
  ACTIVE: 'ok',
  SCHEDULED: 'info',
  EXPIRED: 'neutral',
  DISABLED: 'neutral',
  USED_UP: 'warn',
};

export function CouponStateBadge({ state }: { state: CouponState }) {
  const t = useTranslations('coupons.states');
  return <Badge tone={COUPON_TONE[state]}>{t(state)}</Badge>;
}

type CampaignStatus = Schemas['CampaignDto']['status'];

const CAMPAIGN_TONE: Record<CampaignStatus, Tone> = {
  DRAFT: 'neutral',
  SCHEDULED: 'info',
  SENDING: 'warn',
  SENT: 'ok',
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const t = useTranslations('campaigns.statuses');
  return <Badge tone={CAMPAIGN_TONE[status]}>{t(status)}</Badge>;
}
