'use client';

import type { Schemas } from '@paddock64/api-client';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { markNotificationsReadAction } from '@/app/actions/collector';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { Button } from './ui/button';

type Notification = Schemas['NotificationDto'];

/** 通知列表：未讀的有標示；點開時標為已讀並前往相關頁面 */
export function NotificationList({
  notifications,
  unreadCount,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (notifications.length === 0) {
    return (
      <p className="rounded-3xl bg-surface p-10 text-center text-sm text-mute ring-1 ring-line">
        {t('empty')}
      </p>
    );
  }

  const open = (notification: Notification) =>
    startTransition(async () => {
      if (!notification.readAt) await markNotificationsReadAction([notification.id]);
      if (notification.link) router.push(notification.link);
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-mute">{t('unreadCount', { count: unreadCount })}</p>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending || unreadCount === 0}
          onClick={() => startTransition(async () => void (await markNotificationsReadAction()))}
        >
          {t('markAllRead')}
        </Button>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
        {notifications.map((notification) => (
          <li key={notification.id}>
            <button
              type="button"
              onClick={() => open(notification)}
              disabled={pending}
              className={cn(
                'flex w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-paper',
                !notification.readAt && 'bg-info-soft/40',
              )}
            >
              <span
                className={cn(
                  'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                  notification.readAt ? 'bg-transparent' : 'bg-accent',
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span
                    className={cn('text-sm', notification.readAt ? 'font-medium' : 'font-bold')}
                  >
                    {notification.title}
                    {!notification.readAt ? (
                      <span className="sr-only">（{t('unread')}）</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-mute tabular">
                    {formatDateTime(notification.createdAt, locale)}
                  </span>
                </span>
                <span className="mt-0.5 block text-sm text-ink-2">{notification.body}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
