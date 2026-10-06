import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NotificationList } from '@/components/notification-list';
import { pageLocale } from '@/i18n/page-locale';
import { serverApi } from '@/lib/api';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/account/notifications'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'notifications' });
  return { title: t('title'), robots: { index: false } };
}

export default async function NotificationsPage({
  params,
}: PageProps<'/[locale]/account/notifications'>) {
  const locale = await pageLocale(params);
  const t = await getTranslations('notifications');
  const api = await serverApi(locale);
  const { data } = await api.GET('/v1/me/notifications', { params: { query: { pageSize: 50 } } });

  return (
    <div className="space-y-6">
      <h1 className="display text-3xl sm:text-4xl">{t('title')}</h1>
      <NotificationList notifications={data?.data ?? []} unreadCount={data?.unreadCount ?? 0} />
    </div>
  );
}
