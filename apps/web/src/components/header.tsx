import { getTranslations } from 'next-intl/server';
import { getPathname, Link } from '@/i18n/navigation';
import { serverApi } from '@/lib/api';
import { hasSession } from '@/lib/session';
import { BagIcon, UserIcon } from './icons';
import { LocaleSwitcher } from './locale-switcher';
import { Logo } from './logo';
import { MobileNav, type NavItem } from './mobile-nav';
import { SearchForm } from './search-form';

async function cartCount(locale: string): Promise<number> {
  try {
    const api = await serverApi(locale);
    const { data } = await api.GET('/v1/cart');
    return data?.itemCount ?? 0;
  } catch {
    return 0;
  }
}

export async function Header({ locale }: { locale: string }) {
  const t = await getTranslations('nav');
  const loggedIn = await hasSession();
  const count = loggedIn ? await cartCount(locale) : 0;
  const searchAction = getPathname({ href: '/products', locale });

  const items: NavItem[] = [
    { href: '/products', label: t('shop') },
    { href: '/drops', label: t('drops') },
    { href: '/products?saleType=PRE_ORDER', label: t('preorders') },
    { href: '/calendar', label: t('calendar') },
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
            {count > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
                {count > 99 ? '99+' : count}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}

export async function AnnouncementBar() {
  const t = await getTranslations('announcement');
  return (
    <div className="bg-ink text-white">
      <p className="container-page py-2 text-center text-xs font-medium tracking-wide">
        {t('shipping')}
      </p>
    </div>
  );
}
