import {
  calculateShippingFee,
  canTransition,
  releasesStock,
  type ShippingRates,
} from './order-rules.js';

/** 與系統設定的預設值相同 */
const RATES: ShippingRates = {
  home: { fee: 120, freeThreshold: 1500 },
  cvs: { fee: 60, freeThreshold: 1000 },
};

describe('calculateShippingFee', () => {
  it('宅配未滿 1,500 收 120 元，達門檻免運', () => {
    expect(calculateShippingFee('HOME_DELIVERY', 1499, 'ROOKIE', RATES)).toBe(120);
    expect(calculateShippingFee('HOME_DELIVERY', 1500, 'ROOKIE', RATES)).toBe(0);
  });

  it('超商取貨未滿 1,000 收 60 元，達門檻免運', () => {
    expect(calculateShippingFee('CVS_711', 999, 'ROOKIE', RATES)).toBe(60);
    expect(calculateShippingFee('CVS_FAMILY', 1000, 'ROOKIE', RATES)).toBe(0);
  });

  it('冠軍車手免運門檻打六折，傳奇車手全站免運', () => {
    expect(calculateShippingFee('CVS_711', 599, 'CHAMPION', RATES)).toBe(60);
    expect(calculateShippingFee('CVS_711', 600, 'CHAMPION', RATES)).toBe(0);
    expect(calculateShippingFee('HOME_DELIVERY', 899, 'CHAMPION', RATES)).toBe(120);
    expect(calculateShippingFee('HOME_DELIVERY', 1, 'LEGEND', RATES)).toBe(0);
    expect(calculateShippingFee('CVS_711', 999, 'DRIVER', RATES)).toBe(60);
  });

  it('依系統設定的運費計算；門檻 0 表示一律免運', () => {
    const custom: ShippingRates = {
      home: { fee: 150, freeThreshold: 2000 },
      cvs: { fee: 0, freeThreshold: 0 },
    };
    expect(calculateShippingFee('HOME_DELIVERY', 1999, 'ROOKIE', custom)).toBe(150);
    expect(calculateShippingFee('HOME_DELIVERY', 1200, 'CHAMPION', custom)).toBe(0);
    expect(calculateShippingFee('CVS_OKMART', 1, 'ROOKIE', custom)).toBe(0);
  });
});

describe('訂單狀態機', () => {
  it('允許正常流程：待付款 → 已付款 → 處理中 → 已出貨 → 已完成', () => {
    expect(canTransition('PENDING_PAYMENT', 'PAID')).toBe(true);
    expect(canTransition('PAID', 'PROCESSING')).toBe(true);
    expect(canTransition('PROCESSING', 'SHIPPED')).toBe(true);
    expect(canTransition('SHIPPED', 'COMPLETED')).toBe(true);
  });

  it('禁止逆向或跳躍的變更', () => {
    expect(canTransition('SHIPPED', 'PENDING_PAYMENT')).toBe(false);
    expect(canTransition('PENDING_PAYMENT', 'SHIPPED')).toBe(false);
    expect(canTransition('COMPLETED', 'PROCESSING')).toBe(false);
  });

  it('包裹退回與鑑賞期退貨可以退款', () => {
    expect(canTransition('SHIPPED', 'REFUNDED')).toBe(true);
    expect(canTransition('COMPLETED', 'REFUNDED')).toBe(true);
  });

  it('未付款取消與出貨完成前的退款會釋放庫存，已完成訂單的退貨不自動回補', () => {
    expect(releasesStock('PENDING_PAYMENT', 'CANCELLED')).toBe(true);
    expect(releasesStock('PAID', 'REFUNDED')).toBe(true);
    expect(releasesStock('SHIPPED', 'REFUNDED')).toBe(true);
    expect(releasesStock('CANCELLED', 'REFUNDED')).toBe(false);
    expect(releasesStock('COMPLETED', 'REFUNDED')).toBe(false);
    expect(releasesStock('PAID', 'PROCESSING')).toBe(false);
  });
});
