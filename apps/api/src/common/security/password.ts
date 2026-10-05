import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const KEY_LENGTH = 64;
const PARAMS: Required<Pick<ScryptOptions, 'N' | 'r' | 'p'>> = { N: 16384, r: 8, p: 1 };

function scryptAsync(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, options, (error, derived) =>
      error ? reject(error) : resolve(derived),
    );
  });
}

/**
 * 使用 Node 內建 scrypt 雜湊密碼（不需原生套件，部署到任何平台都能運作）。
 * 格式：scrypt$N$r$p$salt$hash（皆為 base64url），參數寫在雜湊裡，日後可平滑調整強度。
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, PARAMS);
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const derived = await scryptAsync(password, Buffer.from(saltB64, 'base64url'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
