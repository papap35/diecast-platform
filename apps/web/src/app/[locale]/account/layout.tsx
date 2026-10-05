import { getTranslations } from 'next-intl/server';
import { logoutAction } from '@/app/actions/auth';
import { Link, redirect } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/page-locale';
import { hasSession } from '@/lib/session';

export default async function AccountLayout({
  children,
  params,
}: LayoutProps<'/[locale]/account'>) {
  const locale = await pageLocale(params);
  if (!(await hasSession())) redirect({ href: '/login?next=/account', locale });
  const t = await getTranslations('account');
  const nav = await getTranslations('nav');

  return (
    <div className="container-page grid gap-8 py-10 lg:grid-cols-[14rem_1fr]">
      <aside className="h-fit space-y-1 rounded-3xl bg-surface p-3 ring-1 ring-line lg:sticky lg:top-24">
        <Link
          href="/account"
          className="block rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-paper"
        >
          {t('profile')}
        </Link>
        <Link
          href="/account/orders"
          className="block rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-paper"
        >
          {t('orders')}
        </Link>
        <form action={logoutAction}>
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className="block w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-mute hover:bg-paper hover:text-ink"
          >
            {nav('logout')}
          </button>
        </form>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
