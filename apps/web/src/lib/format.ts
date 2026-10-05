const TIME_ZONE = 'Asia/Taipei';

/** 新台幣金額：NT$1,280 */
export function formatPrice(amount: number): string {
  return `NT$${amount.toLocaleString('en-US')}`;
}

const DATE_LOCALES: Record<string, string> = { 'zh-TW': 'zh-TW', 'zh-CN': 'zh-CN', en: 'en-US' };

export function formatDateTime(value: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale] ?? 'zh-TW', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export function formatDate(value: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale] ?? 'zh-TW', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}

/** 行事曆用：月／日、星期、時間 */
export function formatReleaseParts(value: string | Date, locale: string) {
  const date = new Date(value);
  const dl = DATE_LOCALES[locale] ?? 'zh-TW';
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(dl, { timeZone: TIME_ZONE, ...options }).format(date);
  return {
    month: part({ month: 'short' }),
    day: part({ day: 'numeric' }),
    weekday: part({ weekday: 'short' }),
    time: part({ hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

/** 國家代碼 → 當地語系的國名 */
export function countryName(code: string | null | undefined, locale: string): string | null {
  if (!code) return null;
  try {
    return (
      new Intl.DisplayNames([DATE_LOCALES[locale] ?? 'zh-TW'], { type: 'region' }).of(code) ?? code
    );
  } catch {
    return code;
  }
}

/** 國家代碼 → 國旗 emoji */
export function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split('')
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}
