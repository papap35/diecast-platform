import type { paths } from '@paddock64/api-client';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { buttonClass } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { serverApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { can, getAdmin } from '@/lib/permissions';

type Query = NonNullable<paths['/v1/admin/audit-logs']['get']['parameters']['query']>;

/** 可篩選的動作分類（動作代碼的前綴） */
const ACTION_GROUPS = [
  'auth',
  'admin',
  'role',
  'product',
  'brand',
  'category',
  'order',
  'member',
  'event',
  'banner',
  'coupon',
  'campaign',
];

/** 操作對象在後台的頁面 */
function targetHref(type: string, id: string | null): string | null {
  if (!id) return null;
  switch (type) {
    case 'Product':
      return `/products/${id}`;
    case 'Order':
      return `/orders/${id}`;
    case 'Member':
      return `/members/${id}`;
    case 'AdminUser':
      return `/admins?edit=${id}`;
    case 'Role':
      return `/roles?edit=${id}`;
    case 'Brand':
      return `/brands?edit=${id}`;
    case 'Category':
      return `/categories?edit=${id}`;
    case 'Event':
      return `/events/${id}`;
    case 'Banner':
      return `/banners?edit=${id}`;
    case 'Coupon':
      return `/coupons/${id}`;
    case 'Campaign':
      return `/campaigns/${id}`;
    default:
      return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auditLogs');
  return { title: t('title') };
}

export default async function AuditLogsPage({ searchParams }: PageProps<'/audit-logs'>) {
  const t = await getTranslations('auditLogs');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const me = await getAdmin();
  if (!can(me, 'admin:manage')) return <NoAccess title={t('title')} />;

  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  ) as Record<string, string | undefined>;
  const query: Query = {
    page: Number(params.page) || 1,
    pageSize: 30,
    adminId: params.adminId || undefined,
    action: params.action || undefined,
    targetType: params.targetType || undefined,
    targetId: params.targetId || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  };
  const api = await serverApi();
  const [{ data }, { data: admins }] = await Promise.all([
    api.GET('/v1/admin/audit-logs', { params: { query } }),
    api.GET('/v1/admin/admins'),
  ]);
  const actionLabel = (action: string) =>
    t.has(`actions.${action}`) ? t(`actions.${action}`) : action;

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <form method="get" className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <Select
          name="adminId"
          defaultValue={params.adminId ?? ''}
          className="w-44"
          aria-label={t('admin')}
        >
          <option value="">
            {t('admin')}：{tc('all')}
          </option>
          {admins?.data.map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.name}
            </option>
          ))}
        </Select>
        <Select
          name="action"
          defaultValue={params.action ?? ''}
          className="w-44"
          aria-label={t('action')}
        >
          <option value="">
            {t('action')}：{tc('all')}
          </option>
          {ACTION_GROUPS.map((group) => (
            <option key={group} value={group}>
              {t(`groups.${group}`)}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          name="from"
          defaultValue={params.from}
          className="w-40"
          aria-label={t('from')}
        />
        <span className="text-mute">–</span>
        <Input
          type="date"
          name="to"
          defaultValue={params.to}
          className="w-40"
          aria-label={t('to')}
        />
        {params.targetId ? <input type="hidden" name="targetId" value={params.targetId} /> : null}
        <button type="submit" className={buttonClass('primary', 'md')}>
          {tc('search')}
        </button>
        <Link href="/audit-logs" className="text-sm text-mute hover:text-ink">
          {tc('reset')}
        </Link>
      </form>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>{t('time')}</th>
                <th>{t('admin')}</th>
                <th>{t('action')}</th>
                <th>{t('target')}</th>
                <th>{t('details')}</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-mute">
                    {tc('noData')}
                  </td>
                </tr>
              ) : null}
              {data?.data.map((log) => {
                const href = targetHref(log.targetType, log.targetId);
                const label = log.targetLabel ?? log.targetId ?? '—';
                return (
                  <tr key={log.id} className="align-top">
                    <td className="whitespace-nowrap text-xs text-mute tabular">
                      {formatDateTime(log.createdAt, locale)}
                    </td>
                    <td className="whitespace-nowrap">
                      {log.admin ? (
                        <Link
                          href={`/audit-logs?adminId=${log.admin.id}`}
                          className="hover:underline"
                        >
                          {log.admin.name}
                        </Link>
                      ) : (
                        <span className="text-mute">{t('deletedAdmin')}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap font-semibold">{actionLabel(log.action)}</td>
                    <td className="max-w-56 truncate">
                      {href ? (
                        <Link href={href} className="hover:underline">
                          {label}
                        </Link>
                      ) : (
                        label
                      )}
                    </td>
                    <td className="max-w-md">
                      {log.changes ? (
                        <details>
                          <summary className="cursor-pointer text-xs text-mute hover:text-ink">
                            {t('showDetails')}
                          </summary>
                          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-canvas p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-ink-2">
                            {JSON.stringify(log.changes, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-xs text-faint">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap font-mono text-[11px] text-mute">
                      {log.ip?.replace(/^::ffff:/, '') ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data ? (
          <Pagination
            basePath="/audit-logs"
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
