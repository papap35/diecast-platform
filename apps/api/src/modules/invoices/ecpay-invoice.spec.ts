import {
  buildAllowanceData,
  buildIssueData,
  buildVoidData,
  canVoidInvoice,
  decryptInvoiceData,
  encryptInvoiceData,
  type InvoiceOrder,
} from './ecpay-invoice.js';

// 綠界公開的電子發票測試商店
const KEY = 'ejCk326UnaZWKisg';
const IV = 'q9jcZX8Ib9LM8wYk';

const order: InvoiceOrder = {
  orderNo: 'P64261005K7Q2M',
  total: 1257,
  shippingFee: 60,
  recipientName: '王小明',
  recipientEmail: 'collector@example.com',
  recipientPhone: '0912345678',
  invoiceType: 'MOBILE_BARCODE',
  invoiceCarrierNum: '/ABC+123',
  invoiceDonationCode: null,
  invoiceTaxId: null,
  invoiceTitle: null,
  printAddress: '臺北市中山區建國北路一段 100 號',
  items: [{ name: "Formosa Taxi '95", quantity: 3, unitPrice: 399, lineTotal: 1197 }],
};

describe('綠界電子發票', () => {
  it('加密後可解回原資料（含中文、空白、+ 與單引號）', () => {
    const data = { Name: "Paddock 64 '95 計程車", Note: 'a+b ~c' };
    expect(decryptInvoiceData(encryptInvoiceData(data, KEY, IV), KEY, IV)).toEqual(data);
  });

  it('與另一個獨立實作（ecpay-einvoice-b2c-node 的 PayloadEncoder）加密結果相同', () => {
    // 期望值由 ecpay-einvoice-b2c-node 1.1.1 對同一筆資料加密得出
    expect(
      encryptInvoiceData(
        { RelateNumber: 'P64261005K7Q2M', Name: "王 小明's", Amount: 1257 },
        KEY,
        IV,
      ),
    ).toBe(
      '0AeflzwC7R9Ae60jYoCmshozkX5nsABQw40p9im1JEFk/80DuEEV7CMpZscNnixCsqYmhL0du0zVNRsZHOYHan9FMEz2/8vvB0esDkGBnNnH6FhGP4y0WGg4j/4rXDm0CT8Bjc7cMTe2OdJkTRTLLdPop9U6Px6py9ismNaQyac=',
    );
  });

  it('手機條碼：帶載具類型 3 與號碼，運費列為品項且加總等於金額', () => {
    const data = buildIssueData('2000132', order) as Record<string, unknown> & {
      Items: { ItemAmount: number; ItemSeq: number }[];
    };
    expect(data).toMatchObject({
      CarrierType: '3',
      CarrierNum: '/ABC+123',
      Print: '0',
      Donation: '0',
      SalesAmount: 1257,
    });
    expect(data.Items.map((i) => i.ItemSeq)).toEqual([1, 2]);
    expect(data.Items.reduce((sum, i) => sum + i.ItemAmount, 0)).toBe(1257);
  });

  it('公司發票：列印、帶統編與地址，不使用載具', () => {
    const data = buildIssueData('2000132', {
      ...order,
      invoiceType: 'COMPANY',
      invoiceTaxId: '04595257',
      invoiceTitle: '測試股份有限公司',
      invoiceCarrierNum: null,
    });
    expect(data).toMatchObject({
      CustomerIdentifier: '04595257',
      CustomerName: '測試股份有限公司',
      CustomerAddr: order.printAddress,
      Print: '1',
      CarrierType: '',
      CarrierNum: '',
    });
  });

  it('捐贈發票：帶捐贈碼、不列印、不使用載具；會員載具不帶號碼', () => {
    expect(
      buildIssueData('2000132', {
        ...order,
        invoiceType: 'DONATION',
        invoiceDonationCode: '168001',
        invoiceCarrierNum: null,
      }),
    ).toMatchObject({ Donation: '1', LoveCode: '168001', Print: '0', CarrierType: '' });
    expect(buildIssueData('2000132', { ...order, invoiceType: 'MEMBER_CARRIER' })).toMatchObject({
      CarrierType: '1',
      CarrierNum: '',
    });
  });
});

describe('作廢與折讓', () => {
  it('同一期（雙月）內可以作廢，跨期只能折讓；以台灣時間判斷', () => {
    const issued = new Date('2026-09-30T15:30:00Z'); // 台灣 10/1 23:30，屬 9–10 月期
    expect(canVoidInvoice(issued, new Date('2026-10-31T15:59:59Z'))).toBe(true);
    expect(canVoidInvoice(issued, new Date('2026-10-31T16:00:00Z'))).toBe(false); // 台灣 11/1
    expect(canVoidInvoice(new Date('2026-08-31T15:00:00Z'), new Date('2026-09-01T00:00:00Z'))).toBe(
      false,
    );
  });

  it('折讓單全額折讓、品項與發票相同並以 Email 通知；作廢理由限 20 字', () => {
    const data = buildAllowanceData({
      invoiceNo: 'AB12345678',
      invoiceDate: new Date('2026-08-20T04:00:00Z'),
      order,
    }) as Record<string, unknown> & { Items: { ItemAmount: number }[] };
    expect(data).toMatchObject({
      InvoiceDate: '2026-08-20',
      AllowanceAmount: 1257,
      AllowanceNotify: 'E',
    });
    expect(data.Items.reduce((sum, item) => sum + item.ItemAmount, 0)).toBe(1257);
    expect(
      buildVoidData({
        invoiceNo: 'AB12345678',
        invoiceDate: new Date('2026-08-20T17:00:00Z'),
        reason: '訂單退款'.repeat(10),
      }),
    ).toMatchObject({
      InvoiceDate: '2026-08-21',
      Reason: '訂單退款訂單退款訂單退款訂單退款訂單退款',
    });
  });
});
