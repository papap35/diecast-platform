import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProductGrid } from '@/components/product-card';
import { ButtonLink } from '@/components/ui/button';
import { pageLocale } from '@/i18n/page-locale';
import { serverApi } from '@/lib/api';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/account/wishlist'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'wishlist' });
  return { title: t('title'), robots: { index: false } };
}

export default async function WishlistPage({ params }: PageProps<'/[locale]/account/wishlist'>) {
  const locale = await pageLocale(params);
  const t = await getTranslations('wishlist');
  const api = await serverApi(locale);
  const { data } = await api.GET('/v1/me/wishlist', { params: { query: { locale } } });
  const items = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl sm:text-4xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-mute">{t('subtitle')}</p>
      </div>
      {items.length ? (
        <ProductGrid products={items.map((item) => item.product)} />
      ) : (
        <div className="rounded-3xl bg-surface p-10 text-center ring-1 ring-line">
          <p className="text-sm text-mute">{t('empty')}</p>
          <ButtonLink href="/products" className="mt-5">
            {t('browse')}
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
