import { createCipheriv, createDecipheriv } from 'node:crypto';
import type { InvoiceType } from '../../generated/prisma/client.js';
import { splitInvoiceLine } from '../coupons/coupon-pricing.js';
import { ecpayDate } from '../ecpay/format.js';

export const INVOICE_ENDPOINTS = {
  stage: 'https://einvoice-stage.ecpay.com.tw',
  production: 'https://einvoice.ecpay.com.tw',
} as const;

/**
 * 綠界 B2C 電子發票（JSON API）的資料加密：
 * JSON → URL 編碼（空白為 +、~ 與 ' 另外編碼）→ AES-128-CBC（HashKey／HashIV，PKCS7）→ Base64
 */
export function encryptInvoiceData(data: unknown, hashKey: string, hashIV: string): string {
  const encoded = encodeURIComponent(JSON.stringify(data))
    .replace(/%20/g, '+')
    .replace(/[~']/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const cipher = createCipheriv('aes-128-cbc', hashKey, hashIV);
  return cipher.update(encoded, 'utf8', 'base64') + cipher.final('base64');
}

export function decryptInvoiceData<T>(encrypted: string, hashKey: string, hashIV: string): T {
  const decipher = createDecipheriv('aes-128-cbc', hashKey, hashIV);
  const decrypted = decipher.update(encrypted, 'base64', 'utf8') + decipher.final('utf8');
  return JSON.parse(decodeURIComponent(decrypted.replace(/\+/g, '%20'))) as T;
}

export interface InvoiceOrder {
  orderNo: string;
  total: number;
  shippingFee: number;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  invoiceType: InvoiceType;
  invoiceCarrierNum: string | null;
  invoiceDonationCode: string | null;
  invoiceTaxId: string | null;
  invoiceTitle: string | null;
  /** 公司發票需列印並隨貨寄送，使用收件地址或取貨門市地址 */
  printAddress: string;
  /** discount：分攤到這一列的優惠券折扣 */
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    discount: number;
  }[];
}

const CARRIER_TYPE: Partial<Record<InvoiceType, string>> = {
  MEMBER_CARRIER: '1',
  CITIZEN_CERT: '2',
  MOBILE_BARCODE: '3',
};

/**
 * 發票品項：商品逐項列出（金額為扣除優惠券分攤後的實收），運費列為一個品項；
 * 金額皆含稅，加總等於發票金額。單價必須是整數，除不盡時同一商品拆成兩列。
 */
function invoiceItems(order: InvoiceOrder) {
  const lines = [
    ...order.items
      .flatMap((item) =>
        item.discount === 0
          ? [{ quantity: item.quantity, unitPrice: item.unitPrice, name: item.name }]
          : splitInvoiceLine(item.quantity, item.lineTotal - item.discount).map((line) => ({
              ...line,
              name: item.name,
            })),
      )
      .map((line) => ({
        ItemName: line.name.slice(0, 100),
        ItemCount: line.quantity,
        ItemWord: '件',
        ItemPrice: line.unitPrice,
        ItemTaxType: '1',
        ItemAmount: line.quantity * line.unitPrice,
      })),
    ...(order.shippingFee > 0
      ? [
          {
            ItemName: '運費',
            ItemCount: 1,
            ItemWord: '式',
            ItemPrice: order.shippingFee,
            ItemTaxType: '1',
            ItemAmount: order.shippingFee,
          },
        ]
      : []),
  ];
  return lines.map((line, index) => ({ ItemSeq: index + 1, ...line, ItemRemark: '' }));
}

/**
 * 組出開立 B2C 發票的資料。規則（綠界）：
 * - 有統編：必須列印（Print=1），需要抬頭與地址，不可捐贈、不可使用載具
 * - 捐贈：需要捐贈碼，不可列印
 * - 載具：會員載具不帶號碼；手機條碼、自然人憑證需帶號碼
 * - 運費列為一個品項，品項金額加總必須等於發票金額（優惠券折扣已分攤進各商品）
 */
export function buildIssueData(merchantId: string, order: InvoiceOrder): Record<string, unknown> {
  const company = order.invoiceType === 'COMPANY';
  const donation = order.invoiceType === 'DONATION';
  const carrierType = CARRIER_TYPE[order.invoiceType] ?? '';

  return {
    MerchantID: merchantId,
    RelateNumber: order.orderNo,
    CustomerIdentifier: company ? order.invoiceTaxId : '',
    CustomerName: company ? order.invoiceTitle : order.recipientName,
    CustomerAddr: company ? order.printAddress : '',
    CustomerPhone: order.recipientPhone,
    CustomerEmail: order.recipientEmail,
    Print: company ? '1' : '0',
    Donation: donation ? '1' : '0',
    LoveCode: donation ? order.invoiceDonationCode : '',
    CarrierType: company || donation ? '' : carrierType,
    CarrierNum: carrierType === '2' || carrierType === '3' ? (order.invoiceCarrierNum ?? '') : '',
    TaxType: '1',
    SalesAmount: order.total,
    InvType: '07',
    vat: '1',
    Items: invoiceItems(order),
  };
}

/** 作廢發票（限開立當期） */
export function buildVoidData(input: {
  invoiceNo: string;
  invoiceDate: Date;
  reason: string;
}): Record<string, unknown> {
  return {
    InvoiceNo: input.invoiceNo,
    InvoiceDate: ecpayDate(input.invoiceDate),
    Reason: input.reason.slice(0, 20),
  };
}

/** 開立折讓單（跨期退款）：全額折讓，品項與原發票相同，以 Email 通知買方 */
export function buildAllowanceData(input: {
  invoiceNo: string;
  invoiceDate: Date;
  order: InvoiceOrder;
}): Record<string, unknown> {
  const { order } = input;
  return {
    InvoiceNo: input.invoiceNo,
    InvoiceDate: ecpayDate(input.invoiceDate),
    AllowanceNotify: 'E',
    CustomerName: order.invoiceType === 'COMPANY' ? order.invoiceTitle : order.recipientName,
    NotifyMail: order.recipientEmail,
    NotifyPhone: '',
    AllowanceAmount: order.total,
    Items: invoiceItems(order).map(({ ItemRemark: _remark, ...item }) => item),
  };
}

/** 統一發票每兩個月為一期（1–2 月、3–4 月…），以台灣時間計 */
export function invoicePeriod(date: Date): string {
  const taipei = new Date(date.getTime() + 8 * 3_600_000);
  return `${taipei.getUTCFullYear()}-${Math.floor(taipei.getUTCMonth() / 2) + 1}`;
}

/** 同一期內退款可以作廢發票；跨期只能開立折讓單 */
export function canVoidInvoice(invoiceDate: Date, now: Date): boolean {
  return invoicePeriod(invoiceDate) === invoicePeriod(now);
}

/** 綠界電子發票回應（解密後的 Data）；RtnCode 為 1 代表成功 */
export interface EcpayInvoiceResult {
  RtnCode: number;
  RtnMsg: string;
}

export interface IssueResult extends EcpayInvoiceResult {
  InvoiceNo?: string;
  InvoiceDate?: string;
  RandomNumber?: string;
}

/** 查詢發票（GetIssue）回應的主要欄位 */
export interface GetIssueResult extends EcpayInvoiceResult {
  IIS_Number?: string;
  IIS_Relate_Number?: string;
  IIS_Create_Date?: string;
  IIS_Random_Number?: string;
  /** 1：已作廢 */
  IIS_Invalid_Status?: string;
}

export interface AllowanceResult extends EcpayInvoiceResult {
  IA_Allow_No?: string;
  IA_Invoice_No?: string;
  IA_Date?: string;
  IA_Remain_Allowance_Amt?: number;
}
