import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EVENT_TONE } from '@/components/event-card';
import { ArrowRightIcon, CalendarIcon, MapPinIcon } from '@/components/icons';
import { ProductCard } from '@/components/product-card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/page-locale';
import type { AppLocale } from '@/i18n/routing';
import { serverApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

async function loadEvent(slug: string, locale: AppLocale) {
  const api = await serverApi(locale);
  const { data } = await api.GET('/v1/events/{slug}', {
    params: { path: { slug }, query: { locale } },
  });
  if (!data) notFound();
  return data;
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/events/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  const event = await loadEvent(slug, locale as AppLocale);
  return {
    title: event.title,
    description: event.summary,
    openGraph: { images: event.coverImageUrl ? [event.coverImageUrl] : [] },
  };
}

export default async function EventPage({ params }: PageProps<'/[locale]/events/[slug]'>) {
  const locale = await pageLocale(params);
  const { slug } = await params;
  const t = await getTranslations('events');
  const event = await loadEvent(slug, locale);
  const range = [event.startsAt, event.endsAt]
    .filter((value): value is string => !!value)
    .map((value) => formatDateTime(value, locale))
    .join(' – ');

  return (
    <article className="container-page py-8">
      <Link
        href="/events"
        className="mb-6 inline-flex items-center gap-1 text-sm text-mute hover:text-ink"
      >
        <ArrowRightIcon size={16} className="rotate-180" />
        {t('back')}
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:gap-12">
        <div className="space-y-6">
          {event.coverImageUrl ? (
            <div className="relative aspect-[16/9] overflow-hidden rounded-3xl bg-paper ring-1 ring-line">
              <Image
                src={event.coverImageUrl}
                alt=""
                fill
                unoptimized
                priority
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-cover"
              />
            </div>
          ) : null}
          <div className="space-y-3">
            <Badge tone={EVENT_TONE[event.type]}>{t(`types.${event.type}`)}</Badge>
            <h1 className="display text-3xl leading-tight sm:text-4xl">{event.title}</h1>
            <p className="text-ink-2">{event.summary}</p>
          </div>
          <div className="space-y-4 text-sm leading-7 text-ink-2">
            {event.body.split(/\n{2,}/).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <dl className="space-y-4 rounded-3xl bg-surface p-6 text-sm ring-1 ring-line">
            <div className="flex gap-3">
              <CalendarIcon size={18} className="mt-0.5 shrink-0 text-mute" />
              <div>
                <dt className="text-xs text-mute">{t('time')}</dt>
                <dd className="font-medium tabular">{range}</dd>
              </div>
            </div>
            {event.venue ? (
              <div className="flex gap-3">
                <MapPinIcon size={18} className="mt-0.5 shrink-0 text-mute" />
                <div>
                  <dt className="text-xs text-mute">{t('venue')}</dt>
                  <dd className="font-medium">{event.venue}</dd>
                  {event.address ? <dd className="text-xs text-mute">{event.address}</dd> : null}
                </div>
              </div>
            ) : null}
            {event.url ? (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold underline underline-offset-4"
              >
                {t('externalLink')}
                <ArrowRightIcon size={14} />
              </a>
            ) : null}
          </dl>
          {event.product ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">{t('relatedProduct')}</h2>
              <ProductCard product={event.product} />
            </div>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
