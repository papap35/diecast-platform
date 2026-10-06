import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { RetryEmailButton } from '@/components/email-actions';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { EmailStatusBadge } from '@/components/status-badges';
import { serverApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { can, getAdmin } from '@/lib/permissions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('emails');
  return { title: t('detail') };
}

export default async function EmailDetailPage({ params }: PageProps<'/emails/[id]'>) {
  const t = await getTranslations('emails');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  if (!can(await getAdmin(), 'admin:manage')) return <NoAccess title={t('detail')} />;
  const { id } = await params;
  const api = await serverApi();
  const { data: email } = await api.GET('/v1/admin/emails/{id}', { params: { path: { id } } });
  if (!email) notFound();

  const rows: [string, ReactNode][] = [
    [
      t('to'),
      email.memberId ? (
        <Link href={`/members/${email.memberId}`} className="hover:underline">
          {email.to}
        </Link>
      ) : (
        email.to
      ),
    ],
    [
      t('kind'),
      <>
        {t(`kinds.${email.kind}`)}
        {email.notificationType ? ` · ${t(`notificationTypes.${email.notificationType}`)}` : ''}
        {email.campaign ? (
          <>
            {' · '}
            <Link href={`/campaigns/${email.campaign.id}`} className="hover:underline">
              {email.campaign.name}
            </Link>
          </>
        ) : null}
      </>,
    ],
    [tc('status'), <EmailStatusBadge key="status" status={email.status} />],
    [t('attempts'), email.attempts],
    [tc('createdAt'), formatDateTime(email.createdAt, locale)],
    [t('sentAt'), email.sentAt ? formatDateTime(email.sentAt, locale) : '—'],
  ];
  if (email.status === 'PENDING' && email.nextAttemptAt) {
    rows.push([t('nextAttemptLabel'), formatDateTime(email.nextAttemptAt, locale)]);
  }
  if (email.unsubscribeUrl) rows.push([t('unsubscribe'), t('unsubscribeHeader')]);

  return (
    <>
      <PageHeader
        title={email.subject}
        subtitle={
          <Link href="/emails" className="hover:text-ink">
            ← {t('title')}
          </Link>
        }
        actions={<RetryEmailButton id={email.id} failed={email.status === 'FAILED'} />}
      />
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <section className="card flex flex-col gap-4 self-start p-5">
          <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2.5 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-xs text-mute">{label}</dt>
                <dd className="min-w-0 break-words text-ink-2">{value}</dd>
              </div>
            ))}
          </dl>
          {email.lastError ? (
            <div className="rounded-xl bg-accent-soft p-3 text-xs text-accent">
              <p className="mb-1 font-semibold">{t('lastError')}</p>
              <p className="break-words">{email.lastError}</p>
            </div>
          ) : null}
        </section>
        <section className="card min-w-0 p-5">
          <h2 className="mb-3 text-sm font-semibold">{t('content')}</h2>
          <pre className="font-sans text-sm leading-7 break-words whitespace-pre-wrap text-ink-2">
            {email.text}
          </pre>
        </section>
      </div>
    </>
  );
}
