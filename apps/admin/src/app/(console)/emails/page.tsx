import type { paths } from '@paddock64/api-client';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { RetryFailedButton } from '@/components/email-actions';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { EmailStatusBadge } from '@/components/status-badges';
import { buttonClass } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { serverApi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { can, getAdmin } from '@/lib/permissions';

type Query = NonNullable<paths['/v1/admin/emails']['get']['parameters']['query']>;

const STATUSES = ['PENDING', 'SENT', 'FAILED'] as const;
const KINDS = ['NOTIFICATION', 'CAMPAIGN', 'OTHER'] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('emails');
  return { title: t('title') };
}

export default async function EmailsPage({ searchParams }: PageProps<'/emails'>) {
  const t = await getTranslations('emails');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  if (!can(await getAdmin(), 'admin:manage')) return <NoAccess title={t('title')} />;

  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  ) as Record<string, string | undefined>;
  const status = STATUSES.find((s) => s === params.status);
  const kind = KINDS.find((k) => k === params.kind);
  const query: Query = {
    page: Number(params.page) || 1,
    pageSize: 30,
    status,
    kind,
    q: params.q?.trim() || undefined,
  };
  const api = await serverApi();
  const { data } = await api.GET('/v1/admin/emails', { params: { query } });
  const stats = data?.stats ?? { pending: 0, sent: 0, failed: 0 };
  const tiles = [
    { status: 'PENDING', count: stats.pending },
    { status: 'SENT', count: stats.sent },
    { status: 'FAILED', count: stats.failed },
  ] as const;

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={<RetryFailedButton count={stats.failed} />}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.status}
            href={status === tile.status ? '/emails' : `/emails?status=${tile.status}`}
            aria-current={status === tile.status ? 'true' : undefined}
            className={cn(
              'card flex items-baseline justify-between gap-3 p-4 transition-shadow hover:ring-1 hover:ring-line-strong',
              status === tile.status && 'ring-2 ring-ink',
            )}
          >
            <span className="text-xs font-medium text-mute">{t(`statuses.${tile.status}`)}</span>
            <span
              className={cn(
                'text-2xl font-semibold tabular',
                tile.status === 'FAILED' && tile.count > 0 && 'text-accent',
              )}
            >
              {tile.count.toLocaleString('en-US')}
            </span>
          </Link>
        ))}
      </div>

      <form method="get" className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <Input
          name="q"
          defaultValue={params.q}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="w-64"
        />
        <Select
          name="status"
          defaultValue={status ?? ''}
          className="w-36"
          aria-label={tc('status')}
        >
          <option value="">
            {tc('status')}：{tc('all')}
          </option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`statuses.${value}`)}
            </option>
          ))}
        </Select>
        <Select name="kind" defaultValue={kind ?? ''} className="w-36" aria-label={t('kind')}>
          <option value="">
            {t('kind')}：{tc('all')}
          </option>
          {KINDS.map((value) => (
            <option key={value} value={value}>
              {t(`kinds.${value}`)}
            </option>
          ))}
        </Select>
        <button type="submit" className={buttonClass('primary', 'md')}>
          {tc('search')}
        </button>
        <Link href="/emails" className="text-sm text-mute hover:text-ink">
          {tc('reset')}
        </Link>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>{tc('createdAt')}</th>
                <th>{t('to')}</th>
                <th>{t('subject')}</th>
                <th>{t('kind')}</th>
                <th>{tc('status')}</th>
                <th>{t('result')}</th>
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
              {data?.data.map((email) => (
                <tr key={email.id} className="hover:bg-canvas">
                  <td className="whitespace-nowrap text-xs text-mute tabular">
                    {formatDateTime(email.createdAt, locale)}
                  </td>
                  <td className="max-w-56 truncate text-ink-2">{email.to}</td>
                  <td className="max-w-80">
                    <Link
                      href={`/emails/${email.id}`}
                      className="block truncate font-semibold hover:underline"
                    >
                      {email.subject}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-xs text-ink-2">
                    {t(`kinds.${email.kind}`)}
                  </td>
                  <td className="whitespace-nowrap">
                    <EmailStatusBadge status={email.status} />
                  </td>
                  <td className="max-w-64 text-xs">
                    {email.status === 'SENT' && email.sentAt ? (
                      <span className="text-mute tabular">
                        {formatDateTime(email.sentAt, locale)}
                      </span>
                    ) : email.status === 'PENDING' && email.nextAttemptAt ? (
                      <span className="text-warn">
                        {t('nextAttempt', { time: formatDateTime(email.nextAttemptAt, locale) })}
                      </span>
                    ) : email.status === 'FAILED' ? (
                      <span
                        className="block truncate text-accent"
                        title={email.lastError ?? undefined}
                      >
                        {t('attemptsFailed', { count: email.attempts })}
                        {email.lastError ? ` · ${email.lastError}` : ''}
                      </span>
                    ) : (
                      <span className="text-mute">{t('waiting')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data ? (
          <Pagination
            basePath="/emails"
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
