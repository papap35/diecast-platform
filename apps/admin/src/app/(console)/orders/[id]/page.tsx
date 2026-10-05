import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { FulfilmentPanel } from '@/components/fulfilment-panel';
import { OrderStatusControl } from '@/components/order-status-control';
import { PageHeader } from '@/components/page-header';
import { OrderStatusBadge } from '@/components/status-badges';
import { serverApi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime, formatPrice } from '@/lib/format';
import { can, getAdmin } from '@/lib/permissions';

/** 需要人員注意的事件，時間軸以強調色標示 */
const ALERT_EVENTS = new Set([
  'LATE_PAYMENT',
  'PAYMENT_FAILED',
  'SHIPMENT_FAILED',
  'SHIPMENT_RETURNED',
  'INVOICE_FAILED',
]);

export async function generateMetadata({ params }: PageProps<'/orders/[id]'>): Promise<Metadata> {
  const { id } = await params;
  return { title: id.slice(0, 8) };
}

export default async function OrderPage({ params }: PageProps<'/orders/[id]'>) {
  const { id } = await params;
  const t = await getTranslations('orders');
  const locale = await getLocale();
  const api = await serverApi();
  const [{ data: order }, admin] = await Promise.all([
    api.GET('/v1/admin/orders/{id}', { params: { path: { id } } }),
    getAdmin(),
  ]);
  if (!order) notFound();

  const invoiceDetail =
    order.invoiceCarrierNum ??
    order.invoiceDonationCode ??
    (order.invoiceTaxId ? `${order.invoiceTaxId} ${order.invoiceTitle ?? ''}` : null);

  return (
    <>
      <Link href="/orders" className="mb-3 inline-block text-sm text-mute hover:text-ink">
        ← {t('title')}
      </Link>
      <PageHeader
        title={order.orderNo}
        subtitle={
          <span className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} /> {t('createdAt')}{' '}
            {formatDateTime(order.createdAt, locale)}
          </span>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-5">
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-semibold">{t('detail')}</h2>
            <table className="table-base">
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.productId}>
                    <td className="w-16">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- 訂單快照中的商品圖
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-10 w-14 rounded-md object-cover ring-1 ring-line"
                        />
                      ) : null}
                    </td>
                    <td>
                      <Link
                        href={`/products/${item.productId}`}
                        className="font-medium hover:underline"
                      >
                        {item.name}
                      </Link>
                      <p className="text-xs text-mute">{item.sku}</p>
                    </td>
                    <td className="text-right text-ink-2 tabular">
                      {formatPrice(item.unitPrice)} × {item.quantity}
                    </td>
                    <td className="text-right font-semibold tabular">
                      {formatPrice(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
              <Row label={t('subtotal')} value={formatPrice(order.subtotal)} />
              <Row label={t('shippingFee')} value={formatPrice(order.shippingFee)} />
              <div className="flex justify-between text-base font-bold">
                <dt>{t('total')}</dt>
                <dd className="tabular">{formatPrice(order.total)}</dd>
              </div>
            </dl>
          </section>

          <div className="grid gap-5 md:grid-cols-3">
            <section className="card p-5 text-sm">
              <h2 className="mb-2 text-sm font-semibold">{t('customer')}</h2>
              <Link href={`/members/${order.member.id}`} className="font-medium hover:underline">
                {order.member.name}
              </Link>
              <p className="text-ink-2">{order.member.email}</p>
              <p className="text-ink-2">{order.member.phone}</p>
            </section>
            <section className="card p-5 text-sm">
              <h2 className="mb-2 text-sm font-semibold">{t('delivery')}</h2>
              <p className="font-medium">{t(`methods.${order.shippingMethod}`)}</p>
              <p className="text-ink-2">
                {order.recipientName} · {order.recipientPhone}
              </p>
              <p className="text-ink-2">
                {order.cvsStoreName
                  ? `${order.cvsStoreName}（${order.cvsStoreId}）`
                  : `${order.postalCode ?? ''} ${order.city ?? ''}${order.district ?? ''}${order.addressLine ?? ''}`}
              </p>
              {order.note ? (
                <p className="mt-2 rounded-lg bg-canvas p-2 text-xs text-ink-2">{order.note}</p>
              ) : null}
            </section>
            <section className="card p-5 text-sm">
              <h2 className="mb-2 text-sm font-semibold">{t('invoice')}</h2>
              <p className="font-medium">{t(`invoiceTypes.${order.invoiceType}`)}</p>
              {invoiceDetail ? <p className="text-ink-2 tabular">{invoiceDetail}</p> : null}
              <h3 className="mt-3 mb-1 text-xs font-semibold text-mute">{t('payments')}</h3>
              {order.payments.map((payment) => (
                <p key={payment.createdAt} className="flex justify-between text-xs">
                  <span>
                    {payment.provider}
                    {payment.method ? ` · ${payment.method}` : ''}
                  </span>
                  <span>{t(`paymentStatuses.${payment.status}`)}</span>
                </p>
              ))}
            </section>
          </div>

          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold">{t('timeline')}</h2>
            <ol className="relative flex flex-col gap-4 border-l border-line pl-5">
              {order.events.map((event) => (
                <li key={event.id} className="relative">
                  <span
                    className={cn(
                      'absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full ring-4 ring-surface',
                      ALERT_EVENTS.has(event.type)
                        ? 'bg-accent'
                        : event.type === 'NOTE'
                          ? 'bg-faint'
                          : 'bg-series-1',
                    )}
                  />
                  <p className="text-sm font-medium">
                    {t(`events.${event.type}`)}
                    {event.toStatus && event.type === 'STATUS_CHANGED'
                      ? ` → ${t(`statuses.${event.toStatus}`)}`
                      : ''}
                  </p>
                  {event.message ? <p className="text-sm text-ink-2">{event.message}</p> : null}
                  <p className="text-xs text-mute tabular">
                    {formatDateTime(event.createdAt, locale)} · {t(`actors.${event.actorType}`)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div className="flex flex-col gap-5 xl:sticky xl:top-6 xl:self-start">
          <FulfilmentPanel order={order} canWrite={can(admin, 'order:write')} />
          <OrderStatusControl
            orderId={order.id}
            nextStatuses={order.nextStatuses}
            canWrite={can(admin, 'order:write')}
          />
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-mute">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
