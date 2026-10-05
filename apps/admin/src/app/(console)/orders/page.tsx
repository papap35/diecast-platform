import type { paths } from '@paddock64/api-client';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AdminOrderTable } from '@/components/admin-order-table';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { buttonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { serverApi } from '@/lib/api';
import { fromTaipeiInput } from '@/lib/format';

type Query = NonNullable<paths['/v1/admin/orders']['get']['parameters']['query']>;
const STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('orders');
  return { title: t('title') };
}

export default async function OrdersPage({ searchParams }: PageProps<'/orders'>) {
  const t = await getTranslations('orders');
  const tc = await getTranslations('common');
  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  ) as Record<string, string | undefined>;
  const query: Query = {
    page: Number(params.page) || 1,
    pageSize: 25,
    q: params.q || undefined,
    status: (params.status || undefined) as Query['status'],
    from: params.from ? (fromTaipeiInput(`${params.from}T00:00`) ?? undefined) : undefined,
    to: params.to ? (fromTaipeiInput(`${params.to}T23:59`) ?? undefined) : undefined,
  };
  const api = await serverApi();
  const { data } = await api.GET('/v1/admin/orders', { params: { query } });

  return (
    <>
      <PageHeader title={t('title')} />
      <div className="mb-4 flex flex-wrap gap-2">
        {[undefined, ...STATUSES].map((status) => {
          const active = (params.status ?? undefined) === status;
          const qs = new URLSearchParams();
          if (status) qs.set('status', status);
          if (params.q) qs.set('q', params.q);
          return (
            <Link
              key={status ?? 'all'}
              href={qs.size ? `/orders?${qs}` : '/orders'}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${active ? 'bg-ink text-white ring-ink' : 'bg-surface text-ink-2 ring-line hover:ring-ink'}`}
            >
              {status ? t(`statuses.${status}`) : tc('all')}
            </Link>
          );
        })}
      </div>
      <form method="get" className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
        <Input
          name="q"
          defaultValue={params.q}
          placeholder={t('searchPlaceholder')}
          className="w-72"
        />
        <label className="flex items-center gap-2 text-xs text-mute">
          {t('from')}
          <Input type="date" name="from" defaultValue={params.from} className="w-40" />
        </label>
        <label className="flex items-center gap-2 text-xs text-mute">
          {t('to')}
          <Input type="date" name="to" defaultValue={params.to} className="w-40" />
        </label>
        <button type="submit" className={buttonClass('primary', 'md')}>
          {tc('search')}
        </button>
        <Link href="/orders" className="text-sm text-mute hover:text-ink">
          {tc('reset')}
        </Link>
      </form>
      <div className="card overflow-hidden">
        <AdminOrderTable orders={data?.data ?? []} />
        {data ? (
          <Pagination
            basePath="/orders"
            params={params}
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
          />
        ) : null}
      </div>
    </>
  );
}
