import { AppException } from '../errors/app-exception.js';
import { assertNotDemoAccount } from './demo-accounts.js';

describe('assertNotDemoAccount', () => {
  const accounts = ['demo@paddock64.dev'];

  it('示範模式下保護示範帳號（不分大小寫）', () => {
    expect(() =>
      assertNotDemoAccount({ DEMO_MODE: true, DEMO_ACCOUNTS: accounts }, 'Demo@Paddock64.dev'),
    ).toThrow(AppException);
  });

  it('一般帳號與非示範模式不受影響', () => {
    expect(() =>
      assertNotDemoAccount({ DEMO_MODE: true, DEMO_ACCOUNTS: accounts }, 'someone@example.com'),
    ).not.toThrow();
    expect(() =>
      assertNotDemoAccount({ DEMO_MODE: false, DEMO_ACCOUNTS: accounts }, 'demo@paddock64.dev'),
    ).not.toThrow();
  });
});
