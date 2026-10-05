import { generateMerchantTradeNo, generateOrderNo, taipeiDateStamp } from './order-number.js';

describe('訂單編號', () => {
  it('以台灣時區計算日期（UTC 16:30 已是隔天）', () => {
    expect(taipeiDateStamp(new Date('2026-10-05T16:30:00Z'))).toBe('261006');
  });

  it('訂單編號格式固定 14 碼', () => {
    expect(generateOrderNo(new Date('2026-10-05T00:00:00Z'))).toMatch(/^P64261005[0-9A-Z]{5}$/);
  });

  it('金流交易編號不超過 20 碼且只含英數字', () => {
    const tradeNo = generateMerchantTradeNo();
    expect(tradeNo.length).toBeLessThanOrEqual(20);
    expect(tradeNo).toMatch(/^[0-9A-Z]+$/);
  });
});
