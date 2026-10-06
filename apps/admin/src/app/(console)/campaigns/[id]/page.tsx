import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CampaignActions, CampaignForm } from '@/components/campaign-form';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { StatTile } from '@/components/stat-tile';
import { CampaignStatusBadge } from '@/components/status-badges';
import { serverApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { can, getAdmin } from '@/lib/permissions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('campaigns');
  return { title: t('editTitle') };
}

export default async function CampaignPage({ params, searchParams }: PageProps<'/campaigns/[id]'>) {
  const t = await getTranslations('campaigns');
  const locale = await getLocale();
  if (!can(await getAdmin(), 'marketing:write')) return <NoAccess title={t('title')} />;
  const { id } = await params;
  const { created } = await searchParams;
  const api = await serverApi();
  const { data: campaign } = await api.GET('/v1/admin/campaigns/{id}', {
    params: { path: { id } },
  });
  if (!campaign) notFound();
  const sentLike = campaign.status === 'SENDING' || campaign.status === 'SENT';

  return (
    <>
      <Link href="/campaigns" className="mb-3 inline-block text-sm text-mute hover:text-ink">
        ← {t('title')}
      </Link>
      <PageHeader
        title={campaign.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <CampaignStatusBadge status={campaign.status} />
            {campaign.status === 'SCHEDULED' && campaign.scheduledAt
              ? t('scheduledFor', { time: formatDateTime(campaign.scheduledAt, locale) })
              : null}
            {campaign.sentAt
              ? t('sentAt', { time: formatDateTime(campaign.sentAt, locale) })
              : null}
          </span>
        }
      />
      {created ? (
        <p role="status" className="mb-4 rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">
          {t('created')}
        </p>
      ) : null}
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <StatTile
          label={sentLike ? t('recipients') : t('audienceNow')}
          value={String(campaign.audienceCount)}
        />
        <StatTile label={t('stats.sent')} value={String(campaign.stats.sent)} />
        <StatTile label={t('stats.pending')} value={String(campaign.stats.pending)} />
        <StatTile label={t('stats.failed')} value={String(campaign.stats.failed)} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <CampaignForm key={campaign.updatedAt} campaign={campaign} />
        <div className="xl:sticky xl:top-6 xl:self-start">
          <CampaignActions key={`${campaign.status}-${campaign.updatedAt}`} campaign={campaign} />
        </div>
      </div>
    </>
  );
}
