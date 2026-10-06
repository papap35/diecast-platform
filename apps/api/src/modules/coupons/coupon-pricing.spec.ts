import { AppException } from '../../common/errors/app-exception.js';
import type { ShippingRates } from '../orders/order-rules.js';
import {
  allocateDiscount,
  type CouponRule,
  priceOrder,
  splitInvoiceLine,
} from './coupon-pricing.js';

const RATES: ShippingRates = {
  home: { fee: 120, freeThreshold: 1500 },
  cvs: { fee: 60, freeThreshold: 1000 },
};

const rule = (overrides: Partial<CouponRule> = {}): CouponRule => ({
  type: 'FIXED',
  value: 100,
  minSubtotal: 0,
  maxDiscount: null,
  minTier: null,
  appliesToLimited: false,
  startsAt: null,
  endsAt: null,
  isActive: true,
  ...overrides,
});

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as AppException).code;
  }
  return null;
};

describe('優惠券計價', () => {
  it('沒有優惠券：與原本的運費規則相同', () => {
    expect(
      priceOrder([{ saleType: 'REGULAR', lineTotal: 800 }], 'CVS_711', 'ROOKIE', RATES),
    ).toEqual({
      subtotal: 800,
      discount: 0,
      lineDiscounts: [0],
      shippingFee: 60,
      shippingDiscount: 0,
      total: 860,
    });
  });

  it('固定金額：折商品不折運費；滿額免運以折扣後金額判斷', () => {
    const pricing = priceOrder(
      [{ saleType: 'REGULAR', lineTotal: 1050 }],
      'CVS_711',
      'ROOKIE',
      RATES,
      rule({ value: 100 }),
    );
    // 折後 950 未達超商免運 1,000，要付運費
    expect(pricing).toMatchObject({ discount: 100, shippingFee: 60, total: 1010 });
  });

  it('百分比折扣：無條件捨去並受折抵上限限制', () => {
    const lines = [{ saleType: 'REGULAR' as const, lineTotal: 1999 }];
    expect(
      priceOrder(lines, 'HOME_DELIVERY', 'ROOKIE', RATES, rule({ type: 'PERCENT', value: 15 }))
        .discount,
    ).toBe(299);
    expect(
      priceOrder(
        lines,
        'HOME_DELIVERY',
        'ROOKIE',
        RATES,
        rule({ type: 'PERCENT', value: 15, maxDiscount: 200 }),
      ).discount,
    ).toBe(200);
  });

  it('限量商品預設不適用：只折其他商品，門檻也只算其他商品', () => {
    const lines = [
      { saleType: 'LIMITED' as const, lineTotal: 2000 },
      { saleType: 'REGULAR' as const, lineTotal: 500 },
    ];
    const pricing = priceOrder(
      lines,
      'HOME_DELIVERY',
      'ROOKIE',
      RATES,
      rule({ type: 'PERCENT', value: 10 }),
    );
    expect(pricing).toMatchObject({ discount: 50, lineDiscounts: [0, 50] });
    expect(
      codeOf(() =>
        priceOrder(lines, 'HOME_DELIVERY', 'ROOKIE', RATES, rule({ minSubtotal: 1000 })),
      ),
    ).toBe('COUPON_MIN_SUBTOTAL');
    expect(codeOf(() => priceOrder([lines[0]!], 'HOME_DELIVERY', 'ROOKIE', RATES, rule()))).toBe(
      'COUPON_NOT_APPLICABLE',
    );
    expect(
      priceOrder([lines[0]!], 'HOME_DELIVERY', 'ROOKIE', RATES, rule({ appliesToLimited: true }))
        .discount,
    ).toBe(100);
  });

  it('免運券：運費歸零；已經免運時不能使用', () => {
    const lines = [{ saleType: 'REGULAR' as const, lineTotal: 800 }];
    expect(
      priceOrder(
        lines,
        'HOME_DELIVERY',
        'ROOKIE',
        RATES,
        rule({ type: 'FREE_SHIPPING', value: 0 }),
      ),
    ).toMatchObject({
      discount: 0,
      shippingFee: 0,
      shippingDiscount: 120,
      total: 800,
    });
    expect(
      codeOf(() =>
        priceOrder(lines, 'HOME_DELIVERY', 'LEGEND', RATES, rule({ type: 'FREE_SHIPPING' })),
      ),
    ).toBe('COUPON_NOT_APPLICABLE');
  });

  it('期間、啟用狀態與會員等級', () => {
    const lines = [{ saleType: 'REGULAR' as const, lineTotal: 800 }];
    const now = new Date('2026-10-06T00:00:00Z');
    const at = (iso: string) => new Date(iso);
    expect(
      codeOf(() => priceOrder(lines, 'CVS_711', 'ROOKIE', RATES, rule({ isActive: false }), now)),
    ).toBe('COUPON_UNAVAILABLE');
    expect(
      codeOf(() =>
        priceOrder(
          lines,
          'CVS_711',
          'ROOKIE',
          RATES,
          rule({ startsAt: at('2026-10-07T00:00:00Z') }),
          now,
        ),
      ),
    ).toBe('COUPON_UNAVAILABLE');
    expect(
      codeOf(() =>
        priceOrder(
          lines,
          'CVS_711',
          'ROOKIE',
          RATES,
          rule({ endsAt: at('2026-10-06T00:00:00Z') }),
          now,
        ),
      ),
    ).toBe('COUPON_UNAVAILABLE');
    expect(
      codeOf(() => priceOrder(lines, 'CVS_711', 'ROOKIE', RATES, rule({ minTier: 'DRIVER' }), now)),
    ).toBe('COUPON_TIER_REQUIRED');
    expect(
      priceOrder(lines, 'CVS_711', 'CHAMPION', RATES, rule({ minTier: 'DRIVER' }), now).discount,
    ).toBe(100);
  });

  it('折扣不超過適用商品的金額', () => {
    const pricing = priceOrder(
      [{ saleType: 'REGULAR', lineTotal: 80 }],
      'CVS_711',
      'ROOKIE',
      RATES,
      rule({ value: 100 }),
    );
    expect(pricing).toMatchObject({ discount: 80, lineDiscounts: [80], total: 60 });
  });
});

describe('折扣分攤', () => {
  it('依金額比例分攤，加總剛好等於折扣', () => {
    const shares = allocateDiscount(100, [
      { amount: 333, eligible: true },
      { amount: 333, eligible: true },
      { amount: 334, eligible: true },
    ]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    expect(shares).toEqual([33, 33, 34]);
  });

  it('不適用的列不分攤；每列不超過自己的金額', () => {
    const lines = [
      { amount: 999, eligible: true },
      { amount: 5000, eligible: false },
      { amount: 1, eligible: true },
    ];
    const shares = allocateDiscount(1000, lines);
    expect(shares).toEqual([999, 0, 1]);
    for (let discount = 0; discount <= 1000; discount += 37) {
      const result = allocateDiscount(discount, lines);
      expect(result.reduce((a, b) => a + b, 0)).toBe(discount);
      result.forEach((share, i) => expect(share).toBeLessThanOrEqual(lines[i]!.amount));
    }
  });
});

describe('發票品項拆列', () => {
  it('整除時一列；除不盡時拆成兩列且單價為整數', () => {
    expect(splitInvoiceLine(3, 1197)).toEqual([{ quantity: 3, unitPrice: 399 }]);
    expect(splitInvoiceLine(3, 1097)).toEqual([
      { quantity: 2, unitPrice: 366 },
      { quantity: 1, unitPrice: 365 },
    ]);
    for (const [quantity, amount] of [
      [7, 1000],
      [2, 1],
      [5, 4],
    ] as const) {
      const lines = splitInvoiceLine(quantity, amount);
      expect(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)).toBe(amount);
      expect(lines.reduce((sum, l) => sum + l.quantity, 0)).toBe(quantity);
    }
  });
});
