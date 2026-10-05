import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    // 各測試檔共用同一個測試資料庫，依序執行避免互相清資料
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
