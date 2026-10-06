import type { ApiErrorBody, FieldError, Schemas } from '@paddock64/api-client';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import {
  BarList,
  Delta,
  EmptyRow,
  foldRows,
  formatPercent,
  ReportPanel,
  ShareBar,
} from '@/components/report-parts';
import { type Granularity, RevenueChart } from '@/components/revenue-chart';
import { StatTile } from '@/components/stat-tile';
import { buttonClass } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { serverApi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { addDays, daysBetween, isDay, startOfMonth, taipeiToday } from '@/lib/dates';
import { formatDate, formatPrice } from '@/lib/format';
import { can, getAdmin } from '@/lib/permissions';

type Report = Schemas['SalesReportDto'];
type Breakdown = Schemas['ReportBreakdownDto'];

const GRANULARITIES: Granularity[] = ['day', 'week', 'month'];
const BREAKDOWN_ROWS = 8;

/** 沒有指定時間單位時依期間長度決定，避免一整年的每日長條擠成一團 */
function defaultGranularity(days: number): Granularity {
  if (days <= 92) return 'day';
  return days <= 400 ? 'week' : 'month';
}

function presets(today: string) {
  return [
    { key: '7d', from: addDays(today, -6), to: today },
    { key: '30d', from: addDays(today, -29), to: today },
    { key: '90d', from: addDays(today, -89), to: today },
    { key: 'thisMonth', from: startOfMonth(today), to: today },
    { key: 'lastMonth', from: startOfMonth(today, -1), to: addDays(startOfMonth(today), -1) },
    { key: 'thisYear', from: `${today.slice(0, 4)}-01-01`, to: today },
  ] as const;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('reports');
  return { title: t('title') };
}

export default async function ReportsPage({ searchParams }: PageProps<'/reports'>) {
  const t = await getTranslations('reports');
  const te = await getTranslations('errors');
  const locale = await getLocale();
  const me = await getAdmin();
  if (!can(me, 'report:read')) return <NoAccess title={t('title')} />;

  const raw = await searchParams;
  const param = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const today = taipeiToday();
  const toParam = param('to');
  const fromParam = param('from');
  const to = isDay(toParam) ? toParam : today;
  const from = isDay(fromParam) ? fromParam : addDays(to, -29);
  const requested = param('granularity') as Granularity | undefined;
  const granularity =
    requested && GRANULARITIES.includes(requested)
      ? requested
      : defaultGranularity(daysBetween(from, to));

  const api = await serverApi();
  const { data, error } = await api.GET('/v1/admin/reports/sales', {
    params: { query: { from, to, granularity } },
  });
  const errorBody = error as Partial<ApiErrorBody> | undefined;
  const details = errorBody?.error?.details;
  const invalidField = Array.isArray(details) ? (details as FieldError[])[0]?.field : undefined;
  const loadError = error
    ? invalidField === 'to'
      ? t('rangeInverted')
      : invalidField === 'from'
        ? t('rangeTooLong')
        : te.has(errorBody?.error?.code ?? '')
          ? te(errorBody!.error!.code)
          : (errorBody?.error?.message ?? te('INTERNAL_ERROR'))
    : null;
  const exportError = param('exportError');
  const range = new URLSearchParams({ from, to }).toString();
  const canExportOrders = can(me, 'order:read');

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            {canExportOrders ? (
              <a
                href={`/reports/export/orders?${range}`}
                className={buttonClass('secondary', 'md')}
              >
                {t('exportOrders')}
              </a>
            ) : null}
            <a
              href={`/reports/export/products?${range}`}
              className={buttonClass('secondary', 'md')}
            >
              {t('exportProducts')}
            </a>
          </>
        }
      />

      <div className="card mb-4 flex flex-col gap-3 p-4">
        <nav aria-label={t('presetsLabel')} className="flex flex-wrap gap-1.5">
          {presets(today).map((preset) => {
            const active = preset.from === from && preset.to === to;
            return (
              <Link
                key={preset.key}
                href={`/reports?from=${preset.from}&to=${preset.to}`}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold ring-1',
                  active ? 'bg-ink text-white ring-ink' : 'text-ink-2 ring-line hover:ring-ink',
                )}
              >
                {t(`presets.${preset.key}`)}
              </Link>
            );
          })}
        </nav>
        {/* 點快速期間是用戶端導覽，key 讓表單重新掛載，日期欄位才會換成新的期間 */}
        <form
          key={`${from}_${to}_${granularity}`}
          method="get"
          className="flex flex-wrap items-center gap-3"
        >
          <Input
            type="date"
            name="from"
            defaultValue={from}
            max={today}
            className="w-40"
            aria-label={t('from')}
          />
          <span className="text-mute">–</span>
          <Input
            type="date"
            name="to"
            defaultValue={to}
            max={today}
            className="w-40"
            aria-label={t('to')}
          />
          <Select
            name="granularity"
            defaultValue={granularity}
            className="w-32"
            aria-label={t('granularity')}
          >
            {GRANULARITIES.map((value) => (
              <option key={value} value={value}>
                {t(`granularities.${value}`)}
              </option>
            ))}
          </Select>
          <button type="submit" className={buttonClass('primary', 'md')}>
            {t('apply')}
          </button>
          {data ? (
            <p className="text-xs text-mute">
              {t('period', {
                from: formatDate(`${data.from}T00:00:00+08:00`, locale),
                to: formatDate(`${data.to}T00:00:00+08:00`, locale),
                days: daysBetween(data.from, data.to),
              })}
            </p>
          ) : null}
        </form>
      </div>

      {exportError ? (
        <p role="alert" className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
          {t('exportFailed', { reason: te.has(exportError) ? te(exportError) : exportError })}
        </p>
      ) : null}

      {loadError || !data ? (
        <p role="alert" className="card px-6 py-12 text-center text-sm text-accent">
          {loadError ?? te('INTERNAL_ERROR')}
        </p>
      ) : (
        <ReportBody report={data} locale={locale} />
      )}
    </>
  );
}

async function ReportBody({ report, locale }: { report: Report; locale: string }) {
  const t = await getTranslations('reports');
  const tOrders = await getTranslations('orders');
  const tp = await getTranslations('products');
  const tm = await getTranslations('members');
  const { totals, previous } = report;
  const vs = (value: string) => t('vsPrevious', { value });
  const merchandise = report.bySaleType.reduce((sum, row) => sum + row.revenue, 0);
  const shippingOrders = report.byShipping.reduce((sum, row) => sum + row.orders, 0);
  const tierRevenue = report.byTier.reduce((sum, row) => sum + row.revenue, 0);

  return (
    <>
      <p className="mb-3 text-xs text-mute">
        {t('comparedTo', {
          from: formatDate(`${report.previousFrom}T00:00:00+08:00`, locale),
          to: formatDate(`${report.previousTo}T00:00:00+08:00`, locale),
        })}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t('kpi.revenue')}
          value={formatPrice(totals.revenue)}
          detail={
            <Delta
              current={totals.revenue}
              previous={previous.revenue}
              previousLabel={vs(formatPrice(previous.revenue))}
            />
          }
        />
        <StatTile
          label={t('kpi.orders')}
          value={totals.orders.toLocaleString('en-US')}
          detail={
            <Delta
              current={totals.orders}
              previous={previous.orders}
              previousLabel={vs(previous.orders.toLocaleString('en-US'))}
            />
          }
        />
        <StatTile
          label={t('kpi.aov')}
          value={formatPrice(totals.averageOrderValue)}
          detail={
            <Delta
              current={totals.averageOrderValue}
              previous={previous.averageOrderValue}
              previousLabel={vs(formatPrice(previous.averageOrderValue))}
            />
          }
        />
        <StatTile
          label={t('kpi.units')}
          value={totals.units.toLocaleString('en-US')}
          detail={
            <Delta
              current={totals.units}
              previous={previous.units}
              previousLabel={vs(previous.units.toLocaleString('en-US'))}
            />
          }
        />
        <StatTile
          label={t('kpi.customers')}
          value={totals.customers.toLocaleString('en-US')}
          detail={
            <Delta
              current={totals.customers}
              previous={previous.customers}
              previousLabel={vs(previous.customers.toLocaleString('en-US'))}
            />
          }
        />
        <StatTile
          label={t('kpi.newMembers')}
          value={totals.newMembers.toLocaleString('en-US')}
          detail={
            <Delta
              current={totals.newMembers}
              previous={previous.newMembers}
              previousLabel={vs(previous.newMembers.toLocaleString('en-US'))}
            />
          }
        />
        <StatTile
          label={t('kpi.discount')}
          value={formatPrice(totals.discount)}
          detail={t('discountDetail', {
            share: formatPercent(totals.revenue ? totals.discount / totals.revenue : 0),
            shipping: formatPrice(totals.shippingFee),
          })}
        />
        <StatTile
          label={t('kpi.refunds')}
          value={formatPrice(totals.refundAmount)}
          detail={
            <Delta
              current={totals.refundAmount}
              previous={previous.refundAmount}
              invert
              previousLabel={t('refundDetail', {
                count: totals.refundOrders,
                previous: formatPrice(previous.refundAmount),
              })}
            />
          }
        />
      </div>

      <div className="mt-4">
        <RevenueChart
          data={report.trend}
          locale={locale}
          granularity={report.granularity}
          title={t('trend', { unit: t(`granularities.${report.granularity}`) })}
          hint={t('trendHint')}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <BreakdownPanel
          title={t('byBrand')}
          hint={t('merchandiseHint')}
          rows={report.byBrand}
          labelHeader={t('brand')}
        />
        <BreakdownPanel
          title={t('byCategory')}
          hint={t('byCategoryHint')}
          rows={report.byCategory}
          labelHeader={t('category')}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ReportPanel title={t('bySaleType')} hint={t('merchandiseHint')}>
          <BarList
            items={report.bySaleType.map((row) => ({
              key: row.saleType,
              label: tp(`saleTypes.${row.saleType}`),
              value: formatPrice(row.revenue),
              detail: t('unitsCount', { count: row.units }),
              share: merchandise ? row.revenue / merchandise : 0,
            }))}
          />
        </ReportPanel>
        <ReportPanel title={t('byShipping')} hint={t('byShippingHint')}>
          <BarList
            items={report.byShipping.map((row) => ({
              key: row.method,
              label: tOrders(`methods.${row.method}`),
              value: t('ordersCount', { count: row.orders }),
              detail: formatPrice(row.revenue),
              share: shippingOrders ? row.orders / shippingOrders : 0,
            }))}
          />
        </ReportPanel>
        <ReportPanel title={t('byTier')} hint={t('byTierHint')}>
          <BarList
            items={report.byTier.map((row) => ({
              key: row.tier,
              label: tm(`tiers.${row.tier}`),
              value: formatPrice(row.revenue),
              detail: t('tierDetail', { members: row.members, customers: row.customers }),
              share: tierRevenue ? row.revenue / tierRevenue : 0,
            }))}
          />
        </ReportPanel>
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[3fr_2fr]">
        <ReportPanel title={t('topProducts')} hint={t('merchandiseHint')}>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>{t('product')}</th>
                  <th className="text-right">{t('units')}</th>
                  <th className="text-right">{t('netRevenue')}</th>
                </tr>
              </thead>
              <tbody>
                {report.topProducts.length === 0 ? (
                  <EmptyRow colSpan={4}>{t('empty')}</EmptyRow>
                ) : (
                  report.topProducts.map((product, index) => (
                    <tr key={product.productId}>
                      <td className="text-xs font-semibold text-mute tabular">{index + 1}</td>
                      <td className="max-w-0 w-full">
                        <Link
                          href={`/products/${product.productId}`}
                          className="block truncate hover:underline"
                        >
                          {product.name}
                        </Link>
                        <span className="text-xs text-mute">{product.sku}</span>
                      </td>
                      <td className="text-right tabular">
                        {product.units.toLocaleString('en-US')}
                      </td>
                      <td className="text-right font-semibold tabular">
                        {formatPrice(product.revenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ReportPanel>
        <ReportPanel title={t('coupons')} hint={t('couponsHint')}>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{t('code')}</th>
                  <th className="text-right">{t('uses')}</th>
                  <th className="text-right">{t('discount')}</th>
                  <th className="text-right">{t('couponRevenue')}</th>
                </tr>
              </thead>
              <tbody>
                {report.coupons.length === 0 ? (
                  <EmptyRow colSpan={4}>{t('empty')}</EmptyRow>
                ) : (
                  report.coupons.map((coupon) => (
                    <tr key={coupon.couponId}>
                      <td>
                        <Link
                          href={`/coupons/${coupon.couponId}`}
                          className="font-semibold tabular hover:underline"
                        >
                          {coupon.code}
                        </Link>
                        <p className="max-w-40 truncate text-xs text-mute">{coupon.name}</p>
                      </td>
                      <td className="text-right tabular">
                        {coupon.orders.toLocaleString('en-US')}
                      </td>
                      <td className="text-right tabular">{formatPrice(coupon.discount)}</td>
                      <td className="text-right tabular">{formatPrice(coupon.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ReportPanel>
      </div>

      <details className="card mt-4 p-5 text-sm">
        <summary className="cursor-pointer font-semibold">{t('definitions')}</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-2">
          {(['revenue', 'merchandise', 'discount', 'refunds', 'tiers', 'exports'] as const).map(
            (key) => (
              <li key={key}>{t(`definitionItems.${key}`)}</li>
            ),
          )}
        </ul>
      </details>
    </>
  );
}

async function BreakdownPanel({
  title,
  hint,
  rows,
  labelHeader,
}: {
  title: string;
  hint: string;
  rows: Breakdown[];
  labelHeader: string;
}) {
  const t = await getTranslations('reports');
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);
  const { visible, rest } = foldRows(rows, BREAKDOWN_ROWS);
  return (
    <ReportPanel title={title} hint={hint}>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>{labelHeader}</th>
              <th className="text-right">{t('units')}</th>
              <th className="text-right">{t('netRevenue')}</th>
              <th>{t('share')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={4}>{t('empty')}</EmptyRow>
            ) : (
              <>
                {visible.map((row) => (
                  <tr key={row.key}>
                    <td className="max-w-48 truncate">{row.label}</td>
                    <td className="text-right tabular">{row.units.toLocaleString('en-US')}</td>
                    <td className="text-right tabular">{formatPrice(row.revenue)}</td>
                    <td>
                      <ShareBar share={total ? row.revenue / total : 0} />
                    </td>
                  </tr>
                ))}
                {rest ? (
                  <tr>
                    <td className="text-mute">{t('others', { count: rest.count })}</td>
                    <td className="text-right text-mute tabular">
                      {rest.units.toLocaleString('en-US')}
                    </td>
                    <td className="text-right text-mute tabular">{formatPrice(rest.revenue)}</td>
                    <td>
                      <ShareBar share={total ? rest.revenue / total : 0} />
                    </td>
                  </tr>
                ) : null}
              </>
            )}
          </tbody>
        </table>
      </div>
    </ReportPanel>
  );
}
