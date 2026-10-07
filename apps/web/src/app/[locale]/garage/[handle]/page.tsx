import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { GarageItemCard } from '@/components/garage/garage-item-card';
import { GarageStats } from '@/components/garage/garage-stats';
import { TrophyIcon } from '@/components/icons';
import { pageLocale } from '@/i18n/page-locale';
import { serverApi } from '@/lib/api';
import { localeAlternates } from '@/lib/seo';

async function loadGarage(handle: string, locale: string) {
  const api = await serverApi(locale);
  const { data } = await api.GET('/v1/garages/{handle}', {
    params: { path: { handle }, query: { locale: locale as 'zh-TW' } },
  });
  if (!data) notFound();
  return data;
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/garage/[handle]'>): Promise<Metadata> {
  const { locale, handle } = await params;
  const t = await getTranslations({ locale, namespace: 'garage' });
  const garage = await loadGarage(handle, locale);
  return {
    title: t('publicTitle', { handle: garage.handle }),
    alternates: localeAlternates(locale, `/garage/${garage.handle}`),
    description: t('publicSubtitle', { models: garage.stats.models, cars: garage.stats.cars }),
  };
}

/** 公開車庫：收藏清單與統計（不含購入價與備註） */
export default async function PublicGaragePage({ params }: PageProps<'/[locale]/garage/[handle]'>) {
  const locale = await pageLocale(params);
  const { handle } = await params;
  const t = await getTranslations('garage');
  const tm = await getTranslations('membership');
  const garage = await loadGarage(handle, locale);

  return (
    <div className="container-page space-y-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t('publicEyebrow')}</p>
          <h1 className="display mt-1 text-3xl sm:text-4xl">
            {t('publicTitle', { handle: garage.handle })}
          </h1>
          <p className="mt-1 text-sm text-mute">
            {t('publicSubtitle', { models: garage.stats.models, cars: garage.stats.cars })}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
          <TrophyIcon size={16} />
          {tm(`tiers.${garage.tier}`)}
        </span>
      </div>
      <GarageStats stats={garage.stats} />
      {garage.items.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {garage.items.map((item) => (
            <GarageItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <p className="rounded-3xl bg-surface p-10 text-center text-sm text-mute ring-1 ring-line">
          {t('publicEmpty')}
        </p>
      )}
    </div>
  );
}
