import type { ShipmentStatus, ShippingMethod } from '../../generated/prisma/client.js';
import { ecpayDateTime, ecpayGoodsName, ecpayPersonName } from '../ecpay/format.js';

export const LOGISTICS_ENDPOINTS = {
  stage: 'https://logistics-stage.ecpay.com.tw',
  production: 'https://logistics.ecpay.com.tw',
} as const;

export interface LogisticsKind {
  logisticsType: 'CVS' | 'HOME';
  logisticsSubType: string;
}

/** 本站配送方式 → 綠界 C2C 店到店子類型（宅配使用黑貓） */
export const LOGISTICS_KIND: Record<ShippingMethod, LogisticsKind> = {
  CVS_711: { logisticsType: 'CVS', logisticsSubType: 'UNIMARTC2C' },
  CVS_FAMILY: { logisticsType: 'CVS', logisticsSubType: 'FAMIC2C' },
  CVS_HILIFE: { logisticsType: 'CVS', logisticsSubType: 'HILIFEC2C' },
  CVS_OKMART: { logisticsType: 'CVS', logisticsSubType: 'OKMARTC2C' },
  HOME_DELIVERY: { logisticsType: 'HOME', logisticsSubType: 'TCAT' },
};

/**
 * 綠界物流狀態代碼 → 本站物流狀態。各超商代碼不同，這裡收錄常見節點，
 * 其餘代碼只記錄原始訊息、不改變狀態（以綠界測試環境回傳為準持續補充）。
 */
const STATUS_BY_CODE: Record<string, ShipmentStatus> = {
  '300': 'CREATED',
  '2030': 'IN_TRANSIT',
  '3024': 'IN_TRANSIT',
  '2068': 'IN_TRANSIT',
  '2073': 'ARRIVED',
  '3018': 'ARRIVED',
  '2067': 'PICKED_UP',
  '3022': 'PICKED_UP',
  '2074': 'RETURNED',
  '3020': 'RETURNED',
  // 黑貓宅配
  '3001': 'IN_TRANSIT',
  '3006': 'IN_TRANSIT',
  '3003': 'PICKED_UP',
};

export function shipmentStatusFromCode(code: string | undefined): ShipmentStatus | null {
  return code ? (STATUS_BY_CODE[code] ?? null) : null;
}

export interface CreateResult {
  ok: boolean;
  /** 成功時的回傳欄位（AllPayLogisticsID、CVSPaymentNo…） */
  fields: Record<string, string>;
  error?: string;
}

/** 解析 Express/Create 回應：成功為「1|key=value&…」，失敗為「0|錯誤訊息」 */
export function parseCreateResponse(body: string): CreateResult {
  const separator = body.indexOf('|');
  const flag = separator === -1 ? body.trim() : body.slice(0, separator).trim();
  const rest = separator === -1 ? '' : body.slice(separator + 1);
  if (flag !== '1') return { ok: false, fields: {}, error: rest || body };
  return { ok: true, fields: Object.fromEntries(new URLSearchParams(rest)) };
}

/** 超商電子地圖選店結果（綠界以瀏覽器 POST 帶回） */
export interface CvsSelection {
  method: ShippingMethod;
  storeId: string;
  storeName: string;
  storeAddress: string;
}

const METHOD_BY_SUBTYPE = Object.fromEntries(
  Object.entries(LOGISTICS_KIND).map(([method, kind]) => [
    kind.logisticsSubType,
    method as ShippingMethod,
  ]),
);

export function selectionFromMapReply(body: Record<string, string>): CvsSelection | null {
  const method = METHOD_BY_SUBTYPE[body.LogisticsSubType ?? ''];
  if (!method || !body.CVSStoreID || !body.CVSStoreName) return null;
  return {
    method,
    storeId: body.CVSStoreID,
    storeName: body.CVSStoreName,
    storeAddress: body.CVSAddress ?? '',
  };
}

/** 電子地圖：C2C 店到店的選店頁（ExtraData 會原樣帶回，用來對應選店工作階段，限 20 字） */
export function buildMapParams(input: {
  merchantId: string;
  token: string;
  logisticsSubType: string;
  serverReplyUrl: string;
  mobile: boolean;
}): Record<string, string> {
  return {
    MerchantID: input.merchantId,
    MerchantTradeNo: input.token,
    LogisticsType: 'CVS',
    LogisticsSubType: input.logisticsSubType,
    IsCollection: 'N',
    ServerReplyURL: input.serverReplyUrl,
    ExtraData: input.token,
    Device: input.mobile ? '1' : '0',
  };
}

/** 綠界託運的申報金額上限 */
export const MAX_GOODS_AMOUNT = 20_000;

const OUTLYING_ISLANDS = ['澎湖縣', '金門縣', '連江縣'];
const normalizeCity = (value: string) => value.trim().replace(/^台/, '臺').slice(0, 3);

/** 宅配距離：00 同縣市、01 外縣市、02 離島 */
export function homeDistance(senderAddress: string, receiverCity: string): '00' | '01' | '02' {
  const receiver = normalizeCity(receiverCity);
  if (OUTLYING_ISLANDS.includes(receiver)) return '02';
  return normalizeCity(senderAddress) === receiver ? '00' : '01';
}

/** 託運單上的商品名稱：第一項商品，多項時加註件數 */
export function goodsSummary(items: { name: string; quantity: number }[]): string {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const first = items[0]?.name ?? 'Diecast model';
  return ecpayGoodsName(items.length > 1 || count > 1 ? `${first} 等 ${count} 件` : first);
}

export interface ShipmentParty {
  name: string;
  cellPhone: string;
  phone?: string;
  email?: string;
  zipCode?: string;
  address?: string;
}

export interface CreateParamsInput {
  merchantId: string;
  merchantTradeNo: string;
  tradeDate: Date;
  kind: LogisticsKind;
  goodsAmount: number;
  goodsName: string;
  sender: ShipmentParty;
  receiver: ShipmentParty & { storeId?: string; city?: string };
  serverReplyUrl: string;
}

/** Express/Create 的建單參數（不含 CheckMacValue）。不代收貨款：本站一律線上付款 */
export function buildCreateParams(input: CreateParamsInput): Record<string, string> {
  const { kind, sender, receiver } = input;
  const params: Record<string, string> = {
    MerchantID: input.merchantId,
    MerchantTradeNo: input.merchantTradeNo,
    MerchantTradeDate: ecpayDateTime(input.tradeDate),
    LogisticsType: kind.logisticsType === 'CVS' ? 'CVS' : 'Home',
    LogisticsSubType: kind.logisticsSubType,
    GoodsAmount: String(Math.min(Math.max(input.goodsAmount, 1), MAX_GOODS_AMOUNT)),
    CollectionAmount: '0',
    IsCollection: 'N',
    GoodsName: input.goodsName,
    SenderName: ecpayPersonName(sender.name),
    SenderPhone: sender.phone ?? '',
    SenderCellPhone: sender.cellPhone,
    ReceiverName: ecpayPersonName(receiver.name),
    ReceiverPhone: '',
    ReceiverCellPhone: receiver.cellPhone,
    ReceiverEmail: receiver.email ?? '',
    TradeDesc: '',
    ServerReplyURL: input.serverReplyUrl,
    ClientReplyURL: '',
    // 7-ELEVEN 店到店遇門市關轉時，綠界會通知這個網址請賣家重新選店
    LogisticsC2CReplyURL: input.serverReplyUrl,
    Remark: '',
    PlatformID: '',
  };
  if (kind.logisticsType === 'CVS') {
    params.ReceiverStoreID = receiver.storeId ?? '';
    params.ReturnStoreID = '';
  } else {
    Object.assign(params, {
      SenderZipCode: (sender.zipCode ?? '').slice(0, 5),
      SenderAddress: (sender.address ?? '').slice(0, 60),
      ReceiverZipCode: (receiver.zipCode ?? '').slice(0, 3),
      ReceiverAddress: (receiver.address ?? '').slice(0, 60),
      Temperature: '0001',
      Distance: homeDistance(sender.address ?? '', receiver.city ?? ''),
      Specification: '0001',
      ScheduledPickupTime: '4',
      ScheduledDeliveryTime: '4',
      ScheduledDeliveryDate: '',
      PackageCount: '1',
    });
  }
  return params;
}
