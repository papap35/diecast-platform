import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EventForm } from '@/components/content-forms';
import { ExternalIcon } from '@/components/icons';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { ContentStatusBadge } from '@/components/status-badges';
import { buttonClass } from '@/components/ui/button';
import { serverApi } from '@/lib/api';
import { eventProductOptions } from '@/lib/content';
import { STOREFRONT_URL } from '@/lib/env';
import { can, getAdmin } from '@/lib/permissions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('events');
  return { title: t('editTitle') };
}

export default async function EventPage({ params, searchParams }: PageProps<'/events/[id]'>) {
  const t = await getTranslations('events');
  if (!can(await getAdmin(), 'content:write')) return <NoAccess title={t('title')} />;
  const { id } = await params;
  const { created } = await searchParams;
  const api = await serverApi();
  const [{ data: event }, products] = await Promise.all([
    api.GET('/v1/admin/events/{id}', { params: { path: { id } } }),
    eventProductOptions(),
  ]);
  if (!event) notFound();

  return (
    <>
      <Link href="/events" className="mb-3 inline-block text-sm text-mute hover:text-ink">
        ← {t('title')}
      </Link>
      <PageHeader
        title={event.title}
        subtitle={
          <span className="flex items-center gap-2">
            {event.slug} <ContentStatusBadge status={event.status} />
          </span>
        }
        actions={
          event.status === 'PUBLISHED' ? (
            <a
              href={`${STOREFRONT_URL}/zh-TW/events/${event.slug}`}
              target="_blank"
              rel="noreferrer"
              className={buttonClass('secondary')}
            >
              <ExternalIcon size={16} />
              {t('viewOnStorefront')}
            </a>
          ) : null
        }
      />
      {created ? (
        <p role="status" className="mb-4 rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">
          {t('created')}
        </p>
      ) : null}
      <EventForm key={event.updatedAt} event={event} products={products} />
    </>
  );
}
