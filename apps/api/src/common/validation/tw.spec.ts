import { CITIZEN_CERT, isValidTaxId, MOBILE_BARCODE } from './tw.js';

describe('台灣格式驗證', () => {
  it('統一編號檢查碼', () => {
    expect(isValidTaxId('04595257')).toBe(true);
    expect(isValidTaxId('10458575')).toBe(true);
    expect(isValidTaxId('12345678')).toBe(false);
    expect(isValidTaxId('1234567')).toBe(false);
  });

  it('第 7 碼為 7 時的特殊規則', () => {
    // 一般加總為 29（不可被 5 整除），28 改取 1 後為 20
    expect(isValidTaxId('10458574')).toBe(true);
    expect(isValidTaxId('10458573')).toBe(false);
  });

  it('手機條碼與自然人憑證格式', () => {
    expect(MOBILE_BARCODE.test('/ABC+123')).toBe(true);
    expect(MOBILE_BARCODE.test('ABC+1234')).toBe(false);
    expect(CITIZEN_CERT.test('AB12345678901234')).toBe(true);
    expect(CITIZEN_CERT.test('A123456789')).toBe(false);
  });
});
