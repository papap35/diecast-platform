import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ProductGrid } from '@/components/product-card';
import { pageLocale } from '@/i18n/page-locale';
import type { AppLocale } from '@/i18n/routing';
import { serverApi } from '@/lib/api';
import { countryName, flagEmoji } from '@/lib/format';
import { localeAlternates } from '@/lib/seo';

async function loadBrand(slug: string, locale: AppLocale) {
  const api = await serverApi(locale);
  const { data } = await api.GET('/v1/brands/{slug}', {
    params: { path: { slug }, query: { locale } },
  });
  if (!data) notFound();
  return data;
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/brands/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  const brand = await loadBrand(slug, locale as AppLocale);
  return {
    title: brand.name,
    description: brand.description ?? undefined,
    alternates: localeAlternates(locale, `/brands/${slug}`),
  };
}

export default async function BrandPage({ params }: PageProps<'/[locale]/brands/[slug]'>) {
  const locale = await pageLocale(params);
  const { slug } = await params;
  const t = await getTranslations('brands');
  const brand = await loadBrand(slug, locale);
  const api = await serverApi(locale);
  const { data: products } = await api.GET('/v1/products', {
    params: { query: { locale, brand: slug, sort: 'featured', pageSize: 48 } },
  });

  return (
    <div className="container-page py-10">
      <div className="mb-12 flex flex-col gap-6 rounded-3xl bg-surface p-7 ring-1 ring-line sm:flex-row sm:items-center sm:p-10">
        {brand.logoUrl ? (
          <Image
            src={brand.logoUrl}
            alt=""
            width={96}
            height={96}
            unoptimized
            className="h-24 w-24 rounded-3xl"
          />
        ) : null}
        <div className="space-y-2">
          <p className="text-sm text-mute">
            {flagEmoji(brand.country)} {countryName(brand.country, locale)} ·{' '}
            {t('products', { count: brand.productCount })}
          </p>
          <h1 className="display text-3xl sm:text-4xl">{brand.name}</h1>
          {brand.description ? <p className="max-w-2xl text-ink-2">{brand.description}</p> : null}
        </div>
      </div>
      <ProductGrid products={products?.data ?? []} priorityCount={4} />
    </div>
  );
}
