/** 試算表會把 = + - @ 開頭的儲存格當成公式執行（CSV injection），文字欄位一律加上單引號 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export type CsvValue = string | number | null | undefined;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  const text = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(values: CsvValue[]): string {
  return values.map(csvCell).join(',');
}

/** 加上 UTF-8 BOM，Excel 才會正確顯示中文；換行用 CRLF（RFC 4180） */
export function toCsv(header: string[], rows: CsvValue[][]): string {
  return `﻿${[header, ...rows].map(csvRow).join('\r\n')}\r\n`;
}
