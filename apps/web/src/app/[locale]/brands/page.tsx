import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/page-locale';
import { serverApi } from '@/lib/api';
import { countryName, flagEmoji } from '@/lib/format';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/brands'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'brands' });
  return { title: t('title'), description: t('subtitle') };
}

export default async function BrandsPage({ params }: PageProps<'/[locale]/brands'>) {
  const locale = await pageLocale(params);
  const t = await getTranslations('brands');
  const api = await serverApi(locale);
  const { data: brands } = await api.GET('/v1/brands', { params: { query: { locale } } });

  return (
    <div className="container-page py-10">
      <h1 className="display text-3xl sm:text-4xl">{t('title')}</h1>
      <p className="mt-1 mb-10 text-sm text-mute">{t('subtitle')}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(brands ?? []).map((brand) => (
          <Link
            key={brand.id}
            href={`/brands/${brand.slug}`}
            className="flex gap-4 rounded-3xl bg-surface p-6 ring-1 ring-line transition-shadow hover:shadow-lift"
          >
            {brand.logoUrl ? (
              <Image
                src={brand.logoUrl}
                alt=""
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 rounded-2xl"
              />
            ) : null}
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">{brand.name}</p>
              <p className="text-xs text-mute">
                {flagEmoji(brand.country)} {countryName(brand.country, locale)} ·{' '}
                {t('products', { count: brand.productCount })}
              </p>
              <p className="line-clamp-3 text-sm text-ink-2">{brand.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
