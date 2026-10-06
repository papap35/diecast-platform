import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { EventForm } from '@/components/content-forms';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { eventProductOptions } from '@/lib/content';
import { can, getAdmin } from '@/lib/permissions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('events');
  return { title: t('new') };
}

export default async function NewEventPage() {
  const t = await getTranslations('events');
  if (!can(await getAdmin(), 'content:write')) return <NoAccess title={t('new')} />;
  return (
    <>
      <Link href="/events" className="mb-3 inline-block text-sm text-mute hover:text-ink">
        ← {t('title')}
      </Link>
      <PageHeader title={t('new')} />
      <EventForm products={await eventProductOptions()} />
    </>
  );
}
