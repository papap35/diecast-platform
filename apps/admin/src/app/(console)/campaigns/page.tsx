import type { paths } from '@paddock64/api-client';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PlusIcon } from '@/components/icons';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { CampaignStatusBadge } from '@/components/status-badges';
import { ButtonLink } from '@/components/ui/button';
import { serverApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { can, getAdmin } from '@/lib/permissions';

type Query = NonNullable<paths['/v1/admin/campaigns']['get']['parameters']['query']>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('campaigns');
  return { title: t('title') };
}

export default async function CampaignsPage({ searchParams }: PageProps<'/campaigns'>) {
  const t = await getTranslations('campaigns');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  if (!can(await getAdmin(), 'marketing:write')) return <NoAccess title={t('title')} />;

  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  ) as Record<string, string | undefined>;
  const query: Query = { page: Number(params.page) || 1, pageSize: 20 };
  const api = await serverApi();
  const { data } = await api.GET('/v1/admin/campaigns', { params: { query } });

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <ButtonLink href="/campaigns/new">
            <PlusIcon size={16} />
            {t('new')}
          </ButtonLink>
        }
      />
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>{t('fields.name')}</th>
                <th>{t('fields.audience')}</th>
                <th className="text-right">{t('recipients')}</th>
                <th className="text-right">{t('delivered')}</th>
                <th>{t('when')}</th>
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
              {data?.data.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-canvas">
                  <td>
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="font-semibold hover:underline"
                    >
                      {campaign.name}
                    </Link>
                    <p className="max-w-80 truncate text-xs text-mute">{campaign.subject}</p>
                  </td>
                  <td className="whitespace-nowrap text-ink-2">
                    {campaign.minTier
                      ? t('tierOrAbove', { tier: t(`tiers.${campaign.minTier}`) })
                      : t('allSubscribers')}
                  </td>
                  <td className="text-right tabular">{campaign.audienceCount}</td>
                  <td className="text-right tabular">
                    {campaign.status === 'SENT' ? (
                      <>
                        {campaign.stats.sent}
                        {campaign.stats.failed ? (
                          <span className="text-accent">
                            {' '}
                            / {t('failedShort', { count: campaign.stats.failed })}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="whitespace-nowrap text-xs text-ink-2 tabular">
                    {campaign.sentAt
                      ? formatDateTime(campaign.sentAt, locale)
                      : campaign.scheduledAt
                        ? formatDateTime(campaign.scheduledAt, locale)
                        : '—'}
                  </td>
                  <td>
                    <CampaignStatusBadge status={campaign.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data ? (
          <Pagination
            basePath="/campaigns"
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
