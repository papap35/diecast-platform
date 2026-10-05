import { calculateShippingFee, canTransition, releasesStock } from './order-rules.js';

describe('calculateShippingFee', () => {
  it('宅配未滿 1,500 收 120 元，達門檻免運', () => {
    expect(calculateShippingFee('HOME_DELIVERY', 1499)).toBe(120);
    expect(calculateShippingFee('HOME_DELIVERY', 1500)).toBe(0);
  });

  it('超商取貨未滿 1,000 收 60 元，達門檻免運', () => {
    expect(calculateShippingFee('CVS_711', 999)).toBe(60);
    expect(calculateShippingFee('CVS_FAMILY', 1000)).toBe(0);
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
    expect(canTransition('COMPLETED', 'REFUNDED')).toBe(false);
  });

  it('只有未付款取消與付款後退款會釋放庫存', () => {
    expect(releasesStock('PENDING_PAYMENT', 'CANCELLED')).toBe(true);
    expect(releasesStock('PAID', 'REFUNDED')).toBe(true);
    expect(releasesStock('CANCELLED', 'REFUNDED')).toBe(false);
    expect(releasesStock('PAID', 'PROCESSING')).toBe(false);
  });
});
