import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { RevenueChart } from '@/components/revenue-chart';
import { StatTile } from '@/components/stat-tile';
import { OrderStatusBadge } from '@/components/status-badges';
import { Badge } from '@/components/ui/badge';
import { serverApi } from '@/lib/api';
import { compactNumber, formatDateTime, formatPrice } from '@/lib/format';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard');
  return { title: t('title') };
}

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  const tp = await getTranslations('products');
  const locale = await getLocale();
  const api = await serverApi();
  const { data } = await api.GET('/v1/admin/dashboard');
  if (!data) return null;
  const { kpis } = data;

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t('todayRevenue')}
          value={formatPrice(kpis.todayRevenue)}
          detail={t('todayOrders', { count: kpis.todayOrders })}
        />
        <StatTile
          label={t('revenue30d')}
          value={`NT$${compactNumber(kpis.revenue30d, locale)}`}
          detail={t('orders30d', { count: kpis.orders30d })}
        />
        <StatTile
          label={t('toShip')}
          value={String(kpis.toShipCount)}
          detail={`${t('toShipHint')} · ${t('pendingPayment', { count: kpis.pendingPaymentCount })}`}
        />
        <StatTile
          label={t('members')}
          value={kpis.totalMembers.toLocaleString('en-US')}
          detail={t('newMembers', { count: kpis.newMembers30d })}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
        <RevenueChart data={data.salesTrend} locale={locale} />
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">{t('topProducts')}</h2>
          {data.topProducts.length === 0 ? (
            <p className="py-6 text-center text-sm text-mute">—</p>
          ) : (
            <ol className="flex flex-col divide-y divide-line">
              {data.topProducts.map((product, index) => (
                <li key={product.productId} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 text-xs font-semibold text-mute tabular">{index + 1}</span>
                  <Link
                    href={`/products/${product.productId}`}
                    className="min-w-0 flex-1 truncate text-sm hover:underline"
                  >
                    {product.name}
                  </Link>
                  <span className="text-xs text-mute tabular">×{product.quantity}</span>
                  <span className="w-20 text-right text-sm font-semibold tabular">
                    {formatPrice(product.revenue)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-2 rounded-xl bg-canvas p-3">
            <p className="text-xs text-mute">
              {t('aov')}（{t('aovHint')}）
            </p>
            <p className="text-lg font-semibold">{formatPrice(kpis.averageOrderValue30d)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">{t('lowStock')}</h2>
          <ul className="divide-y divide-line">
            {data.lowStock.map((product) => (
              <li
                key={product.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <Link href={`/products/${product.id}`} className="min-w-0 truncate hover:underline">
                  {product.name}
                </Link>
                <Badge tone={product.stock === 0 ? 'accent' : 'warn'}>
                  {t('stock')} {product.stock}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">{t('upcoming')}</h2>
          <ul className="divide-y divide-line">
            {data.upcomingReleases.map((product) => (
              <li
                key={product.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <Link href={`/products/${product.id}`} className="block truncate hover:underline">
                    {product.name}
                  </Link>
                  <p className="text-xs text-mute">
                    {tp(`saleTypes.${product.saleType}`)} · {t('stock')} {product.stock}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-ink-2 tabular">
                  {formatDateTime(product.releaseAt, locale)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-sm font-semibold">{t('recentOrders')}</h2>
          <Link href="/orders" className="text-xs font-semibold text-mute hover:text-ink">
            {t('viewAll')} →
          </Link>
        </div>
        <RecentOrders orders={data.recentOrders} locale={locale} />
      </div>
    </>
  );
}

async function RecentOrders({
  orders,
  locale,
}: {
  orders: {
    id: string;
    orderNo: string;
    status: Parameters<typeof OrderStatusBadge>[0]['status'];
    total: number;
    memberEmail: string;
    createdAt: string;
  }[];
  locale: string;
}) {
  const t = await getTranslations('orders');
  const tc = await getTranslations('common');
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th>{t('orderNo')}</th>
            <th>{t('member')}</th>
            <th>{t('createdAt')}</th>
            <th>{tc('status')}</th>
            <th className="text-right">{t('total')}</th>
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
              <td className="text-ink-2">{order.memberEmail}</td>
              <td className="text-mute tabular">{formatDateTime(order.createdAt, locale)}</td>
              <td>
                <OrderStatusBadge status={order.status} />
              </td>
              <td className="text-right font-semibold tabular">{formatPrice(order.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
