'use client';

import { useSyncExternalStore } from 'react';

// 全站共用一個每秒觸發的時鐘，多個倒數元件不會各自開計時器
let current = typeof window === 'undefined' ? 0 : Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      for (const notify of listeners) notify();
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** 目前時間（每秒更新）；伺服器渲染與 hydration 時使用 serverNow */
export function useNow(serverNow: number): number {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => serverNow,
  );
}
