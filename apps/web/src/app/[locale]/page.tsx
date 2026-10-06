import type { paths, Schemas } from '@paddock64/api-client';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { AvailabilityBadge } from '@/components/availability-badge';
import { Countdown } from '@/components/countdown';
import { ArrowRightIcon, ShieldIcon, StoreIcon, FlagIcon } from '@/components/icons';
import { Price } from '@/components/price';
import { ProductGrid } from '@/components/product-card';
import { SectionHeader, ViewAllLink } from '@/components/section-header';
import { ButtonLink } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/page-locale';
import { serverApi } from '@/lib/api';
import { requestTime } from '@/lib/time';
import { flagEmoji } from '@/lib/format';

type Product = Schemas['ProductSummaryDto'];
type ProductQuery = NonNullable<paths['/v1/products']['get']['parameters']['query']>;

/** 首頁主視覺：優先顯示「發售中」的限量商品，否則顯示最近一檔即將開賣的 */
function pickHero(drops: Product[], now: number): Product | undefined {
  const live = drops.find(
    (p) => p.releaseAt && new Date(p.releaseAt).getTime() <= now && p.availability !== 'SOLD_OUT',
  );
  return live ?? drops.find((p) => p.availability === 'COMING_SOON');
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const locale = await pageLocale(params);
  const t = await getTranslations('home');
  const api = await serverApi(locale);
  const products = (query: ProductQuery) =>
    api.GET('/v1/products', { params: { query: { locale, ...query } } });

  const [drops, upcoming, arrivals, preorders, local, brands, categories] = await Promise.all([
    products({ saleType: 'LIMITED', sort: 'release', pageSize: 10 }),
    products({ availability: 'upcoming', sort: 'release', pageSize: 4 }),
    products({ availability: 'available', sort: 'newest', pageSize: 8 }),
    products({ availability: 'preorder', sort: 'release', pageSize: 4 }),
    products({ brand: 'formosa-diecast', sort: 'featured', pageSize: 4 }),
    api.GET('/v1/brands', { params: { query: { locale } } }),
    api.GET('/v1/categories', { params: { query: { locale } } }),
  ]);

  const now = requestTime();
  const hero = pickHero(drops.data?.data ?? [], now);

  return (
    <>
      {hero ? <Hero product={hero} now={now} /> : null}

      <section className="container-page mt-10 grid gap-3 sm:grid-cols-3">
        {[
          { icon: ShieldIcon, title: t('valueAuthentic'), body: t('valueAuthenticBody') },
          { icon: FlagIcon, title: t('valueFair'), body: t('valueFairBody') },
          { icon: StoreIcon, title: t('valueShipping'), body: t('valueShippingBody') },
        ].map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="flex items-start gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line"
          >
            <span className="rounded-xl bg-paper p-2 text-ink">
              <Icon />
            </span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-mute">{body}</p>
            </div>
          </div>
        ))}
      </section>

      {upcoming.data?.data.length ? (
        <section className="container-page mt-20">
          <SectionHeader
            title={t('upcomingTitle')}
            subtitle={t('upcomingSubtitle')}
            action={<ViewAllLink href="/calendar" label={t('viewAll')} />}
          />
          <ProductGrid products={upcoming.data.data} />
        </section>
      ) : null}

      <section className="container-page mt-20">
        <SectionHeader
          title={t('newArrivals')}
          action={<ViewAllLink href="/products" label={t('viewAll')} />}
        />
        <ProductGrid products={arrivals.data?.data ?? []} priorityCount={4} />
      </section>

      {categories.data?.length ? (
        <section className="container-page mt-20">
          <SectionHeader title={t('categoriesTitle')} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {categories.data.map((category, index) => (
              <Link
                key={category.id}
                href={`/products?category=${category.slug}`}
                className={`group relative flex min-h-36 flex-col justify-between overflow-hidden rounded-2xl p-5 text-white ${CATEGORY_TONES[index % CATEGORY_TONES.length]}`}
              >
                <span className="text-xs font-medium opacity-75">{category.productCount}</span>
                <span className="display text-xl sm:text-2xl">{category.name}</span>
                <ArrowRightIcon className="absolute right-4 bottom-5 opacity-60 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {preorders.data?.data.length ? (
        <section className="container-page mt-20">
          <SectionHeader
            title={t('preorderTitle')}
            subtitle={t('preorderSubtitle')}
            action={<ViewAllLink href="/products?availability=preorder" label={t('viewAll')} />}
          />
          <ProductGrid products={preorders.data.data} />
        </section>
      ) : null}

      {local.data?.data.length ? (
        <section className="container-page mt-20">
          <div className="grid gap-6 overflow-hidden rounded-3xl bg-[#fbf6e4] p-6 ring-1 ring-[#efe2b6] sm:p-10 lg:grid-cols-[1fr_2fr] lg:items-center">
            <div className="space-y-4">
              <p className="eyebrow text-gold">Formosa Diecast</p>
              <h2 className="display text-3xl">{t('localTitle')}</h2>
              <p className="text-sm text-ink-2">{t('localBody')}</p>
              <ButtonLink href="/brands/formosa-diecast" variant="primary">
                {t('localCta')}
                <ArrowRightIcon size={16} />
              </ButtonLink>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {local.data.data.slice(0, 4).map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="overflow-hidden rounded-2xl bg-surface ring-1 ring-black/5 transition-shadow hover:shadow-lift"
                >
                  <div className="relative aspect-[4/3]">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="25vw"
                      />
                    ) : null}
                  </div>
                  <p className="truncate px-3 py-2 text-xs font-semibold">{product.name}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {brands.data?.length ? (
        <section className="container-page mt-20">
          <SectionHeader
            title={t('brandsTitle')}
            action={<ViewAllLink href="/brands" label={t('viewAll')} />}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {brands.data.map((brand) => (
              <Link
                key={brand.id}
                href={`/brands/${brand.slug}`}
                className="flex flex-col items-center gap-3 rounded-2xl bg-surface p-5 text-center ring-1 ring-line transition-shadow hover:shadow-card"
              >
                {brand.logoUrl ? (
                  <Image
                    src={brand.logoUrl}
                    alt=""
                    width={56}
                    height={56}
                    unoptimized
                    className="rounded-xl"
                  />
                ) : null}
                <span className="text-sm font-semibold">{brand.name}</span>
                <span className="text-xs text-mute">
                  {flagEmoji(brand.country)} {brand.productCount}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

const CATEGORY_TONES = ['bg-[#16161a]', 'bg-[#a91c15]', 'bg-[#1d3f6e]', 'bg-[#7a5a12]'];

async function Hero({ product, now }: { product: Product; now: number }) {
  const t = await getTranslations('home');
  const live = !!product.releaseAt && new Date(product.releaseAt).getTime() <= now;

  return (
    <section className="container-page mt-6">
      <div className="relative grid overflow-hidden rounded-3xl bg-ink text-white lg:grid-cols-[1fr_1.15fr]">
        <div className="relative z-10 flex flex-col justify-center gap-5 p-7 sm:p-10 lg:p-14">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {live ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              ) : null}
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            <span className="eyebrow text-white/70">
              {live ? t('heroLive') : t('heroUpcoming')}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-white/60 uppercase">
              {product.brand.name}
            </p>
            <h1 className="display mt-1 text-4xl leading-tight sm:text-5xl">{product.name}</h1>
            {product.subtitle ? (
              <p className="mt-3 text-sm text-white/70 sm:text-base">{product.subtitle}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Price price={product.price} compareAtPrice={product.compareAtPrice} size="lg" />
            {live ? (
              <AvailabilityBadge
                availability={product.availability}
                remaining={product.remaining}
              />
            ) : null}
          </div>
          {!live && product.releaseAt ? (
            <Countdown target={product.releaseAt} serverNow={now} />
          ) : null}
          <div>
            <ButtonLink href={`/products/${product.slug}`} variant="accent" size="lg">
              {t('heroCta')}
              <ArrowRightIcon size={18} />
            </ButtonLink>
          </div>
        </div>
        <div className="relative min-h-64 lg:min-h-[28rem]">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              unoptimized
              priority
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-transparent to-transparent lg:via-ink/0" />
        </div>
      </div>
    </section>
  );
}
