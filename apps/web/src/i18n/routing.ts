import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['zh-TW', 'en', 'zh-CN'],
  defaultLocale: 'zh-TW',
  localeCookie: { name: 'p64_locale', maxAge: 60 * 60 * 24 * 365 },
});

export type AppLocale = (typeof routing.locales)[number];
