import type { Schemas } from '@paddock64/api-client';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { EventCard } from '@/components/event-card';
import { Link } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/page-locale';
import { serverApi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { localeAlternates } from '@/lib/seo';

type EventType = Schemas['EventType'];
const TYPES: EventType[] = ['EXHIBITION', 'MEETUP', 'LAUNCH', 'ONLINE'];

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/events'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'events' });
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: localeAlternates(locale, '/events'),
  };
}

export default async function EventsPage({ params, searchParams }: PageProps<'/[locale]/events'>) {
  const locale = await pageLocale(params);
  const query = await searchParams;
  const type = TYPES.find((value) => value === query.type);
  const t = await getTranslations('events');
  const api = await serverApi(locale);
  const { data } = await api.GET('/v1/events', {
    params: { query: { locale, pageSize: 50, ...(type ? { type } : {}) } },
  });
  const events = data?.data ?? [];

  return (
    <div className="container-page py-10">
      <h1 className="display text-3xl sm:text-4xl">{t('title')}</h1>
      <p className="mt-1 mb-6 text-sm text-mute">{t('subtitle')}</p>
      <nav className="mb-8 flex flex-wrap gap-2" aria-label={t('filter')}>
        {[undefined, ...TYPES].map((value) => (
          <Link
            key={value ?? 'all'}
            href={value ? `/events?type=${value}` : '/events'}
            aria-current={value === type ? 'page' : undefined}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              value === type
                ? 'border-ink bg-ink text-white'
                : 'border-line-strong bg-surface hover:border-ink',
            )}
          >
            {value ? t(`types.${value}`) : t('all')}
          </Link>
        ))}
      </nav>
      {events.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-surface p-10 text-center text-sm text-mute ring-1 ring-line">
          {t('empty')}
        </p>
      )}
    </div>
  );
}
