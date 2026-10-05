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
