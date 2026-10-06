import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';
import { ExternalIcon } from '@/components/icons';
import { LocaleSelect } from '@/components/locale-select';
import { Logo } from '@/components/logo';
import { SidebarNav, type NavGroup } from '@/components/sidebar-nav';
import { Badge } from '@/components/ui/badge';
import { API_BASE_URL, STOREFRONT_URL } from '@/lib/env';
import { can, getAdmin } from '@/lib/permissions';

export default async function ConsoleLayout({ children }: LayoutProps<'/'>) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const t = await getTranslations('nav');

  const allGroups: NavGroup[] = [
    {
      items: can(admin, 'dashboard:read')
        ? [{ href: '/', label: t('dashboard'), icon: 'grid' }]
        : [],
    },
    {
      label: t('catalog'),
      items: can(admin, 'product:read')
        ? [
            { href: '/products', label: t('products'), icon: 'box' },
            { href: '/brands', label: t('brands'), icon: 'tag' },
            { href: '/categories', label: t('categories'), icon: 'folder' },
          ]
        : [],
    },
    {
      label: t('sales'),
      items: [
        ...(can(admin, 'order:read')
          ? [{ href: '/orders', label: t('orders'), icon: 'receipt' as const }]
          : []),
        ...(can(admin, 'member:read')
          ? [{ href: '/members', label: t('members'), icon: 'users' as const }]
          : []),
      ],
    },
    {
      label: t('system'),
      items: can(admin, 'admin:manage')
        ? [
            { href: '/admins', label: t('admins'), icon: 'user' },
            { href: '/roles', label: t('roles'), icon: 'shield' },
            { href: '/audit-logs', label: t('auditLogs'), icon: 'clock' },
          ]
        : [],
    },
  ];
  const groups = allGroups.filter((group) => group.items.length > 0);

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[15rem_1fr]">
      <aside className="flex flex-col gap-8 bg-ink px-4 py-6 text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <div className="px-2">
          <Logo inverted />
        </div>
        {/* 手機版收合選單，桌機版常駐 */}
        <details className="group lg:hidden">
          <summary className="cursor-pointer list-none rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold">
            {t('menu')}
          </summary>
          <div className="pt-4">
            <SidebarNav groups={groups} />
          </div>
        </details>
        <div className="hidden lg:block">
          <SidebarNav groups={groups} />
        </div>
        <div className="mt-auto hidden flex-col gap-1 text-sm lg:flex">
          <a
            href={STOREFRONT_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <ExternalIcon size={16} />
            {t('storefront')}
          </a>
          <a
            href={`${API_BASE_URL}/docs`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <ExternalIcon size={16} />
            {t('apiDocs')}
          </a>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center justify-end gap-3 border-b border-line bg-surface px-6">
          <LocaleSelect label={t('language')} />
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">{admin.name}</span>
            <Badge tone="neutral">{admin.role.name}</Badge>
          </div>
          <Link
            href="/account/password"
            className="rounded-lg px-3 py-1.5 text-sm text-mute hover:bg-black/5 hover:text-ink"
          >
            {t('changePassword')}
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm text-mute hover:bg-black/5 hover:text-ink"
            >
              {t('logout')}
            </button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
