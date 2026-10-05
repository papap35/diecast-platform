export const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/paddock64_test',
  REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15',
  JWT_SECRET: 'test-secret-test-secret-test-secret-0000',
  PAYMENT_PROVIDER: 'mock',
  SWAGGER_ENABLED: 'false',
} as const;

Object.assign(process.env, TEST_ENV);
