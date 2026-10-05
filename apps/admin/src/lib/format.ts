const TIME_ZONE = 'Asia/Taipei';
const DATE_LOCALES: Record<string, string> = { 'zh-TW': 'zh-TW', 'zh-CN': 'zh-CN', en: 'en-US' };

export function formatPrice(amount: number): string {
  return `NT$${amount.toLocaleString('en-US')}`;
}

/** 大數字縮寫：12,900 → 12.9K（stat tile 用） */
export function compactNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(DATE_LOCALES[locale] ?? 'zh-TW', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

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
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

/** 統一發票號碼的印刷格式：AB-12345678 */
export function formatInvoiceNo(invoiceNo: string): string {
  return /^[A-Z]{2}\d{8}$/.test(invoiceNo)
    ? `${invoiceNo.slice(0, 2)}-${invoiceNo.slice(2)}`
    : invoiceNo;
}

export function formatShortDate(value: string, locale: string): string {
  // value 為 YYYY-MM-DD（台灣日期）
  const [, m, d] = value.split('-');
  return locale === 'en' ? `${Number(m)}/${Number(d)}` : `${Number(m)}/${Number(d)}`;
}

/** datetime-local 輸入框用的台灣時間字串 YYYY-MM-DDTHH:mm */
export function toTaipeiInput(value: string | null | undefined): string {
  if (!value) return '';
  const taipei = new Date(new Date(value).getTime() + 8 * 3_600_000);
  return taipei.toISOString().slice(0, 16);
}

/** datetime-local（台灣時間）→ ISO 字串 */
export function fromTaipeiInput(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(`${value}:00+08:00`).toISOString();
}
