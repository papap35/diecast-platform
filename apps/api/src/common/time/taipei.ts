/** 台灣不實施夏令時間，固定 UTC+8 */
const OFFSET_MS = 8 * 3_600_000;
const DAY_MS = 86_400_000;

/** 該時間點所在的台北日期 00:00（以 UTC 時間點表示） */
export function startOfTaipeiDay(date: Date): Date {
  const taipei = new Date(date.getTime() + OFFSET_MS);
  taipei.setUTCHours(0, 0, 0, 0);
  return new Date(taipei.getTime() - OFFSET_MS);
}

/** 台北日期字串（YYYY-MM-DD）的 00:00 */
export function taipeiDate(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) - OFFSET_MS);
}

/** 篩選用的期間：起日 00:00（含）到迄日隔天 00:00（不含） */
export function taipeiDayRange(from?: string, to?: string): { gte?: Date; lt?: Date } {
  return {
    ...(from ? { gte: taipeiDate(from) } : {}),
    ...(to ? { lt: new Date(taipeiDate(to).getTime() + DAY_MS) } : {}),
  };
}

/** 時間點的台北日期字串（YYYY-MM-DD） */
export function toTaipeiDay(date: Date): string {
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}
