import { routing } from '@/i18n/routing';

/**
 * canonical 與各語系版本的網址（hreflang）。path 不含語系前綴，例如 /products/vortex-gt3。
 * 每一頁要指向「同一頁」的其他語系版本，不能都指向首頁。
 */
export function localeAlternates(locale: string, path = '') {
  return {
    canonical: `/${locale}${path}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}${path}`])),
      'x-default': `/${routing.defaultLocale}${path}`,
    },
  };
}
