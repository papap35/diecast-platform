import type { Schemas } from '@paddock64/api-client';
import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AvailabilityBadge, SaleTypeBadge } from '@/components/availability-badge';
import { WishlistButton } from '@/components/collector-buttons';
import { ClockIcon } from '@/components/icons';
import { Price } from '@/components/price';
import { ProductGallery } from '@/components/product-gallery';
import { ProductGrid } from '@/components/product-card';
import { PurchasePanel } from '@/components/purchase-panel';
import { SectionHeader } from '@/components/section-header';
import { Link } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/page-locale';
import type { AppLocale } from '@/i18n/routing';
import { serverApi } from '@/lib/api';
import { requestTime } from '@/lib/time';
import { countryName, flagEmoji, formatDate, formatDateTime } from '@/lib/format';
import { memberState } from '@/lib/member-state';
import { storeSettings } from '@/lib/store-settings';
import { localeAlternates } from '@/lib/seo';

type Product = Schemas['ProductDetailDto'];

const SPEC_KEYS = ['material', 'wheels', 'packaging', 'edition', 'features'] as const;

async function loadProduct(slug: string, locale: AppLocale): Promise<Product> {
  const api = await serverApi(locale);
  const { data } = await api.GET('/v1/products/{slug}', {
    params: { path: { slug }, query: { locale } },
  });
  if (!data) notFound();
  return data;
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/products/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await loadProduct(slug, locale as AppLocale);
  return {
    title: product.name,
    alternates: localeAlternates(locale, `/products/${slug}`),
    description: product.subtitle ?? product.description.slice(0, 120),
    openGraph: { images: product.imageUrl ? [product.imageUrl] : [] },
  };
}

/** schema.org Product，讓搜尋引擎顯示價格與庫存狀態 */
function jsonLd(product: Product) {
  const availability: Record<Product['availability'], string> = {
    IN_STOCK: 'https://schema.org/InStock',
    LOW_STOCK: 'https://schema.org/LimitedAvailability',
    SOLD_OUT: 'https://schema.org/SoldOut',
    COMING_SOON: 'https://schema.org/PreSale',
    PREORDER_OPEN: 'https://schema.org/PreOrder',
    PREORDER_CLOSED: 'https://schema.org/OutOfStock',
  };
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    image: product.images.map((image) => image.url),
    description: product.description,
    brand: { '@type': 'Brand', name: product.brand.name },
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'TWD',
      availability: availability[product.availability],
    },
  };
}

export default async function ProductPage({ params }: PageProps<'/[locale]/products/[slug]'>) {
  const locale = await pageLocale(params);
  const { slug } = await params;
  const t = await getTranslations('product');
  const tl = await getTranslations('listing');
  const product = await loadProduct(slug, locale);
  const api = await serverApi(locale);
  const [related, brand, member, settings] = await Promise.all([
    api.GET('/v1/products', {
      params: { query: { locale, brand: product.brand.slug, pageSize: 5 } },
    }),
    api.GET('/v1/brands/{slug}', {
      params: { path: { slug: product.brand.slug }, query: { locale } },
    }),
    memberState(locale),
    storeSettings(),
  ]);
  const now = requestTime();
  const saleNote =
    product.saleType === 'PRE_ORDER'
      ? t('preorderNote')
      : product.saleType === 'LIMITED' && settings
        ? t('limitedNote', { minutes: settings.limitedPaymentTimeoutMinutes })
        : null;
  const specs = SPEC_KEYS.filter((key) => product.specs[key]);
  const others = (related.data?.data ?? []).filter((p) => p.id !== product.id).slice(0, 4);

  return (
    <div className="container-page py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd(product)).replace(/</g, '\\u003c'),
        }}
      />

      <nav
        className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-mute"
        aria-label="breadcrumb"
      >
        <Link href="/products" className="hover:text-ink">
          {tl('title')}
        </Link>
        <span>/</span>
        <Link href={`/products?category=${product.category.slug}`} className="hover:text-ink">
          {product.category.name}
        </Link>
        <span>/</span>
        <span className="text-ink-2">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
        <ProductGallery images={product.images} name={product.name} />

        <div className="flex flex-col gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <SaleTypeBadge saleType={product.saleType} />
              <AvailabilityBadge
                availability={product.availability}
                remaining={product.remaining}
              />
            </div>
            <Link
              href={`/brands/${product.brand.slug}`}
              className="block text-sm font-semibold tracking-wide text-mute uppercase hover:text-ink"
            >
              {product.brand.name}
            </Link>
            <h1 className="display text-3xl leading-tight sm:text-4xl">{product.name}</h1>
            {product.subtitle ? <p className="text-ink-2">{product.subtitle}</p> : null}
            <Price price={product.price} compareAtPrice={product.compareAtPrice} size="lg" />
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line text-sm ring-1 ring-line">
            <InfoCell label={t('scale')} value={product.scale} />
            <InfoCell label={t('sku')} value={product.sku} />
            {product.releaseAt ? (
              <InfoCell label={t('releaseAt')} value={formatDateTime(product.releaseAt, locale)} />
            ) : null}
            {product.preorderClosesAt ? (
              <InfoCell
                label={t('preorderCloses')}
                value={formatDateTime(product.preorderClosesAt, locale)}
              />
            ) : null}
            {product.expectedShipAt ? (
              <InfoCell
                label={t('expectedShip')}
                value={formatDate(product.expectedShipAt, locale)}
              />
            ) : null}
            {product.purchaseLimit ? (
              <InfoCell
                label={t('limitLabel')}
                value={t('purchaseLimit', { count: product.purchaseLimit })}
              />
            ) : null}
          </dl>

          <PurchasePanel
            product={product}
            loggedIn={member.loggedIn}
            memberTier={member.tier}
            serverNow={now}
          />
          <WishlistButton productId={product.id} variant="full" className="w-full" />

          {saleNote ? (
            <p className="flex gap-2 rounded-xl bg-paper p-3 text-xs text-ink-2 ring-1 ring-line">
              <ClockIcon size={16} className="mt-0.5 shrink-0" />
              {saleNote}
            </p>
          ) : null}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">{t('description')}</h2>
            <p className="text-sm leading-7 whitespace-pre-line text-ink-2">
              {product.description}
            </p>
          </section>

          {specs.length ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">{t('specs')}</h2>
              <dl className="divide-y divide-line rounded-2xl bg-surface text-sm ring-1 ring-line">
                {specs.map((key) => (
                  <div key={key} className="flex justify-between gap-4 px-4 py-3">
                    <dt className="text-mute">{t(`specLabels.${key}`)}</dt>
                    <dd className="text-right font-medium">{product.specs[key]}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {brand.data ? (
            <Link
              href={`/brands/${brand.data.slug}`}
              className="flex items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-line transition-shadow hover:shadow-card"
            >
              {brand.data.logoUrl ? (
                <Image
                  src={brand.data.logoUrl}
                  alt=""
                  width={48}
                  height={48}
                  unoptimized
                  className="rounded-xl"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {brand.data.name}{' '}
                  <span className="font-normal text-mute">
                    {flagEmoji(brand.data.country)} {countryName(brand.data.country, locale)}
                  </span>
                </p>
                <p className="line-clamp-2 text-xs text-mute">{brand.data.description}</p>
              </div>
            </Link>
          ) : null}
        </div>
      </div>

      {others.length ? (
        <section className="mt-20">
          <SectionHeader title={t('related')} />
          <ProductGrid products={others} />
        </section>
      ) : null}
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="text-xs text-mute">{label}</dt>
      {value ? <dd className="mt-0.5 font-semibold tabular">{value}</dd> : null}
    </div>
  );
}
