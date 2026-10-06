import type { Schemas } from '@paddock64/api-client';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatReleaseParts } from '@/lib/format';
import { MapPinIcon } from './icons';
import { Badge, type Tone } from './ui/badge';

type Event = Schemas['EventSummaryDto'];

export const EVENT_TONE: Record<Event['type'], Tone> = {
  EXHIBITION: 'dark',
  MEETUP: 'info',
  LAUNCH: 'accent',
  ONLINE: 'gold',
};

/** 活動卡：日期、類型、標題、地點 */
export function EventCard({ event }: { event: Event }) {
  const t = useTranslations('events');
  const locale = useLocale();
  const when = formatReleaseParts(event.startsAt, locale);
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-paper">
        {event.coverImageUrl ? (
          <Image
            src={event.coverImageUrl}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : null}
        <div className="absolute top-3 left-3 flex flex-col items-center rounded-xl bg-surface/95 px-3 py-1.5 text-center shadow-card">
          <span className="text-[11px] font-semibold text-mute uppercase">{when.month}</span>
          <span className="display text-2xl leading-none">{when.day}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
          <Badge tone={EVENT_TONE[event.type]}>{t(`types.${event.type}`)}</Badge>
          <span className="tabular">
            {when.weekday} · {when.time}
          </span>
        </div>
        <h3 className="text-base leading-6 font-semibold">{event.title}</h3>
        <p className="line-clamp-2 text-sm text-ink-2">{event.summary}</p>
        {event.venue ? (
          <p className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-mute">
            <MapPinIcon size={14} />
            <span className="truncate">{event.venue}</span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}
