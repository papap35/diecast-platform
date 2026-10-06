import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { SettingsForm } from '@/components/settings-form';
import { serverApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { can, getAdmin } from '@/lib/permissions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

export default async function SettingsPage() {
  const t = await getTranslations('settings');
  const locale = await getLocale();
  const me = await getAdmin();
  if (!can(me, 'settings:write')) return <NoAccess title={t('title')} />;
  const api = await serverApi();
  const { data } = await api.GET('/v1/admin/settings');
  if (!data) return null;

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { time: formatDateTime(data.updatedAt, locale) })}
      />
      <div className="max-w-3xl">
        <SettingsForm settings={data} />
      </div>
    </>
  );
}
