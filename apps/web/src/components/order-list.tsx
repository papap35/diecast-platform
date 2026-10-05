import type { Schemas } from '@paddock64/api-client';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatDateTime, formatPrice } from '@/lib/format';
import { OrderStatusBadge } from './order-status-badge';

export function OrderList({ orders }: { orders: Schemas['OrderSummaryDto'][] }) {
  const t = useTranslations('orders');
  const locale = useLocale();
  if (orders.length === 0) {
    return (
      <p className="rounded-3xl bg-surface p-10 text-center text-sm text-mute ring-1 ring-line">
        {t('empty')}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
      {orders.map((order) => (
        <li key={order.id}>
          <Link
            href={`/account/orders/${order.orderNo}`}
            className="flex items-center gap-4 p-4 hover:bg-paper sm:p-5"
          >
            <div className="relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-xl bg-paper ring-1 ring-line">
              {order.firstItemImageUrl ? (
                <Image
                  src={order.firstItemImageUrl}
                  alt=""
                  fill
                  unoptimized
                  sizes="80px"
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold tabular">{order.orderNo}</span>
                <OrderStatusBadge status={order.status} />
              </div>
              <p className="mt-1 truncate text-sm text-ink-2">
                {order.firstItemName}
                {order.itemCount > 1 ? ` · ${t('items', { count: order.itemCount })}` : ''}
              </p>
              <p className="text-xs text-mute">{formatDateTime(order.createdAt, locale)}</p>
            </div>
            <span className="text-sm font-bold tabular">{formatPrice(order.total)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
