export const SUPPORTED_LOCALES = ['zh-TW', 'en', 'zh-CN'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'zh-TW';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * 依序採用：明確指定的 locale → Accept-Language 中第一個支援的語系 → 預設繁中。
 */
export function resolveLocale(explicit?: string | null, acceptLanguage?: string | null): Locale {
  if (isLocale(explicit)) return explicit;
  if (acceptLanguage) {
    const candidates = acceptLanguage
      .split(',')
      .map((part) => {
        const [tag = '', ...params] = part.trim().split(';');
        const q = params.find((p) => p.trim().startsWith('q='));
        return { tag: tag.trim(), q: q ? Number(q.trim().slice(2)) : 1 };
      })
      .sort((a, b) => b.q - a.q);
    for (const { tag } of candidates) {
      const lower = tag.toLowerCase();
      if (lower === 'zh-tw' || lower === 'zh-hant' || lower.startsWith('zh-hant')) return 'zh-TW';
      if (lower === 'zh-cn' || lower === 'zh-hans' || lower.startsWith('zh-hans') || lower === 'zh')
        return 'zh-CN';
      if (lower === 'en' || lower.startsWith('en-')) return 'en';
    }
  }
  return DEFAULT_LOCALE;
}

const FALLBACK_ORDER: Record<Locale, Locale[]> = {
  'zh-TW': ['zh-TW', 'zh-CN', 'en'],
  'zh-CN': ['zh-CN', 'zh-TW', 'en'],
  en: ['en', 'zh-TW', 'zh-CN'],
};

/** 從翻譯陣列挑出指定語系；缺翻譯時依語系相近程度回退，確保畫面不會空白 */
export function pickTranslation<T extends { locale: string }>(
  translations: readonly T[],
  locale: Locale,
): T | undefined {
  for (const candidate of FALLBACK_ORDER[locale]) {
    const found = translations.find((t) => t.locale === candidate);
    if (found) return found;
  }
  return translations[0];
}
