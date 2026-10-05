export const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/paddock64_test',
  REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15',
  JWT_SECRET: 'test-secret-test-secret-test-secret-0000',
  PAYMENT_PROVIDER: 'mock',
  // 綠界公開的測試商店（全方位金流）
  ECPAY_MERCHANT_ID: '2000132',
  ECPAY_HASH_KEY: '5294y06JbISpM5x9',
  ECPAY_HASH_IV: 'v77hoKGq4kWxNNIS',
  // 綠界公開的測試商店（C2C 店到店物流、B2C 電子發票）
  LOGISTICS_PROVIDER: 'mock',
  ECPAY_LOGISTICS_MERCHANT_ID: '2000933',
  ECPAY_LOGISTICS_HASH_KEY: 'XBERn1YOvpM9nfZc',
  ECPAY_LOGISTICS_HASH_IV: 'h1ONHk4P4yqbl5LK',
  INVOICE_PROVIDER: 'mock',
  ECPAY_INVOICE_MERCHANT_ID: '2000132',
  ECPAY_INVOICE_HASH_KEY: 'ejCk326UnaZWKisg',
  ECPAY_INVOICE_HASH_IV: 'q9jcZX8Ib9LM8wYk',
  API_PUBLIC_URL: 'http://api.test',
  WEB_BASE_URL: 'http://web.test',
  SWAGGER_ENABLED: 'false',
} as const;

Object.assign(process.env, TEST_ENV);
