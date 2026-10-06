import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PlusIcon } from '@/components/icons';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { AdminUserForm, ResetPasswordForm } from '@/components/system-forms';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { serverApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { can, getAdmin } from '@/lib/permissions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admins');
  return { title: t('title') };
}

export default async function AdminsPage({ searchParams }: PageProps<'/admins'>) {
  const t = await getTranslations('admins');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const me = await getAdmin();
  if (!can(me, 'admin:manage')) return <NoAccess title={t('title')} />;

  const { edit } = await searchParams;
  const api = await serverApi();
  const [{ data: admins }, { data: roles }] = await Promise.all([
    api.GET('/v1/admin/admins'),
    api.GET('/v1/admin/roles'),
  ]);
  const editing = admins?.data.find((admin) => admin.id === edit);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          editing ? (
            <ButtonLink href="/admins" variant="secondary">
              <PlusIcon size={16} />
              {t('new')}
            </ButtonLink>
          ) : null
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{t('name')}</th>
                  <th>{t('email')}</th>
                  <th>{t('role')}</th>
                  <th>{tc('status')}</th>
                  <th>{t('lastLogin')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(admins?.data ?? []).map((admin) => (
                  <tr
                    key={admin.id}
                    className={admin.id === edit ? 'bg-canvas' : 'hover:bg-canvas'}
                  >
                    <td className="font-semibold">
                      {admin.name}
                      {admin.id === me?.id ? (
                        <span className="ml-2 text-xs font-normal text-mute">{t('you')}</span>
                      ) : null}
                    </td>
                    <td className="text-ink-2">{admin.email}</td>
                    <td className="whitespace-nowrap">{admin.role.name}</td>
                    <td>
                      <Badge tone={admin.isActive ? 'ok' : 'neutral'}>
                        {admin.isActive ? t('active') : t('inactive')}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap text-xs text-mute tabular">
                      {admin.lastLoginAt ? formatDateTime(admin.lastLoginAt, locale) : '—'}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/admins?edit=${admin.id}`}
                        className="text-xs font-semibold text-mute hover:text-ink"
                      >
                        {tc('edit')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
          <AdminUserForm
            admin={editing}
            roles={roles?.data ?? []}
            isSelf={editing?.id === me?.id}
          />
          {editing && editing.id !== me?.id ? <ResetPasswordForm admin={editing} /> : null}
          {editing ? (
            <Link
              href={`/audit-logs?adminId=${editing.id}`}
              className="text-center text-xs font-semibold text-mute hover:text-ink"
            >
              {t('viewActivity')}
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
