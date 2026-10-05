import { vi } from 'vitest';
import { verifyCheckMacValue } from '../src/modules/ecpay/checkmac.js';
import { ecpayDateTime } from '../src/modules/ecpay/format.js';
import { decryptInvoiceData, encryptInvoiceData } from '../src/modules/invoices/ecpay-invoice.js';
import { InvoicesService, MAX_INVOICE_ATTEMPTS } from '../src/modules/invoices/invoices.service.js';
import { createAdmin, placePaidOrder, registerMember } from './fixtures.js';
import { TEST_ENV } from './test-env.js';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

// 這個測試檔改用綠界物流與電子發票（金流仍為模擬）；對綠界的 HTTP 呼叫以 stub 取代，驗證送出的內容
process.env.LOGISTICS_PROVIDER = 'ecpay';
process.env.INVOICE_PROVIDER = 'ecpay';

const LOGISTICS_KEY = TEST_ENV.ECPAY_LOGISTICS_HASH_KEY;
const LOGISTICS_IV = TEST_ENV.ECPAY_LOGISTICS_HASH_IV;
const INVOICE_KEY = TEST_ENV.ECPAY_INVOICE_HASH_KEY;
const INVOICE_IV = TEST_ENV.ECPAY_INVOICE_HASH_IV;

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

/** 綠界電子發票的回應：Data 以同一組金鑰加密 */
function invoiceReply(data: Record<string, unknown>): Response {
  return Response.json({
    MerchantID: TEST_ENV.ECPAY_INVOICE_MERCHANT_ID,
    TransCode: 1,
    TransMsg: 'Success',
    Data: encryptInvoiceData(data, INVOICE_KEY, INVOICE_IV),
  });
}

function sentInvoiceData(init: RequestInit): Record<string, unknown> {
  const body = JSON.parse(String(init.body)) as { MerchantID: string; Data: string };
  expect(body.MerchantID).toBe(TEST_ENV.ECPAY_INVOICE_MERCHANT_ID);
  return decryptInvoiceData(body.Data, INVOICE_KEY, INVOICE_IV);
}

/** 以目前時間當作開立時間（綠界格式），作廢／折讓的判斷才不會因測試執行日期而改變 */
const nowEcpay = () => ecpayDateTime(new Date()).replace(/\//g, '-');

describe('綠界物流與電子發票串接 (e2e)', () => {
  let ctx: TestContext;
  let invoices: InvoicesService;
  let handler: Handler;
  const calls: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    invoices = ctx.app.get(InvoicesService);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      calls.push(new URL(url).pathname);
      return handler(url, init ?? {});
    });
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    calls.length = 0;
    handler = () => {
      throw new Error('未預期的 HTTP 呼叫');
    };
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await ctx.app.close();
  });

  describe('物流', () => {
    it('選店回傳綠界電子地圖表單（C2C 子類型、MD5 檢查碼、ExtraData 帶工作階段代碼）', async () => {
      const member = await registerMember(ctx);
      const map = await ctx
        .http()
        .post('/v1/logistics/cvs-map')
        .set(member.auth)
        .send({ method: 'CVS_OKMART', mobile: true })
        .expect(201);
      expect(map.body).toMatchObject({
        type: 'form_post',
        url: 'https://logistics-stage.ecpay.com.tw/Express/map',
      });
      expect(map.body.fields).toMatchObject({
        MerchantID: TEST_ENV.ECPAY_LOGISTICS_MERCHANT_ID,
        LogisticsType: 'CVS',
        LogisticsSubType: 'OKMARTC2C',
        IsCollection: 'N',
        ExtraData: map.body.token,
        Device: '1',
        ServerReplyURL: 'http://api.test/v1/logistics/ecpay/map-reply',
      });
      expect(map.body.token).toHaveLength(20);
      expect(verifyCheckMacValue(map.body.fields, LOGISTICS_KEY, LOGISTICS_IV, 'md5')).toBe(true);
    });

    it('超商建單：送出簽章正確的參數，記錄寄貨編號並把訂單轉為處理中', async () => {
      const admin = await createAdmin(ctx);
      const { order } = await placePaidOrder(ctx);
      let sent: Record<string, string> = {};
      handler = (url, init) => {
        expect(url).toBe('https://logistics-stage.ecpay.com.tw/Express/Create');
        sent = Object.fromEntries(new URLSearchParams(String(init.body)));
        return new Response(
          `1|MerchantID=2000933&MerchantTradeNo=${sent.MerchantTradeNo}&RtnCode=300&RtnMsg=訂單處理中(已收到訂單資料)` +
            `&AllPayLogisticsID=1718546&LogisticsType=CVS&LogisticsSubType=UNIMARTC2C&GoodsAmount=${sent.GoodsAmount}` +
            '&UpdateStatusDate=2026/10/05 20:30:00&ReceiverName=王小明&ReceiverPhone=&ReceiverCellPhone=0912345678' +
            '&ReceiverEmail=&ReceiverAddress=&CVSPaymentNo=C9876543&CVSValidationNo=1234&BookingNote=&CheckMacValue=0',
        );
      };

      const res = await ctx
        .http()
        .post(`/v1/admin/orders/${order.id}/shipment`)
        .set(admin.auth)
        .expect(201);
      expect(verifyCheckMacValue(sent, LOGISTICS_KEY, LOGISTICS_IV, 'md5')).toBe(true);
      expect(sent).toMatchObject({
        MerchantID: TEST_ENV.ECPAY_LOGISTICS_MERCHANT_ID,
        LogisticsType: 'CVS',
        LogisticsSubType: 'UNIMARTC2C',
        ReceiverStoreID: '131386',
        ReceiverName: '王小明',
        ReceiverCellPhone: '0912345678',
        IsCollection: 'N',
        GoodsAmount: String(order.total),
        ServerReplyURL: 'http://api.test/v1/logistics/ecpay/notify',
        SenderName: 'Paddock',
      });
      expect(sent.MerchantTradeNo).toMatch(/^P\d{6}[0-9A-Z]{12}$/);
      expect(res.body.status).toBe('PROCESSING');
      expect(res.body.shipment).toMatchObject({
        provider: 'ECPAY',
        status: 'CREATED',
        shipmentNo: 'C9876543',
        validationNo: '1234',
        logisticsId: '1718546',
        statusCode: '300',
        merchantTradeNo: sent.MerchantTradeNo,
      });
    });

    it('宅配建單帶入郵遞區號、地址與配送距離（外縣市）', async () => {
      const admin = await createAdmin(ctx);
      const { order } = await placePaidOrder(ctx, {
        checkout: {
          shippingMethod: 'HOME_DELIVERY',
          recipientName: 'Alex Morgan',
          recipientPhone: '0987654321',
          postalCode: '407756',
          city: '臺中市',
          district: '西屯區',
          addressLine: '福星路 300 號 5 樓',
          invoiceType: 'MEMBER_CARRIER',
        },
      });
      let sent: Record<string, string> = {};
      handler = (_url, init) => {
        sent = Object.fromEntries(new URLSearchParams(String(init.body)));
        return new Response(
          '1|RtnCode=300&RtnMsg=訂單處理中(已收到訂單資料)&AllPayLogisticsID=1718999&BookingNote=9012345678&CVSPaymentNo=&CVSValidationNo=',
        );
      };
      const res = await ctx
        .http()
        .post(`/v1/admin/orders/${order.id}/shipment`)
        .set(admin.auth)
        .expect(201);
      expect(sent).toMatchObject({
        LogisticsType: 'Home',
        LogisticsSubType: 'TCAT',
        ReceiverName: 'AlexMorgan',
        ReceiverZipCode: '407',
        ReceiverAddress: '臺中市西屯區福星路 300 號 5 樓',
        SenderZipCode: '106',
        Distance: '01',
        Temperature: '0001',
        Specification: '0001',
      });
      expect(sent).not.toHaveProperty('ReceiverStoreID');
      expect(verifyCheckMacValue(sent, LOGISTICS_KEY, LOGISTICS_IV, 'md5')).toBe(true);
      expect(res.body.shipment).toMatchObject({ shipmentNo: '9012345678', validationNo: null });
    });

    it('建單失敗：回傳 502 與綠界訊息，記錄在訂單事件，訂單維持已付款', async () => {
      const admin = await createAdmin(ctx);
      const { order } = await placePaidOrder(ctx);
      handler = () => new Response('0|ReceiverStoreID 門市代號錯誤');
      const res = await ctx
        .http()
        .post(`/v1/admin/orders/${order.id}/shipment`)
        .set(admin.auth)
        .expect(502);
      expect(res.body.error.code).toBe('PROVIDER_ERROR');
      expect(res.body.error.message).toContain('門市代號錯誤');

      const detail = await ctx
        .http()
        .get(`/v1/admin/orders/${order.id}`)
        .set(admin.auth)
        .expect(200);
      expect(detail.body.status).toBe('PAID');
      expect(detail.body.shipment).toBeNull();
      expect(detail.body.events.map((e: { type: string }) => e.type)).toContain('SHIPMENT_FAILED');
    });
  });

  describe('電子發票', () => {
    it('開立：資料加密送出（載具、金額、訂單編號），解密回應後寫入發票號碼', async () => {
      const { order } = await placePaidOrder(ctx);
      const invoiceDate = nowEcpay();
      handler = (url, init) => {
        expect(url).toBe('https://einvoice-stage.ecpay.com.tw/B2CInvoice/Issue');
        expect(sentInvoiceData(init)).toMatchObject({
          RelateNumber: order.orderNo,
          SalesAmount: order.total,
          CarrierType: '1',
          Print: '0',
          InvType: '07',
        });
        return invoiceReply({
          RtnCode: 1,
          RtnMsg: '開立發票成功',
          InvoiceNo: 'AB12345678',
          InvoiceDate: invoiceDate,
          RandomNumber: '6868',
        });
      };
      expect(await invoices.processDue()).toBe(1);
      const invoice = await ctx.prisma.invoice.findUniqueOrThrow({ where: { orderId: order.id } });
      expect(invoice).toMatchObject({
        provider: 'ECPAY',
        status: 'ISSUED',
        invoiceNo: 'AB12345678',
        randomNumber: '6868',
        attempts: 1,
      });
      expect(ecpayDateTime(invoice.invoiceDate!).replace(/\//g, '-')).toBe(invoiceDate);
    });

    it('開立失敗依退避時間重試；重試前先查詢，已開立的不會再開一次', async () => {
      const { order } = await placePaidOrder(ctx);
      handler = () => new Response('Service Unavailable', { status: 503 });
      expect(await invoices.processDue()).toBe(0);
      let invoice = await ctx.prisma.invoice.findUniqueOrThrow({ where: { orderId: order.id } });
      expect(invoice).toMatchObject({ status: 'PENDING', attempts: 1 });
      expect(invoice.lastError).toContain('HTTP 503');
      expect(invoice.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now());
      expect(await invoices.processDue()).toBe(0); // 還沒到重試時間

      calls.length = 0;
      handler = (_url, init) => {
        expect(sentInvoiceData(init)).toMatchObject({ RelateNumber: order.orderNo });
        return invoiceReply({
          RtnCode: 1,
          RtnMsg: '查詢成功',
          IIS_Number: 'AB87654321',
          IIS_Relate_Number: order.orderNo,
          IIS_Create_Date: nowEcpay(),
          IIS_Random_Number: '1234',
          IIS_Invalid_Status: '0',
        });
      };
      expect(await invoices.processDue(new Date(Date.now() + 5 * 60_000))).toBe(1);
      expect(calls).toEqual(['/B2CInvoice/GetIssue']);
      invoice = await ctx.prisma.invoice.findUniqueOrThrow({ where: { orderId: order.id } });
      expect(invoice).toMatchObject({ status: 'ISSUED', invoiceNo: 'AB87654321', lastError: null });
    });

    it('重試達上限後停止自動重試，後台可看到並手動重試', async () => {
      const admin = await createAdmin(ctx);
      const { order } = await placePaidOrder(ctx);
      await ctx.prisma.invoice.update({
        where: { orderId: order.id },
        data: { attempts: MAX_INVOICE_ATTEMPTS, lastError: '開立失敗：10000006 載具號碼錯誤' },
      });
      expect(await invoices.processDue()).toBe(0);
      const stuck = await ctx
        .http()
        .get(`/v1/admin/orders/${order.id}`)
        .set(admin.auth)
        .expect(200);
      expect(stuck.body.invoice).toMatchObject({ status: 'PENDING', needsAttention: true });

      handler = (url) =>
        url.endsWith('/GetIssue')
          ? invoiceReply({ RtnCode: 0, RtnMsg: '查無資料' })
          : invoiceReply({
              RtnCode: 1,
              RtnMsg: '開立發票成功',
              InvoiceNo: 'CD11112222',
              InvoiceDate: nowEcpay(),
              RandomNumber: '0420',
            });
      const retried = await ctx
        .http()
        .post(`/v1/admin/orders/${order.id}/invoice/retry`)
        .set(admin.auth)
        .expect(201);
      expect(retried.body.invoice).toMatchObject({
        status: 'ISSUED',
        invoiceNo: 'CD11112222',
        needsAttention: false,
      });
    });

    it('當期退款：以發票號碼與日期作廢', async () => {
      const admin = await createAdmin(ctx);
      const { order } = await placePaidOrder(ctx);
      const invoiceDate = nowEcpay();
      handler = () =>
        invoiceReply({
          RtnCode: 1,
          RtnMsg: '開立發票成功',
          InvoiceNo: 'EF33334444',
          InvoiceDate: invoiceDate,
          RandomNumber: '1111',
        });
      await invoices.processDue();
      await ctx
        .http()
        .post(`/v1/admin/orders/${order.id}/status`)
        .set(admin.auth)
        .send({ status: 'REFUNDED' })
        .expect(201);

      handler = (url, init) => {
        expect(url).toBe('https://einvoice-stage.ecpay.com.tw/B2CInvoice/Invalid');
        expect(sentInvoiceData(init)).toMatchObject({
          InvoiceNo: 'EF33334444',
          InvoiceDate: invoiceDate.slice(0, 10),
          Reason: '訂單退款',
        });
        return invoiceReply({ RtnCode: 1, RtnMsg: '作廢發票成功', InvoiceNo: 'EF33334444' });
      };
      expect(await invoices.processDue()).toBe(1);
      const invoice = await ctx.prisma.invoice.findUniqueOrThrow({ where: { orderId: order.id } });
      expect(invoice.status).toBe('VOIDED');
      expect(invoice.reversedAt).not.toBeNull();
    });
  });
});
