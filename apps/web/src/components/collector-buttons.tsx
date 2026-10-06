'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { cn } from '@/lib/cn';
import { useCollector } from './collector-context';
import { BellIcon, HeartIcon } from './icons';

/** 願望清單愛心：icon（商品卡右上角）或 full（商品頁的文字按鈕） */
export function WishlistButton({
  productId,
  variant = 'icon',
  className,
}: {
  productId: string;
  variant?: 'icon' | 'full';
  className?: string;
}) {
  const t = useTranslations('collector');
  const { isWishlisted, toggleWishlist } = useCollector();
  const [pending, startTransition] = useTransition();
  const active = isWishlisted(productId);
  const label = active ? t('wishlisted') : t('addToWishlist');
  const onClick = () => startTransition(() => toggleWishlist(productId));

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={active}
        aria-label={label}
        title={label}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 shadow-card backdrop-blur transition-colors hover:text-accent',
          active ? 'text-accent' : 'text-ink-2',
          className,
        )}
      >
        <HeartIcon size={18} filled={active} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={active}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors',
        active
          ? 'border-accent/40 bg-accent-soft text-accent'
          : 'border-line-strong bg-surface text-ink hover:border-ink',
        className,
      )}
    >
      <HeartIcon size={18} filled={active} />
      {label}
    </button>
  );
}

/** 發售提醒：開賣（或你的優先購開始）前 15 分鐘通知 */
export function ReminderButton({
  productId,
  tone = 'light',
  className,
}: {
  productId: string;
  /** dark：放在深色倒數區塊上 */
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const t = useTranslations('collector');
  const { hasReminder, toggleReminder } = useCollector();
  const [pending, startTransition] = useTransition();
  const active = hasReminder(productId);
  return (
    <button
      type="button"
      onClick={() => startTransition(() => toggleReminder(productId))}
      disabled={pending}
      aria-pressed={active}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors',
        tone === 'dark'
          ? active
            ? 'bg-white text-ink'
            : 'bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20'
          : active
            ? 'bg-ink text-white'
            : 'border border-line-strong bg-surface text-ink hover:border-ink',
        className,
      )}
    >
      <BellIcon size={18} filled={active} />
      {active ? t('reminderSet') : t('remindMe')}
    </button>
  );
}
