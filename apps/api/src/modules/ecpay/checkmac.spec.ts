import { ecpayUrlEncode, generateCheckMacValue, verifyCheckMacValue } from './checkmac.js';

// 綠界公開的測試商店（全方位金流）
const HASH_KEY = '5294y06JbISpM5x9';
const HASH_IV = 'v77hoKGq4kWxNNIS';

// 期望值由綠界官方 Node.js SDK（ecpay_aio_nodejs 1.2.2 的 gen_chk_mac_value）對同一組參數計算得出
const PARAMS = {
  MerchantID: '2000132',
  MerchantTradeNo: 'P261005ABCDEFGHJKLM',
  MerchantTradeDate: '2026/10/05 20:15:30',
  PaymentType: 'aio',
  TotalAmount: '1460',
  TradeDesc: 'Paddock 64 訂單',
  ItemName: "Shiden RS Coupe（午夜紫） x 2#Formosa Taxi '95 x 1",
  ReturnURL: 'https://api.paddock64.dev/v1/payments/ecpay/notify',
  OrderResultURL: 'https://api.paddock64.dev/v1/payments/ecpay/return',
  ChoosePayment: 'ALL',
  EncryptType: '1',
  CustomField1: 'a~b (c)*!',
};
const EXPECTED = '8242C2C99A15A9965F0398ABBC71C395A3E88ACB5FB70040C9FF3E60FB8EFBED';

describe('綠界 CheckMacValue', () => {
  it('與官方 SDK 計算結果一致（含中文、空白與特殊字元）', () => {
    expect(generateCheckMacValue(PARAMS, HASH_KEY, HASH_IV)).toBe(EXPECTED);
  });

  it('參數順序不影響結果', () => {
    const reversed = Object.fromEntries(Object.entries(PARAMS).reverse());
    expect(generateCheckMacValue(reversed, HASH_KEY, HASH_IV)).toBe(EXPECTED);
  });

  it('URL 編碼保留 - _ . ! * ( )，並把空白轉成 +', () => {
    expect(ecpayUrlEncode("a b-c_d.e!f*g(h)i'j~k")).toBe('a+b-c_d.e!f*g(h)i%27j%7ek');
  });

  it('驗證時接受正確檢查碼、拒絕被竄改的資料', () => {
    const signed = { ...PARAMS, CheckMacValue: EXPECTED };
    expect(verifyCheckMacValue(signed, HASH_KEY, HASH_IV)).toBe(true);
    expect(verifyCheckMacValue({ ...signed, TotalAmount: '1' }, HASH_KEY, HASH_IV)).toBe(false);
    expect(verifyCheckMacValue({ ...PARAMS }, HASH_KEY, HASH_IV)).toBe(false);
  });
});
