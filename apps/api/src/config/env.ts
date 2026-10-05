import { z } from 'zod';

const commaList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET 至少需要 32 個字元'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /** 允許呼叫 API 的前端來源（Web、Admin），以逗號分隔 */
  CORS_ORIGINS: commaList,
  /** API 對外網址，金流與物流的回呼（callback）會用到 */
  API_PUBLIC_URL: z.url().default('http://localhost:4000'),
  WEB_BASE_URL: z.url().default('http://localhost:3000'),

  ORDER_PAYMENT_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(30),
  LIMITED_PAYMENT_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(10),

  PAYMENT_PROVIDER: z.enum(['mock', 'ecpay']).default('mock'),
  ECPAY_ENV: z.enum(['stage', 'production']).default('stage'),
  ECPAY_MERCHANT_ID: z.string().default(''),
  ECPAY_HASH_KEY: z.string().default(''),
  ECPAY_HASH_IV: z.string().default(''),

  SWAGGER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`環境變數設定錯誤：\n${issues}`);
  }
  return result.data;
}
