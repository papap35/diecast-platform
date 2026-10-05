import type { Schemas } from '@paddock64/api-client';
import { useTranslations } from 'next-intl';
import { Badge, type Tone } from './ui/badge';

type Availability = Schemas['ProductSummaryDto']['availability'];

const TONE: Record<Availability, Tone> = {
  IN_STOCK: 'ok',
  LOW_STOCK: 'warn',
  SOLD_OUT: 'neutral',
  COMING_SOON: 'dark',
  PREORDER_OPEN: 'info',
  PREORDER_CLOSED: 'neutral',
};

export function AvailabilityBadge({
  availability,
  remaining,
  className,
}: {
  availability: Availability;
  remaining?: number | null;
  className?: string;
}) {
  const t = useTranslations('badge');
  return (
    <Badge tone={TONE[availability]} className={className}>
      {availability === 'LOW_STOCK' ? t('LOW_STOCK', { count: remaining ?? 0 }) : t(availability)}
    </Badge>
  );
}

export function SaleTypeBadge({
  saleType,
}: {
  saleType: Schemas['ProductSummaryDto']['saleType'];
}) {
  const t = useTranslations('badge');
  if (saleType === 'LIMITED') return <Badge tone="accent">{t('LIMITED')}</Badge>;
  if (saleType === 'PRE_ORDER') return <Badge tone="gold">{t('PRE_ORDER')}</Badge>;
  return null;
}
