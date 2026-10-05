import { Availability, computeAvailability, isPurchasable } from './availability.js';

const now = new Date('2026-10-05T12:00:00Z');
const past = new Date('2026-10-01T00:00:00Z');
const future = new Date('2026-10-10T00:00:00Z');

describe('computeAvailability', () => {
  it('現貨依庫存判斷 IN_STOCK／LOW_STOCK／SOLD_OUT', () => {
    const base = { saleType: 'REGULAR' as const, releaseAt: null, preorderClosesAt: null };
    expect(computeAvailability({ ...base, stock: 20 }, now)).toBe(Availability.IN_STOCK);
    expect(computeAvailability({ ...base, stock: 5 }, now)).toBe(Availability.LOW_STOCK);
    expect(computeAvailability({ ...base, stock: 0 }, now)).toBe(Availability.SOLD_OUT);
  });

  it('限量發售在開賣前為 COMING_SOON，開賣後依庫存', () => {
    const drop = { saleType: 'LIMITED' as const, stock: 50, preorderClosesAt: null };
    expect(computeAvailability({ ...drop, releaseAt: future }, now)).toBe(Availability.COMING_SOON);
    expect(computeAvailability({ ...drop, releaseAt: past }, now)).toBe(Availability.IN_STOCK);
    expect(computeAvailability({ ...drop, releaseAt: past, stock: 0 }, now)).toBe(
      Availability.SOLD_OUT,
    );
  });

  it('預購在開放期間可下單，截止後關閉，名額用完顯示售完', () => {
    const preorder = { saleType: 'PRE_ORDER' as const, stock: 100, releaseAt: past };
    expect(computeAvailability({ ...preorder, preorderClosesAt: future }, now)).toBe(
      Availability.PREORDER_OPEN,
    );
    expect(computeAvailability({ ...preorder, preorderClosesAt: null }, now)).toBe(
      Availability.PREORDER_OPEN,
    );
    expect(computeAvailability({ ...preorder, preorderClosesAt: past }, now)).toBe(
      Availability.PREORDER_CLOSED,
    );
    expect(computeAvailability({ ...preorder, stock: 0, preorderClosesAt: future }, now)).toBe(
      Availability.SOLD_OUT,
    );
  });

  it('只有現貨、低庫存、預購開放中可以購買', () => {
    expect(isPurchasable(Availability.IN_STOCK)).toBe(true);
    expect(isPurchasable(Availability.LOW_STOCK)).toBe(true);
    expect(isPurchasable(Availability.PREORDER_OPEN)).toBe(true);
    expect(isPurchasable(Availability.COMING_SOON)).toBe(false);
    expect(isPurchasable(Availability.SOLD_OUT)).toBe(false);
    expect(isPurchasable(Availability.PREORDER_CLOSED)).toBe(false);
  });
});
