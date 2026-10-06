'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { setReminderAction, setWishlistAction } from '@/app/actions/collector';
import { usePathname, useRouter } from '@/i18n/navigation';

interface CollectorState {
  loggedIn: boolean;
  isWishlisted: (productId: string) => boolean;
  hasReminder: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<void>;
  toggleReminder: (productId: string) => Promise<void>;
}

const CollectorContext = createContext<CollectorState | null>(null);

/**
 * 會員的願望清單與發售提醒狀態（版面載入時由伺服器帶入），
 * 商品卡、商品頁、行事曆的愛心與提醒按鈕共用，切換時先更新畫面再呼叫 API，失敗時還原。
 */
export function CollectorProvider({
  loggedIn,
  wishlistIds,
  reminderIds,
  children,
}: {
  loggedIn: boolean;
  wishlistIds: string[];
  reminderIds: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [wishlist, setWishlist] = useState(() => new Set(wishlistIds));
  const [reminders, setReminders] = useState(() => new Set(reminderIds));

  const toggle = useCallback(
    async (
      productId: string,
      current: Set<string>,
      set: (next: Set<string>) => void,
      action: (id: string, on: boolean) => ReturnType<typeof setWishlistAction>,
    ) => {
      if (!loggedIn) {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      const on = !current.has(productId);
      const next = new Set(current);
      if (on) next.add(productId);
      else next.delete(productId);
      set(next);
      const result = await action(productId, on);
      if (!result.ok) {
        set(current);
        if (result.error.code === 'UNAUTHORIZED') {
          router.push(`/login?next=${encodeURIComponent(pathname)}`);
        }
      }
    },
    [loggedIn, pathname, router],
  );

  const value = useMemo<CollectorState>(
    () => ({
      loggedIn,
      isWishlisted: (id) => wishlist.has(id),
      hasReminder: (id) => reminders.has(id),
      toggleWishlist: (id) => toggle(id, wishlist, setWishlist, setWishlistAction),
      toggleReminder: (id) => toggle(id, reminders, setReminders, setReminderAction),
    }),
    [loggedIn, wishlist, reminders, toggle],
  );

  return <CollectorContext value={value}>{children}</CollectorContext>;
}

export function useCollector(): CollectorState {
  const context = useContext(CollectorContext);
  if (!context) throw new Error('useCollector 必須在 CollectorProvider 內使用');
  return context;
}
