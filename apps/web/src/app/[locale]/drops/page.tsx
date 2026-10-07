import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProductListing } from '@/components/product-listing';
import { pageLocale } from '@/i18n/page-locale';
import { localeAlternates } from '@/lib/seo';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/drops'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'listing' });
  return { title: t('dropsTitle'), alternates: localeAlternates(locale, '/drops') };
}

export default async function DropsPage({ params, searchParams }: PageProps<'/[locale]/drops'>) {
  const locale = await pageLocale(params);
  const t = await getTranslations('listing');
  return (
    <ProductListing
      locale={locale}
      searchParams={await searchParams}
      title={t('dropsTitle')}
      fixed={{ saleType: 'LIMITED' }}
    />
  );
}
