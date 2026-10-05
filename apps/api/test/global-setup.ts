import { execSync } from 'node:child_process';
import { TEST_ENV } from './test-env.js';

/** e2e 測試開始前，把測試資料庫遷移到最新 schema（非破壞性的 migrate deploy） */
export default function setup(): void {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, ...TEST_ENV, DIRECT_DATABASE_URL: TEST_ENV.DATABASE_URL },
    stdio: 'pipe',
  });
}
