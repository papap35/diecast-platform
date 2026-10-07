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
  /** 資料庫連線池大小（每個 API 執行個體） */
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET 至少需要 32 個字元'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /** 允許呼叫 API 的前端來源（Web、Admin），以逗號分隔 */
  CORS_ORIGINS: commaList,
  /** API 對外網址，金流與物流的回呼（callback）會用到 */
  API_PUBLIC_URL: z.url().default('http://localhost:4000'),
  WEB_BASE_URL: z.url().default('http://localhost:3000'),

  /** 每個 IP 每分鐘的請求上限（全域限流） */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
  /** 限量發售的 Redis 預檢閘門（壓力測試比較用，正式環境保持開啟） */
  DROP_GATE_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  PAYMENT_PROVIDER: z.enum(['mock', 'ecpay']).default('mock'),
  ECPAY_ENV: z.enum(['stage', 'production']).default('stage'),
  ECPAY_MERCHANT_ID: z.string().default(''),
  ECPAY_HASH_KEY: z.string().default(''),
  ECPAY_HASH_IV: z.string().default(''),

  /** 物流：mock 使用內建模擬選店頁與假物流單；ecpay 串接綠界 C2C 店到店／宅配 */
  LOGISTICS_PROVIDER: z.enum(['mock', 'ecpay']).default('mock'),
  ECPAY_LOGISTICS_MERCHANT_ID: z.string().default(''),
  ECPAY_LOGISTICS_HASH_KEY: z.string().default(''),
  ECPAY_LOGISTICS_HASH_IV: z.string().default(''),
  SHIPPER_NAME: z.string().default('Paddock64'),
  SHIPPER_PHONE: z.string().default('0223456789'),
  SHIPPER_CELLPHONE: z.string().default('0912345678'),
  SHIPPER_ZIP: z.string().default('106'),
  SHIPPER_ADDRESS: z.string().default('臺北市大安區復興南路一段100號'),

  /** 電子發票：mock 產生模擬發票號碼；ecpay 串接綠界 B2C 電子發票 */
  INVOICE_PROVIDER: z.enum(['mock', 'ecpay']).default('mock'),
  ECPAY_INVOICE_MERCHANT_ID: z.string().default(''),
  ECPAY_INVOICE_HASH_KEY: z.string().default(''),
  ECPAY_INVOICE_HASH_IV: z.string().default(''),

  /** Email：log 只寫入紀錄（開發、示範）；resend 透過 Resend HTTP API 寄出 */
  EMAIL_PROVIDER: z.enum(['log', 'resend']).default('log'),
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('Paddock 64 <noreply@paddock64.dev>'),

  /**
   * 公開示範環境：示範帳號（帳密公開在 README）不能改密碼、停用或刪除，
   * 避免訪客把其他人鎖在外面。示範資料每天由排程重整（見 docs/deployment.md）
   */
  DEMO_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** DEMO_MODE 時受保護的帳號 Email，以逗號分隔 */
  DEMO_ACCOUNTS: z
    .string()
    .default('admin@paddock64.dev,ops@paddock64.dev,cs@paddock64.dev,demo@paddock64.dev')
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),

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
