'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { CloseIcon, MenuIcon } from './icons';
import { LocaleSwitcher } from './locale-switcher';
import { SearchForm } from './search-form';

export interface NavItem {
  href: string;
  label: string;
}

export function MobileNav({ items, searchAction }: { items: NavItem[]; searchAction: string }) {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-ml-2 rounded-full p-2 hover:bg-black/5"
        aria-label={t('menu')}
        aria-expanded={open}
      >
        <MenuIcon />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label={t('close')}
            onClick={() => setOpen(false)}
          />
          <nav className="relative flex h-full w-80 max-w-[85vw] flex-col gap-6 bg-surface p-5 shadow-lift">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{t('menu')}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 hover:bg-black/5"
                aria-label={t('close')}
              >
                <CloseIcon />
              </button>
            </div>
            <div onSubmit={() => setOpen(false)}>
              <SearchForm action={searchAction} />
            </div>
            <ul className="flex flex-col">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-line py-3.5 text-base font-semibold"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <LocaleSwitcher className="mt-auto inline-flex" />
          </nav>
        </div>
      ) : null}
    </div>
  );
}
