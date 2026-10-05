import type { paths } from '@paddock64/api-client';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { MemberStatusBadge } from '@/components/status-badges';
import { buttonClass } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { serverApi } from '@/lib/api';
import { formatDateTime, formatPrice } from '@/lib/format';

type Query = NonNullable<paths['/v1/admin/members']['get']['parameters']['query']>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('members');
  return { title: t('title') };
}

export default async function MembersPage({ searchParams }: PageProps<'/members'>) {
  const t = await getTranslations('members');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  ) as Record<string, string | undefined>;
  const query: Query = {
    page: Number(params.page) || 1,
    pageSize: 25,
    q: params.q || undefined,
    status: (params.status || undefined) as Query['status'],
  };
  const api = await serverApi();
  const { data } = await api.GET('/v1/admin/members', { params: { query } });

  return (
    <>
      <PageHeader title={t('title')} />
      <form method="get" className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <Input
          name="q"
          defaultValue={params.q}
          placeholder={t('searchPlaceholder')}
          className="w-72"
        />
        <Select
          name="status"
          defaultValue={params.status ?? ''}
          className="w-40"
          aria-label={tc('status')}
        >
          <option value="">
            {tc('status')}：{tc('all')}
          </option>
          {(['ACTIVE', 'SUSPENDED', 'DELETED'] as const).map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </Select>
        <button type="submit" className={buttonClass('primary', 'md')}>
          {tc('search')}
        </button>
        <Link href="/members" className="text-sm text-mute hover:text-ink">
          {tc('reset')}
        </Link>
      </form>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('email')}</th>
                <th>{t('phone')}</th>
                <th className="text-right">{t('orderCount')}</th>
                <th className="text-right">{t('totalSpent')}</th>
                <th>{tc('status')}</th>
                <th>{t('lastLogin')}</th>
                <th>{t('joined')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((member) => (
                <tr key={member.id} className="hover:bg-canvas">
                  <td>
                    <Link href={`/members/${member.id}`} className="font-semibold hover:underline">
                      {member.name}
                    </Link>
                  </td>
                  <td className="text-ink-2">{member.email}</td>
                  <td className="text-ink-2 tabular">{member.phone ?? '—'}</td>
                  <td className="text-right tabular">{member.orderCount}</td>
                  <td className="text-right font-semibold tabular">
                    {formatPrice(member.totalSpent)}
                  </td>
                  <td>
                    <MemberStatusBadge status={member.status} />
                  </td>
                  <td className="whitespace-nowrap text-xs text-mute tabular">
                    {member.lastLoginAt ? formatDateTime(member.lastLoginAt, locale) : '—'}
                  </td>
                  <td className="whitespace-nowrap text-xs text-mute tabular">
                    {formatDateTime(member.createdAt, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data ? (
          <Pagination
            basePath="/members"
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
