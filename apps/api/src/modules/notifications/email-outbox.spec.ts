import { MAX_EMAIL_ATTEMPTS, nextEmailAttempt } from './email-outbox.service.js';

describe('nextEmailAttempt', () => {
  const now = new Date('2026-10-06T00:00:00Z');
  const minutesLater = (attempts: number) =>
    (nextEmailAttempt(attempts, now)!.getTime() - now.getTime()) / 60_000;

  it('失敗後等待 1、5、15、60 分鐘再試', () => {
    expect([1, 2, 3, 4].map(minutesLater)).toEqual([1, 5, 15, 60]);
  });

  it(`第 ${MAX_EMAIL_ATTEMPTS} 次失敗後不再自動重試`, () => {
    expect(nextEmailAttempt(MAX_EMAIL_ATTEMPTS, now)).toBeNull();
  });
});
