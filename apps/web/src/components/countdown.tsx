'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useNow } from '@/lib/clock';
import { cn } from '@/lib/cn';

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/**
 * 倒數計時。伺服器渲染時先以 serverNow 計算，避免 hydration 不一致；
 * 掛載後跟著全站時鐘每秒更新；onElapsedReload 時，倒數結束會重新整理頁面（讓「立即購買」出現）。
 */
export function Countdown({
  target,
  serverNow,
  variant = 'blocks',
  className,
  onElapsedReload = false,
}: {
  target: string;
  serverNow: number;
  variant?: 'blocks' | 'inline';
  className?: string;
  onElapsedReload?: boolean;
}) {
  const t = useTranslations('countdown');
  const targetMs = new Date(target).getTime();
  const now = useNow(serverNow);

  const remaining = targetMs - now;
  useEffect(() => {
    if (onElapsedReload && remaining <= 0 && targetMs - serverNow > 0) {
      window.location.reload();
    }
  }, [onElapsedReload, remaining, serverNow, targetMs]);

  if (remaining <= 0) {
    return <span className={cn('font-semibold text-accent', className)}>{t('live')}</span>;
  }

  const { days, hours, minutes, seconds } = parts(remaining);
  const pad = (n: number) => String(n).padStart(2, '0');

  if (variant === 'inline') {
    return (
      <span className={cn('tabular font-semibold', className)} suppressHydrationWarning>
        {days > 0 ? `${days}${t('days')} ` : ''}
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    );
  }

  const units = [
    { value: days, label: t('days') },
    { value: hours, label: t('hours') },
    { value: minutes, label: t('minutes') },
    { value: seconds, label: t('seconds') },
  ];
  return (
    <div className={cn('flex gap-2', className)} role="timer" suppressHydrationWarning>
      {units.map((unit) => (
        <div
          key={unit.label}
          className="flex min-w-14 flex-col items-center rounded-xl bg-white/10 px-2 py-2 ring-1 ring-white/15"
        >
          <span className="tabular font-display text-2xl font-bold" suppressHydrationWarning>
            {pad(unit.value)}
          </span>
          <span className="text-[11px] opacity-70">{unit.label}</span>
        </div>
      ))}
    </div>
  );
}
