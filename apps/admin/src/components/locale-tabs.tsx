'use client';

import { type ReactNode, useState } from 'react';
import { cn } from '@/lib/cn';

export const FORM_LOCALES = [
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
] as const;

export type FormLocale = (typeof FORM_LOCALES)[number]['code'];

/** 多語系欄位的分頁：繁中必填，其他語系留白時前台回退繁中 */
export function LocaleTabs({ children }: { children: (locale: FormLocale) => ReactNode }) {
  const [tab, setTab] = useState<FormLocale>('zh-TW');
  return (
    <>
      <div className="mb-4 flex gap-1 rounded-lg bg-canvas p-1" role="tablist">
        {FORM_LOCALES.map((locale) => (
          <button
            key={locale.code}
            type="button"
            role="tab"
            aria-selected={tab === locale.code}
            onClick={() => setTab(locale.code)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-semibold',
              tab === locale.code ? 'bg-surface shadow-sm' : 'text-mute hover:text-ink',
            )}
          >
            {locale.label}
            {locale.code === 'zh-TW' ? <span className="ml-1 text-accent">*</span> : null}
          </button>
        ))}
      </div>
      {FORM_LOCALES.map((locale) => (
        <div key={locale.code} className={cn('grid gap-4', tab === locale.code ? '' : 'hidden')}>
          {children(locale.code)}
        </div>
      ))}
    </>
  );
}
