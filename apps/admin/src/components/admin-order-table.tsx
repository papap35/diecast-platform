import type { Schemas } from '@paddock64/api-client';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { formatDateTime, formatPrice } from '@/lib/format';
import { OrderStatusBadge } from './status-badges';

export async function AdminOrderTable({
  orders,
  showMember = true,
}: {
  orders: Schemas['AdminOrderListItemDto'][];
  showMember?: boolean;
}) {
  const t = await getTranslations('orders');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th>{t('orderNo')}</th>
            {showMember ? <th>{t('member')}</th> : null}
            <th>{t('recipient')}</th>
            <th>{t('shipping')}</th>
            <th className="text-right">{t('items')}</th>
            <th className="text-right">{t('total')}</th>
            <th>{tc('status')}</th>
            <th>{t('createdAt')}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-canvas">
              <td>
                <Link
                  href={`/orders/${order.id}`}
                  className="font-semibold tabular hover:underline"
                >
                  {order.orderNo}
                </Link>
              </td>
              {showMember ? <td className="text-ink-2">{order.memberEmail}</td> : null}
              <td>{order.recipientName}</td>
              <td className="text-ink-2">{t(`methods.${order.shippingMethod}`)}</td>
              <td className="text-right tabular">{order.itemCount}</td>
              <td className="text-right font-semibold tabular">{formatPrice(order.total)}</td>
              <td>
                <OrderStatusBadge status={order.status} />
              </td>
              <td className="whitespace-nowrap text-xs text-mute tabular">
                {formatDateTime(order.createdAt, locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 ? (
        <p className="p-8 text-center text-sm text-mute">{tc('noData')}</p>
      ) : null}
    </div>
  );
}
