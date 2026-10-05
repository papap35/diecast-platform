import { ecpayGoodsName, ecpayPersonName } from '../ecpay/format.js';
import {
  parseCreateResponse,
  selectionFromMapReply,
  shipmentStatusFromCode,
} from './ecpay-logistics.js';

describe('綠界物流工具', () => {
  it('解析建立物流單的成功回應', () => {
    const result = parseCreateResponse(
      '1|MerchantID=2000933&MerchantTradeNo=P261005ABC&RtnCode=300&RtnMsg=訂單處理中(已收到訂單資料)&AllPayLogisticsID=1718546&CVSPaymentNo=C9876543&CVSValidationNo=1234&CheckMacValue=ABC',
    );
    expect(result.ok).toBe(true);
    expect(result.fields).toMatchObject({
      AllPayLogisticsID: '1718546',
      CVSPaymentNo: 'C9876543',
      RtnCode: '300',
    });
  });

  it('解析失敗回應', () => {
    expect(parseCreateResponse('0|ReceiverName格式錯誤')).toEqual({
      ok: false,
      fields: {},
      error: 'ReceiverName格式錯誤',
    });
  });

  it('電子地圖回傳的門市轉成本站配送方式', () => {
    expect(
      selectionFromMapReply({
        LogisticsSubType: 'FAMIC2C',
        CVSStoreID: '006598',
        CVSStoreName: '全家台大店',
        CVSAddress: '台北市大安區',
      }),
    ).toEqual({
      method: 'CVS_FAMILY',
      storeId: '006598',
      storeName: '全家台大店',
      storeAddress: '台北市大安區',
    });
    expect(
      selectionFromMapReply({ LogisticsSubType: 'UNKNOWN', CVSStoreID: '1', CVSStoreName: 'x' }),
    ).toBeNull();
  });

  it('物流狀態代碼對照，未知代碼不改變狀態', () => {
    expect(shipmentStatusFromCode('2067')).toBe('PICKED_UP');
    expect(shipmentStatusFromCode('3018')).toBe('ARRIVED');
    expect(shipmentStatusFromCode('9999')).toBeNull();
  });

  it('姓名與商品名稱依綠界規則清理', () => {
    expect(ecpayPersonName('王小明 123')).toBe('王小明');
    expect(ecpayPersonName('歐陽一二三四五')).toBe('歐陽一二三');
    expect(ecpayPersonName('Alex Morgan')).toBe('AlexMorgan');
    expect(ecpayGoodsName('Comet #7 <限量> 100%')).toBe('Comet 7 限量 100');
  });
});
