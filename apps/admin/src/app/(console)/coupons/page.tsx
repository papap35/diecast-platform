import type { paths } from '@paddock64/api-client';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PlusIcon } from '@/components/icons';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { CouponStateBadge } from '@/components/status-badges';
import { ButtonLink, buttonClass } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { serverApi } from '@/lib/api';
import { benefitParams } from '@/lib/coupons';
import { formatDate, formatPrice } from '@/lib/format';
import { can, getAdmin } from '@/lib/permissions';

type Query = NonNullable<paths['/v1/admin/coupons']['get']['parameters']['query']>;
const STATES = ['ACTIVE', 'SCHEDULED', 'USED_UP', 'EXPIRED', 'DISABLED'] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('coupons');
  return { title: t('title') };
}

export default async function CouponsPage({ searchParams }: PageProps<'/coupons'>) {
  const t = await getTranslations('coupons');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  if (!can(await getAdmin(), 'marketing:write')) return <NoAccess title={t('title')} />;

  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  ) as Record<string, string | undefined>;
  const query: Query = {
    page: Number(params.page) || 1,
    pageSize: 20,
    q: params.q || undefined,
    state: (params.state || undefined) as Query['state'],
  };
  const api = await serverApi();
  const { data } = await api.GET('/v1/admin/coupons', { params: { query } });

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <ButtonLink href="/coupons/new">
            <PlusIcon size={16} />
            {t('new')}
          </ButtonLink>
        }
      />
      <form method="get" className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <Input
          name="q"
          defaultValue={params.q}
          placeholder={t('searchPlaceholder')}
          className="w-64"
        />
        <Select
          name="state"
          defaultValue={params.state ?? ''}
          className="w-40"
          aria-label={tc('status')}
        >
          <option value="">
            {tc('status')}：{tc('all')}
          </option>
          {STATES.map((state) => (
            <option key={state} value={state}>
              {t(`states.${state}`)}
            </option>
          ))}
        </Select>
        <button type="submit" className={buttonClass('primary', 'md')}>
          {tc('search')}
        </button>
        <Link href="/coupons" className="text-sm text-mute hover:text-ink">
          {tc('reset')}
        </Link>
      </form>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>{t('fields.code')}</th>
                <th>{t('benefitLabel')}</th>
                <th>{t('conditions')}</th>
                <th className="text-right">{t('usage')}</th>
                <th className="text-right">{t('totalDiscount')}</th>
                <th>{t('period')}</th>
                <th>{tc('status')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-mute">
                    {tc('noData')}
                  </td>
                </tr>
              ) : null}
              {data?.data.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-canvas">
                  <td>
                    <Link
                      href={`/coupons/${coupon.id}`}
                      className="font-mono font-semibold hover:underline"
                    >
                      {coupon.code}
                    </Link>
                    <p className="max-w-56 truncate text-xs text-mute">{coupon.name}</p>
                  </td>
                  <td className="whitespace-nowrap font-semibold">
                    {t(`benefit.${coupon.type}`, benefitParams(coupon))}
                  </td>
                  <td className="text-xs text-ink-2">
                    {coupon.minSubtotal > 0 ? (
                      <span className="block">
                        {t('minSubtotalShort', { amount: formatPrice(coupon.minSubtotal) })}
                      </span>
                    ) : null}
                    {coupon.minTier ? (
                      <span className="block">
                        {t('tierOrAbove', { tier: t(`tiers.${coupon.minTier}`) })}
                      </span>
                    ) : null}
                    <span className="block text-mute">
                      {t('perMemberShort', { count: coupon.perMemberLimit })}
                    </span>
                  </td>
                  <td className="text-right tabular">
                    {coupon.usedCount}
                    <span className="text-mute"> / {coupon.usageLimit ?? '∞'}</span>
                  </td>
                  <td className="text-right tabular">{formatPrice(coupon.totalDiscount)}</td>
                  <td className="whitespace-nowrap text-xs text-ink-2 tabular">
                    {coupon.startsAt || coupon.endsAt
                      ? `${coupon.startsAt ? formatDate(coupon.startsAt, locale) : t('now')} – ${coupon.endsAt ? formatDate(coupon.endsAt, locale) : t('noEnd')}`
                      : t('noPeriod')}
                  </td>
                  <td>
                    <CouponStateBadge state={coupon.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data ? (
          <Pagination
            basePath="/coupons"
            params={params}
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
          />
        ) : null}
      </div>
    </>
  );
}
