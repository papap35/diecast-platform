import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProductListing } from '@/components/product-listing';
import { pageLocale } from '@/i18n/page-locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/products'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'listing' });
  return { title: t('title') };
}

export default async function ProductsPage({
  params,
  searchParams,
}: PageProps<'/[locale]/products'>) {
  const locale = await pageLocale(params);
  return <ProductListing locale={locale} searchParams={await searchParams} />;
}
