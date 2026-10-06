import { idOf, labelOf, sanitizeForAudit } from './audit.js';

describe('操作紀錄', () => {
  it('遮蔽密碼與權杖欄位（含巢狀）', () => {
    expect(
      sanitizeForAudit({
        email: 'ops@example.com',
        password: 'Secret-123456',
        nested: { refreshToken: 'abc', apiSecret: 'xyz', note: 'ok' },
      }),
    ).toEqual({
      email: 'ops@example.com',
      password: '[REDACTED]',
      nested: { refreshToken: '[REDACTED]', apiSecret: '[REDACTED]', note: 'ok' },
    });
  });

  it('截斷過長的字串、陣列與巢狀層數', () => {
    const result = sanitizeForAudit({
      description: 'x'.repeat(500),
      images: Array.from({ length: 80 }, (_, i) => ({ url: `/img/${i}.png` })),
      deep: { a: { b: { c: { d: 1 } } } },
    }) as Record<string, unknown>;
    expect(result.description).toHaveLength(301);
    expect(result.images).toHaveLength(50);
    expect(result.deep).toEqual({ a: { b: { c: '…' } } });
  });

  it('內容過大時只記錄省略', () => {
    const items = Array.from({ length: 50 }, () => ({ body: 'y'.repeat(300) }));
    expect(sanitizeForAudit({ a: items, b: items })).toEqual({ omitted: 'too_large' });
  });

  it('依序挑選辨識文字：訂單編號優先於名稱', () => {
    expect(labelOf({ id: '1', name: '測試', orderNo: 'P64260101ABCDE' })).toBe('P64260101ABCDE');
    expect(labelOf({ email: 'a@b.c' })).toBe('a@b.c');
    expect(labelOf({ name: '  ' })).toBeNull();
    expect(labelOf(undefined)).toBeNull();
    expect(idOf({ id: 'abc' })).toBe('abc');
    expect(idOf(null)).toBeNull();
  });
});
