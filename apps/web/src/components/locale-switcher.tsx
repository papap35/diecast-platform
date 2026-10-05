'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { GlobeIcon } from './icons';

const LABELS: Record<AppLocale, string> = {
  'zh-TW': '繁體中文',
  en: 'English',
  'zh-CN': '简体中文',
};

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <label
      className={`relative inline-flex items-center gap-1 text-sm text-ink-2 ${className ?? ''}`}
    >
      <GlobeIcon size={18} />
      <span className="sr-only">{t('language')}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as AppLocale;
          const query = searchParams.toString();
          startTransition(() => {
            router.replace(query ? `${pathname}?${query}` : pathname, { locale: next });
          });
        }}
        className="cursor-pointer appearance-none bg-transparent pr-1 font-medium focus:outline-none"
      >
        {routing.locales.map((code) => (
          <option key={code} value={code}>
            {LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
