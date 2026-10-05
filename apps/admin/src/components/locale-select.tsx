'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLocaleAction } from '@/app/actions/auth';

const LABELS = { 'zh-TW': '繁體中文', en: 'English', 'zh-CN': '简体中文' } as const;

export function LocaleSelect({ label }: { label: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label={label}
      value={locale}
      disabled={pending}
      onChange={(event) =>
        startTransition(async () => {
          await setLocaleAction(event.target.value);
          router.refresh();
        })
      }
      className="h-9 rounded-lg border border-line bg-surface px-2 text-sm"
    >
      {Object.entries(LABELS).map(([value, text]) => (
        <option key={value} value={value}>
          {text}
        </option>
      ))}
    </select>
  );
}
