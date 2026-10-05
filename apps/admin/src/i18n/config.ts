export const LOCALES = ['zh-TW', 'en', 'zh-CN'] as const;
export type AdminLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AdminLocale = 'zh-TW';
export const LOCALE_COOKIE = 'p64_admin_locale';

export function isLocale(value: unknown): value is AdminLocale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
