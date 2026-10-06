import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CampaignForm } from '@/components/campaign-form';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { can, getAdmin } from '@/lib/permissions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('campaigns');
  return { title: t('new') };
}

export default async function NewCampaignPage() {
  const t = await getTranslations('campaigns');
  if (!can(await getAdmin(), 'marketing:write')) return <NoAccess title={t('new')} />;
  return (
    <>
      <Link href="/campaigns" className="mb-3 inline-block text-sm text-mute hover:text-ink">
        ← {t('title')}
      </Link>
      <PageHeader title={t('new')} subtitle={t('newHint')} />
      <CampaignForm />
    </>
  );
}
