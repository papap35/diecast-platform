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
  API_PUBLIC_URL: 'http://api.test',
  WEB_BASE_URL: 'http://web.test',
  SWAGGER_ENABLED: 'false',
} as const;

Object.assign(process.env, TEST_ENV);
