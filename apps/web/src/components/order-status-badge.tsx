import type { Schemas } from '@paddock64/api-client';
import { useTranslations } from 'next-intl';
import { Badge, type Tone } from './ui/badge';

type Status = Schemas['OrderDto']['status'];

const TONE: Record<Status, Tone> = {
  PENDING_PAYMENT: 'warn',
  PAID: 'info',
  PROCESSING: 'info',
  SHIPPED: 'dark',
  COMPLETED: 'ok',
  CANCELLED: 'neutral',
  REFUNDED: 'neutral',
};

export function OrderStatusBadge({ status }: { status: Status }) {
  const t = useTranslations('orders.status');
  return <Badge tone={TONE[status]}>{t(status)}</Badge>;
}
