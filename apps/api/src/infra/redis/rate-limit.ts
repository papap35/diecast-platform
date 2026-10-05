import type { Redis } from 'ioredis';

const HIT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count`;

/**
 * 固定視窗計數：同一個 key 在 windowSeconds 內最多 limit 次，超過回傳 false。
 * Redis 無法使用時放行（限流只是保護，不能讓 Redis 故障擋下正常交易）。
 */
export async function consumeRateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const count = (await redis.eval(HIT, 1, key, windowSeconds)) as number;
    return count <= limit;
  } catch {
    return true;
  }
}
