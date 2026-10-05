import { meetsTier, nextTier, tierFor } from './tiers.js';

describe('會員等級', () => {
  it('依累計消費計算等級，門檻當下即升級', () => {
    expect(tierFor(0)).toBe('ROOKIE');
    expect(tierFor(2_999)).toBe('ROOKIE');
    expect(tierFor(3_000)).toBe('DRIVER');
    expect(tierFor(8_000)).toBe('CHAMPION');
    expect(tierFor(250_000)).toBe('LEGEND');
  });

  it('等級比較與下一個等級', () => {
    expect(meetsTier('CHAMPION', 'DRIVER')).toBe(true);
    expect(meetsTier('DRIVER', 'CHAMPION')).toBe(false);
    expect(meetsTier(undefined, 'ROOKIE')).toBe(false);
    expect(nextTier('DRIVER')).toBe('CHAMPION');
    expect(nextTier('LEGEND')).toBeNull();
  });
});
