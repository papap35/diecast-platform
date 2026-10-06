import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PlusIcon } from '@/components/icons';
import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { RoleForm } from '@/components/system-forms';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { serverApi } from '@/lib/api';
import { can, getAdmin } from '@/lib/permissions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('roles');
  return { title: t('title') };
}

export default async function RolesPage({ searchParams }: PageProps<'/roles'>) {
  const t = await getTranslations('roles');
  const tc = await getTranslations('common');
  const me = await getAdmin();
  if (!can(me, 'admin:manage')) return <NoAccess title={t('title')} />;

  const { edit } = await searchParams;
  const api = await serverApi();
  const { data } = await api.GET('/v1/admin/roles');
  const roles = data?.data ?? [];
  const editing = roles.find((role) => role.id === edit);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          editing ? (
            <ButtonLink href="/roles" variant="secondary">
              <PlusIcon size={16} />
              {t('new')}
            </ButtonLink>
          ) : null
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{t('name')}</th>
                  <th>{t('permissions')}</th>
                  <th className="text-right">{t('admins')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className={role.id === edit ? 'bg-canvas' : 'hover:bg-canvas'}>
                    <td>
                      <div className="flex items-center gap-2 font-semibold">
                        {role.name}
                        {role.isSystem ? <Badge tone="neutral">{t('system')}</Badge> : null}
                      </div>
                      {role.description ? (
                        <p className="mt-0.5 text-xs text-mute">{role.description}</p>
                      ) : null}
                    </td>
                    <td className="text-xs text-ink-2">
                      {role.isLocked
                        ? t('allPermissions')
                        : t('permissionCount', { count: role.permissions.length })}
                    </td>
                    <td className="text-right tabular">{role.adminCount}</td>
                    <td className="text-right">
                      <Link
                        href={`/roles?edit=${role.id}`}
                        className="text-xs font-semibold text-mute hover:text-ink"
                      >
                        {role.isLocked ? tc('view') : tc('edit')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <RoleForm
            role={editing}
            permissions={data?.permissions ?? []}
            isOwnRole={!!editing && editing.key === me?.role.key}
          />
        </div>
      </div>
    </>
  );
}
