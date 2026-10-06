import { uuidv7 } from './random.js';

describe('UUIDv7', () => {
  it('符合 RFC 9562 的版本與變體位元', () => {
    expect(uuidv7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('前 48 位元是毫秒時間戳，可以依時間排序', () => {
    const at = Date.UTC(2026, 9, 6, 12, 0, 0, 123);
    const id = uuidv7(at);
    expect(Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(at);
    expect(uuidv7(at + 1) > id).toBe(true);
  });

  it('同一毫秒產生的 ID 不重複', () => {
    const at = Date.now();
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7(at)));
    expect(ids.size).toBe(1000);
  });
});
