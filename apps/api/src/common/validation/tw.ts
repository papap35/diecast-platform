/** 台灣相關格式驗證 */

export const TW_MOBILE = /^09\d{8}$/;
/** 手機條碼載具：/ 開頭 + 7 碼（數字、大寫英文、. + -） */
export const MOBILE_BARCODE = /^\/[0-9A-Z.+-]{7}$/;
/** 自然人憑證載具：2 碼大寫英文 + 14 碼數字 */
export const CITIZEN_CERT = /^[A-Z]{2}\d{14}$/;
/** 捐贈碼（愛心碼）：3–7 碼數字 */
export const DONATION_CODE = /^\d{3,7}$/;

/**
 * 統一編號檢查碼（2023 年財政部新制：加權和可被 5 整除）。
 * 權重 1,2,1,2,1,2,4,1，各位乘積的十位與個位相加後加總；
 * 第 7 碼為 7 時乘積 28 → 10，可再取 1 或 0 計算，任一種可被 5 整除即合法。
 */
export function isValidTaxId(taxId: string): boolean {
  if (!/^\d{8}$/.test(taxId)) return false;
  const weights = [1, 2, 1, 2, 1, 2, 4, 1];
  const digits = taxId.split('').map(Number);
  const sum = digits.reduce((acc, digit, i) => {
    const product = digit * weights[i]!;
    return acc + Math.floor(product / 10) + (product % 10);
  }, 0);
  if (sum % 5 === 0) return true;
  return digits[6] === 7 && (sum + 1) % 5 === 0;
}
