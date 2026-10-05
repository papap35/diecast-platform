import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Countdown } from '@/components/countdown';
import { ArrowRightIcon, CheckIcon } from '@/components/icons';
import { OrderActions } from '@/components/order-actions';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { Link } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/page-locale';
import { serverApi } from '@/lib/api';
import { requestTime } from '@/lib/time';
import { formatDateTime, formatPrice } from '@/lib/format';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/account/orders/[orderNo]'>): Promise<Metadata> {
  const { orderNo } = await params;
  return { title: orderNo, robots: { index: false } };
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: PageProps<'/[locale]/account/orders/[orderNo]'>) {
  const locale = await pageLocale(params);
  const { orderNo } = await params;
  const { payment } = await searchParams;
  const t = await getTranslations('orders');
  const tc = await getTranslations('checkout');
  const tcart = await getTranslations('cart');
  const api = await serverApi(locale);
  const { data: order } = await api.GET('/v1/orders/{orderNo}', { params: { path: { orderNo } } });
  if (!order) notFound();
  const now = requestTime();

  const invoiceDetail =
    order.invoiceCarrierNum ??
    order.invoiceDonationCode ??
    (order.invoiceTaxId ? `${order.invoiceTaxId} ${order.invoiceTitle ?? ''}` : null);

  return (
    <div className="space-y-6">
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-1 text-sm text-mute hover:text-ink"
      >
        <ArrowRightIcon size={16} className="rotate-180" />
        {t('back')}
      </Link>

      {payment === 'success' && order.status !== 'PENDING_PAYMENT' ? (
        <p className="flex items-center gap-2 rounded-2xl bg-ok-soft px-4 py-3 text-sm font-medium text-ok">
          <CheckIcon size={18} />
          {t('paymentSuccess')}
        </p>
      ) : null}
      {payment === 'failed' && order.status === 'PENDING_PAYMENT' ? (
        <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm font-medium text-accent">
          {t('paymentFailed')}
        </p>
      ) : null}

      <section className="space-y-5 rounded-3xl bg-surface p-6 ring-1 ring-line">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{t('orderNo')}</p>
            <h1 className="display mt-1 text-2xl tabular sm:text-3xl">{order.orderNo}</h1>
            <p className="mt-1 text-xs text-mute">
              {t('orderedAt')} {formatDateTime(order.createdAt, locale)}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        {order.canPay && order.paymentDeadline ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">
            <span>{t('payBefore', { time: formatDateTime(order.paymentDeadline, locale) })}</span>
            <span className="ml-auto flex items-center gap-2 font-semibold">
              {t('expiresIn')}
              <Countdown
                target={order.paymentDeadline}
                serverNow={now}
                variant="inline"
                onElapsedReload
              />
            </span>
          </div>
        ) : null}

        <OrderActions order={order} />
      </section>

      <section className="rounded-3xl bg-surface p-6 ring-1 ring-line">
        <h2 className="mb-4 text-base font-semibold">{t('detail')}</h2>
        <ul className="divide-y divide-line">
          {order.items.map((item) => (
            <li key={item.productId} className="flex items-center gap-4 py-3">
              <div className="relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-xl bg-paper ring-1 ring-line">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes="80px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-mute">
                  {item.sku} · {formatPrice(item.unitPrice)} × {item.quantity}
                </p>
              </div>
              <span className="text-sm font-semibold tabular">{formatPrice(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <Row label={tcart('subtotal')} value={formatPrice(order.subtotal)} />
          <Row
            label={tc('methods.' + order.shippingMethod)}
            value={order.shippingFee === 0 ? tc('methodFree') : formatPrice(order.shippingFee)}
          />
          <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
            <dt>{t('total')}</dt>
            <dd className="tabular">{formatPrice(order.total)}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-3xl bg-surface p-6 text-sm ring-1 ring-line">
          <h2 className="mb-3 text-base font-semibold">{t('shippingInfo')}</h2>
          <p className="font-medium">{tc('methods.' + order.shippingMethod)}</p>
          <p className="mt-1 text-ink-2">
            {order.recipientName} · {order.recipientPhone}
          </p>
          <p className="text-ink-2">
            {order.cvsStoreName
              ? `${order.cvsStoreName}（${order.cvsStoreId}）${order.cvsStoreAddress ?? ''}`
              : `${order.postalCode ?? ''} ${order.city ?? ''}${order.district ?? ''}${order.addressLine ?? ''}`}
          </p>
        </section>
        <section className="rounded-3xl bg-surface p-6 text-sm ring-1 ring-line">
          <h2 className="mb-3 text-base font-semibold">{t('invoiceInfo')}</h2>
          <p className="font-medium">{tc('invoiceTypes.' + order.invoiceType)}</p>
          {invoiceDetail ? <p className="mt-1 text-ink-2 tabular">{invoiceDetail}</p> : null}
          {order.payments.length ? (
            <>
              <h3 className="mt-4 mb-2 text-sm font-semibold">{t('paymentInfo')}</h3>
              <ul className="space-y-1 text-xs text-ink-2">
                {order.payments.map((p) => (
                  <li key={p.createdAt} className="flex justify-between gap-2">
                    <span>
                      {p.provider} {p.method ? `· ${p.method}` : ''}
                    </span>
                    <span>{t(`paymentStatus.${p.status}`)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>
    </div>
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
