import { registerDecorator, type ValidationOptions } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD 而且是真的存在的日期（Date.parse 會把 2026-02-30 當成 3 月 2 日，所以要比對回來） */
export function isCalendarDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** 日期參數（台北時間 YYYY-MM-DD） */
export function IsCalendarDay(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isCalendarDay',
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: `${String(propertyName)} 需為 YYYY-MM-DD 格式的日期`, ...options },
      validator: { validate: isCalendarDay },
    });
}
