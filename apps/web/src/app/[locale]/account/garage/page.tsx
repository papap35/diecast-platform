import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AddGarageItem } from '@/components/garage/add-garage-item';
import { GarageItemCard } from '@/components/garage/garage-item-card';
import { GarageShare } from '@/components/garage/garage-share';
import { GarageStats } from '@/components/garage/garage-stats';
import { pageLocale } from '@/i18n/page-locale';
import { serverApi } from '@/lib/api';
import { SITE_URL } from '@/lib/env';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/account/garage'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'garage' });
  return { title: t('title'), robots: { index: false } };
}

export default async function GaragePage({ params }: PageProps<'/[locale]/account/garage'>) {
  const locale = await pageLocale(params);
  const t = await getTranslations('garage');
  const api = await serverApi(locale);
  const { data: garage } = await api.GET('/v1/me/garage', { params: { query: { locale } } });
  if (!garage) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl sm:text-4xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-mute">{t('subtitle')}</p>
        </div>
      </div>
      <GarageStats stats={garage.stats} totalPaid={garage.totalPaid} />
      <AddGarageItem />
      {garage.items.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {garage.items.map((item) => (
            <GarageItemCard key={item.id} item={item} editable />
          ))}
        </div>
      ) : (
        <p className="rounded-3xl bg-surface p-10 text-center text-sm text-mute ring-1 ring-line">
          {t('empty')}
        </p>
      )}
      <GarageShare settings={garage.settings} siteUrl={SITE_URL} />
    </div>
  );
}
