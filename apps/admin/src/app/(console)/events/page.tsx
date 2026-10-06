import type { paths } from '@paddock64/api-client';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PlusIcon } from '@/components/icons';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { ContentStatusBadge } from '@/components/status-badges';
import { ButtonLink, buttonClass } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { serverApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { can, getAdmin } from '@/lib/permissions';

type Query = NonNullable<paths['/v1/admin/events']['get']['parameters']['query']>;
const TYPES = ['EXHIBITION', 'MEETUP', 'LAUNCH', 'ONLINE'] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('events');
  return { title: t('title') };
}

export default async function EventsPage({ searchParams }: PageProps<'/events'>) {
  const t = await getTranslations('events');
  const tc = await getTranslations('common');
  const tContent = await getTranslations('content');
  const locale = await getLocale();
  if (!can(await getAdmin(), 'content:write')) return <NoAccess title={t('title')} />;

  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  ) as Record<string, string | undefined>;
  const query: Query = {
    page: Number(params.page) || 1,
    pageSize: 20,
    q: params.q || undefined,
    status: (params.status || undefined) as Query['status'],
    type: (params.type || undefined) as Query['type'],
  };
  const api = await serverApi();
  const { data } = await api.GET('/v1/admin/events', { params: { query } });

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <ButtonLink href="/events/new">
            <PlusIcon size={16} />
            {t('new')}
          </ButtonLink>
        }
      />
      <form method="get" className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <Input
          name="q"
          defaultValue={params.q}
          placeholder={t('searchPlaceholder')}
          className="w-64"
        />
        <Select
          name="type"
          defaultValue={params.type ?? ''}
          className="w-40"
          aria-label={t('fields.type')}
        >
          <option value="">
            {t('fields.type')}：{tc('all')}
          </option>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`types.${type}`)}
            </option>
          ))}
        </Select>
        <Select
          name="status"
          defaultValue={params.status ?? ''}
          className="w-36"
          aria-label={tc('status')}
        >
          <option value="">
            {tc('status')}：{tc('all')}
          </option>
          {(['DRAFT', 'PUBLISHED'] as const).map((status) => (
            <option key={status} value={status}>
              {tContent(`statuses.${status}`)}
            </option>
          ))}
        </Select>
        <button type="submit" className={buttonClass('primary', 'md')}>
          {tc('search')}
        </button>
        <Link href="/events" className="text-sm text-mute hover:text-ink">
          {tc('reset')}
        </Link>
      </form>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>{t('fields.title')}</th>
                <th>{t('fields.type')}</th>
                <th>{t('fields.startsAt')}</th>
                <th>{t('fields.venue')}</th>
                <th>{t('fields.product')}</th>
                <th>{tc('status')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-mute">
                    {tc('noData')}
                  </td>
                </tr>
              ) : null}
              {data?.data.map((event) => (
                <tr key={event.id} className="hover:bg-canvas">
                  <td>
                    <Link href={`/events/${event.id}`} className="font-semibold hover:underline">
                      {event.title}
                    </Link>
                    <p className="text-xs text-mute">{event.slug}</p>
                  </td>
                  <td className="whitespace-nowrap">{t(`types.${event.type}`)}</td>
                  <td className="whitespace-nowrap text-xs text-ink-2 tabular">
                    {formatDateTime(event.startsAt, locale)}
                    {event.endsAt ? (
                      <span className="block text-mute">
                        – {formatDateTime(event.endsAt, locale)}
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-48 truncate text-ink-2">{event.venue ?? '—'}</td>
                  <td className="max-w-48 truncate text-xs text-ink-2">
                    {event.product?.name ?? '—'}
                  </td>
                  <td>
                    <ContentStatusBadge status={event.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data ? (
          <Pagination
            basePath="/events"
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
