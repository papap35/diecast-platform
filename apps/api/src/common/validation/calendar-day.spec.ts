import { isCalendarDay } from './calendar-day.js';

describe('isCalendarDay', () => {
  it('接受存在的日期（含閏年 2 月 29 日）', () => {
    expect(isCalendarDay('2026-10-06')).toBe(true);
    expect(isCalendarDay('2028-02-29')).toBe(true);
  });

  it('拒絕不存在的日期與其他格式', () => {
    for (const value of [
      '2026-02-29',
      '2026-02-30',
      '2026-13-01',
      '2026-1-6',
      '20261006',
      '',
      20261006,
    ]) {
      expect(isCalendarDay(value)).toBe(false);
    }
  });
});
