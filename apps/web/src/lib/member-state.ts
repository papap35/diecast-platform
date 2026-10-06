import 'server-only';
import type { Schemas } from '@paddock64/api-client';
import { cache } from 'react';
import { serverApi } from './api';
import { hasSession } from './session';

export interface MemberState {
  loggedIn: boolean;
  tier: Schemas['MemberTier'] | null;
  cartCount: number;
  unreadCount: number;
  wishlistIds: string[];
  reminderIds: string[];
}

const GUEST: MemberState = {
  loggedIn: false,
  tier: null,
  cartCount: 0,
  unreadCount: 0,
  wishlistIds: [],
  reminderIds: [],
};

/**
 * 版頭與全站共用的會員狀態（等級、購物車件數、未讀通知、願望清單與提醒），API 一次取得。
 * 以 React cache 包裝：同一個請求裡版面、頁首與頁面重複呼叫只會打一次 API。
 */
export const memberState = cache(async (locale: string): Promise<MemberState> => {
  if (!(await hasSession())) return GUEST;
  try {
    const api = await serverApi(locale);
    const { data } = await api.GET('/v1/me/state');
    if (!data) return { ...GUEST, loggedIn: true };
    return {
      loggedIn: true,
      tier: data.tier,
      cartCount: data.cartCount,
      unreadCount: data.unreadNotifications,
      wishlistIds: data.wishlistIds,
      reminderIds: data.reminderIds,
    };
  } catch {
    return { ...GUEST, loggedIn: true };
  }
});
