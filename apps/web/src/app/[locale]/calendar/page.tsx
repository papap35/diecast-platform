import type { Schemas } from '@paddock64/api-client';
import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { AvailabilityBadge, SaleTypeBadge } from '@/components/availability-badge';
import { ReminderButton } from '@/components/collector-buttons';
import { Countdown } from '@/components/countdown';
import { EventCard } from '@/components/event-card';
import { Price } from '@/components/price';
import { ProductGrid } from '@/components/product-card';
import { SectionHeader, ViewAllLink } from '@/components/section-header';
import { Link } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/page-locale';
import { serverApi } from '@/lib/api';
import { requestTime } from '@/lib/time';
import { formatReleaseParts } from '@/lib/format';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/calendar'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'calendar' });
  return { title: t('title'), description: t('subtitle') };
}

export default async function CalendarPage({ params }: PageProps<'/[locale]/calendar'>) {
  const locale = await pageLocale(params);
  const t = await getTranslations('calendar');
  const api = await serverApi(locale);
  const [upcoming, live, preorders, events] = await Promise.all([
    api.GET('/v1/products', {
      params: { query: { locale, availability: 'upcoming', sort: 'release', pageSize: 50 } },
    }),
    api.GET('/v1/products', {
      params: {
        query: {
          locale,
          saleType: 'LIMITED',
          availability: 'available',
          sort: 'release',
          pageSize: 12,
        },
      },
    }),
    api.GET('/v1/products', {
      params: { query: { locale, availability: 'preorder', sort: 'release', pageSize: 12 } },
    }),
    api.GET('/v1/events', { params: { query: { locale, pageSize: 3 } } }),
  ]);
  const now = requestTime();

  return (
    <div className="container-page py-10">
      <h1 className="display text-3xl sm:text-4xl">{t('title')}</h1>
      <p className="mt-1 mb-10 text-sm text-mute">{t('subtitle')}</p>

      {live.data?.data.length ? (
        <section className="mb-14">
          <SectionHeader title={t('live')} />
          <ProductGrid products={live.data.data} />
        </section>
      ) : null}

      <section className="mb-14">
        <SectionHeader title={t('upcoming')} />
        {upcoming.data?.data.length ? (
          <ol className="relative space-y-4 border-l-2 border-line pl-6 sm:pl-8">
            {upcoming.data.data.map((product) => (
              <TimelineItem key={product.id} product={product} locale={locale} now={now} />
            ))}
          </ol>
        ) : (
          <p className="rounded-2xl bg-surface p-8 text-center text-sm text-mute ring-1 ring-line">
            {t('noUpcoming')}
          </p>
        )}
      </section>

      {events.data?.data.length ? (
        <section className="mb-14">
          <SectionHeader
            title={t('events')}
            action={<ViewAllLink href="/events" label={t('allEvents')} />}
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.data.data.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ) : null}

      {preorders.data?.data.length ? (
        <section>
          <SectionHeader title={t('preorders')} />
          <ProductGrid products={preorders.data.data} />
        </section>
      ) : null}
    </div>
  );
}

function TimelineItem({
  product,
  locale,
  now,
}: {
  product: Schemas['ProductSummaryDto'];
  locale: string;
  now: number;
}) {
  const when = formatReleaseParts(product.releaseAt!, locale);
  return (
    <li className="relative">
      <span className="absolute top-6 -left-[33px] h-4 w-4 rounded-full border-4 border-paper bg-accent sm:-left-[41px]" />
      <div className="grid items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-line transition-shadow hover:shadow-card sm:grid-cols-[5.5rem_9rem_1fr_auto]">
        <div className="flex items-baseline gap-2 sm:flex-col sm:items-start sm:gap-0">
          <span className="display text-3xl leading-none">{when.day}</span>
          <span className="text-xs text-mute">
            {when.month} · {when.weekday} · {when.time}
          </span>
        </div>
        <div className="relative hidden aspect-[4/3] overflow-hidden rounded-xl bg-paper ring-1 ring-line sm:block">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt=""
              fill
              unoptimized
              sizes="144px"
              className="object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <SaleTypeBadge saleType={product.saleType} />
            <AvailabilityBadge availability={product.availability} />
          </div>
          <p className="text-xs font-semibold tracking-wide text-mute uppercase">
            {product.brand.name}
          </p>
          <Link
            href={`/products/${product.slug}`}
            className="block truncate font-semibold after:absolute after:inset-0"
          >
            {product.name}
          </Link>
          <Price price={product.price} />
        </div>
        <div className="relative z-10 flex flex-col items-start gap-2 sm:items-end">
          <Countdown
            target={product.releaseAt!}
            serverNow={now}
            variant="inline"
            className="text-sm text-ink-2"
          />
          <ReminderButton productId={product.id} className="h-9 px-4 text-xs" />
        </div>
      </div>
    </li>
  );
}
