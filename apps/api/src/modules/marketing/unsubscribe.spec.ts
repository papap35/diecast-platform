import { listUnsubscribeHeaders, unsubscribeToken, verifyUnsubscribeToken } from './unsubscribe.js';

const SECRET = 'test-secret-that-is-long-enough-123456';
const MEMBER = '01900000-0000-7000-8000-000000000001';

describe('退訂權杖', () => {
  it('簽發後可驗證回會員 id', () => {
    expect(verifyUnsubscribeToken(unsubscribeToken(MEMBER, SECRET), SECRET)).toBe(MEMBER);
  });

  it('改過的 id、錯的簽章或密鑰都驗證失敗', () => {
    const token = unsubscribeToken(MEMBER, SECRET);
    const other = '01900000-0000-7000-8000-000000000002';
    expect(verifyUnsubscribeToken(token.replace(MEMBER, other), SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(`${MEMBER}.forged`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(token, 'another-secret-another-secret-12')).toBeNull();
    expect(verifyUnsubscribeToken('not-a-token', SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(`${token}.extra`, SECRET)).toBeNull();
  });

  it('一鍵退訂的信件標頭', () => {
    expect(
      listUnsubscribeHeaders('https://api.example.com/v1/unsubscribe/one-click?token=x'),
    ).toEqual({
      'List-Unsubscribe': '<https://api.example.com/v1/unsubscribe/one-click?token=x>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });
});
