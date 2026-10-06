import { getTranslations } from 'next-intl/server';
import { getPathname, Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { serverApi } from '@/lib/api';
import { memberState } from '@/lib/member-state';
import { BannerLink } from './banner-link';
import { BagIcon, BellIcon, UserIcon } from './icons';
import { LocaleSwitcher } from './locale-switcher';
import { Logo } from './logo';
import { MobileNav, type NavItem } from './mobile-nav';
import { SearchForm } from './search-form';

function CountBadge({ count, tone = 'accent' }: { count: number; tone?: 'accent' | 'ink' }) {
  if (count <= 0) return null;
  return (
    <span
      className={`absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white ${tone === 'accent' ? 'bg-accent' : 'bg-ink'}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export async function Header({ locale }: { locale: string }) {
  const t = await getTranslations('nav');
  const { loggedIn, cartCount: count, unreadCount } = await memberState(locale);
  const searchAction = getPathname({ href: '/products', locale });

  const items: NavItem[] = [
    { href: '/products', label: t('shop') },
    { href: '/drops', label: t('drops') },
    { href: '/products?saleType=PRE_ORDER', label: t('preorders') },
    { href: '/calendar', label: t('calendar') },
    { href: '/events', label: t('events') },
    { href: '/brands', label: t('brands') },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="container-page flex h-16 items-center gap-3 md:gap-6">
        <MobileNav items={items} searchAction={searchAction} />
        <Logo />
        <nav className="hidden items-center gap-5 text-sm font-semibold text-ink-2 md:flex lg:gap-7">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <SearchForm action={searchAction} className="hidden w-56 lg:block xl:w-72" />
          <LocaleSwitcher className="hidden md:inline-flex" />
          {loggedIn ? (
            <Link
              href="/account/notifications"
              className="relative rounded-full p-2 text-ink-2 hover:bg-black/5 hover:text-ink"
              aria-label={
                unreadCount > 0
                  ? t('notificationsUnread', { count: unreadCount })
                  : t('notifications')
              }
            >
              <BellIcon />
              <CountBadge count={unreadCount} tone="ink" />
            </Link>
          ) : null}
          <Link
            href={loggedIn ? '/account' : '/login'}
            className="rounded-full p-2 text-ink-2 hover:bg-black/5 hover:text-ink"
            aria-label={loggedIn ? t('account') : t('login')}
          >
            <UserIcon />
          </Link>
          <Link
            href="/cart"
            className="relative rounded-full p-2 text-ink-2 hover:bg-black/5 hover:text-ink"
            aria-label={t('cart')}
          >
            <BagIcon />
            <CountBadge count={count} />
          </Link>
        </div>
      </div>
    </header>
  );
}

/** 全站公告列：後台發布的公告優先，沒有時顯示免運門檻 */
export async function AnnouncementBar({ locale }: { locale: AppLocale }) {
  const t = await getTranslations('announcement');
  const api = await serverApi(locale);
  const notice = await api
    .GET('/v1/banners', { params: { query: { placement: 'ANNOUNCEMENT', locale } } })
    .then(({ data }) => data?.[0])
    .catch(() => undefined);
  const text = notice?.title ?? t('shipping');
  return (
    <div className="bg-ink text-white">
      <p className="container-page py-2 text-center text-xs font-medium tracking-wide">
        {notice?.linkUrl ? (
          <BannerLink href={notice.linkUrl} className="underline-offset-4 hover:underline">
            {text}
            <span aria-hidden="true"> →</span>
          </BannerLink>
        ) : (
          text
        )}
      </p>
    </div>
  );
}
