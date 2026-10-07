import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminOrderTable } from '@/components/admin-order-table';
import { MemberGarage } from '@/components/member-garage';
import { MemberStatusControl } from '@/components/member-status-control';
import { PageHeader } from '@/components/page-header';
import { StatTile } from '@/components/stat-tile';
import { MemberStatusBadge } from '@/components/status-badges';
import { ButtonLink } from '@/components/ui/button';
import { serverApi } from '@/lib/api';
import { STOREFRONT_URL } from '@/lib/env';
import { formatDateTime, formatPrice } from '@/lib/format';
import { can, getAdmin } from '@/lib/permissions';

export async function generateMetadata({ params }: PageProps<'/members/[id]'>): Promise<Metadata> {
  const { id } = await params;
  return { title: id.slice(0, 8) };
}

export default async function MemberPage({ params }: PageProps<'/members/[id]'>) {
  const { id } = await params;
  const t = await getTranslations('members');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const api = await serverApi();
  const [{ data: member }, { data: garage }, admin] = await Promise.all([
    api.GET('/v1/admin/members/{id}', { params: { path: { id } } }),
    api.GET('/v1/admin/members/{id}/garage', { params: { path: { id } } }),
    getAdmin(),
  ]);
  if (!member) notFound();

  return (
    <>
      <Link href="/members" className="mb-3 inline-block text-sm text-mute hover:text-ink">
        ← {t('title')}
      </Link>
      <PageHeader
        title={member.name}
        subtitle={
          <span className="flex items-center gap-2">
            {member.email} <MemberStatusBadge status={member.status} />
          </span>
        }
        actions={
          <>
            {can(admin, 'admin:manage') ? (
              <ButtonLink
                href={`/emails?q=${encodeURIComponent(member.email)}`}
                variant="secondary"
              >
                {t('emailLog')}
              </ButtonLink>
            ) : null}
            {can(admin, 'member:write') ? (
              <MemberStatusControl memberId={member.id} status={member.status} />
            ) : null}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t('totalSpent')}
          value={formatPrice(member.totalSpent)}
          detail={`${t('tier')} ${t(`tiers.${member.tier}`)}`}
        />
        <StatTile label={t('orderCount')} value={String(member.orderCount)} />
        <StatTile
          label={t('joined')}
          value={formatDateTime(member.createdAt, locale).slice(0, 10)}
        />
        <StatTile
          label={t('lastLogin')}
          value={member.lastLoginAt ? formatDateTime(member.lastLoginAt, locale).slice(0, 10) : '—'}
          detail={`${t('locale')} ${member.locale} · ${t('marketing')} ${member.marketingOptIn ? tc('yes') : tc('no')}`}
        />
      </div>
      <div className="card mt-5 overflow-hidden">
        <h2 className="p-5 pb-2 text-sm font-semibold">{t('recentOrders')}</h2>
        <AdminOrderTable orders={member.recentOrders} showMember={false} />
      </div>
      {garage ? (
        <MemberGarage
          garage={garage}
          memberId={member.id}
          canWrite={can(admin, 'member:write')}
          storefrontUrl={STOREFRONT_URL}
          locale={locale}
        />
      ) : null}
    </>
  );
}
