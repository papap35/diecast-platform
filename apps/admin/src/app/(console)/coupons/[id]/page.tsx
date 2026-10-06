import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CouponForm } from '@/components/coupon-form';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { StatTile } from '@/components/stat-tile';
import { CouponStateBadge } from '@/components/status-badges';
import { serverApi } from '@/lib/api';
import { benefitParams } from '@/lib/coupons';
import { formatDateTime, formatPrice } from '@/lib/format';
import { can, getAdmin } from '@/lib/permissions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('coupons');
  return { title: t('editTitle') };
}

export default async function CouponPage({ params, searchParams }: PageProps<'/coupons/[id]'>) {
  const t = await getTranslations('coupons');
  const locale = await getLocale();
  if (!can(await getAdmin(), 'marketing:write')) return <NoAccess title={t('title')} />;
  const { id } = await params;
  const { created } = await searchParams;
  const api = await serverApi();
  const { data: coupon } = await api.GET('/v1/admin/coupons/{id}', { params: { path: { id } } });
  if (!coupon) notFound();

  return (
    <>
      <Link href="/coupons" className="mb-3 inline-block text-sm text-mute hover:text-ink">
        ← {t('title')}
      </Link>
      <PageHeader
        title={coupon.code}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {coupon.name} <CouponStateBadge state={coupon.state} />
          </span>
        }
      />
      {created ? (
        <p role="status" className="mb-4 rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">
          {t('created')}
        </p>
      ) : null}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatTile
          label={t('benefitLabel')}
          value={t(`benefit.${coupon.type}`, benefitParams(coupon))}
        />
        <StatTile label={t('usage')} value={`${coupon.usedCount} / ${coupon.usageLimit ?? '∞'}`} />
        <StatTile label={t('totalDiscount')} value={formatPrice(coupon.totalDiscount)} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_26rem]">
        <CouponForm key={coupon.updatedAt} coupon={coupon} />
        <section className="card h-fit overflow-hidden">
          <h2 className="border-b border-line px-5 py-4 text-sm font-semibold">
            {t('redemptions')}
          </h2>
          {coupon.redemptions.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-mute">{t('noRedemptions')}</p>
          ) : (
            <ul className="divide-y divide-line">
              {coupon.redemptions.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/orders/${r.orderId}`}
                      className="font-mono font-semibold hover:underline"
                    >
                      {r.orderNo}
                    </Link>
                    <p className="truncate text-xs text-mute">
                      <Link href={`/members/${r.memberId}`} className="hover:underline">
                        {r.memberEmail}
                      </Link>{' '}
                      · {formatDateTime(r.createdAt, locale)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={
                        r.releasedAt ? 'text-mute line-through tabular' : 'font-semibold tabular'
                      }
                    >
                      −{formatPrice(r.amount)}
                    </p>
                    {r.releasedAt ? <p className="text-[11px] text-mute">{t('released')}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
