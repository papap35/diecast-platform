import { generateCheckMacValue } from '../src/modules/ecpay/checkmac.js';
import { InvoicesService } from '../src/modules/invoices/invoices.service.js';
import { createAdmin, placeOrder, placePaidOrder, registerMember } from './fixtures.js';
import { TEST_ENV } from './test-env.js';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

type Auth = Record<string, string>;

describe('物流與電子發票（模擬服務） (e2e)', () => {
  let ctx: TestContext;
  let invoices: InvoicesService;

  beforeAll(async () => {
    ctx = await createTestApp();
    invoices = ctx.app.get(InvoicesService);
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const adminOrder = (auth: Auth, id: string) =>
    ctx.http().get(`/v1/admin/orders/${id}`).set(auth).expect(200);

  describe('超商電子地圖選店', () => {
    const openMap = (auth: Auth, body: Record<string, unknown>) =>
      ctx.http().post('/v1/logistics/cvs-map').set(auth).send(body).expect(201);

    it('開啟模擬地圖 → 選店 → 導回結帳頁 → 以代碼取回門市，其他會員讀不到', async () => {
      const member = await registerMember(ctx);
      const map = await openMap(member.auth, {
        method: 'CVS_FAMILY',
        returnUrl: 'http://web.test/zh-TW/checkout',
      });
      expect(map.body.type).toBe('redirect');
      expect(map.body.url).toBe(`http://api.test/v1/logistics/mock/map/${map.body.token}`);

      const page = await ctx.http().get(`/v1/logistics/mock/map/${map.body.token}`).expect(200);
      expect(page.text).toContain('全家');
      expect(page.headers['content-security-policy']).toContain(
        "form-action 'self' http://web.test",
      );

      const picked = await ctx
        .http()
        .post(`/v1/logistics/mock/map/${map.body.token}`)
        .type('form')
        .send({ storeId: '011385' })
        .expect(303);
      expect(picked.headers.location).toBe(
        `http://web.test/zh-TW/checkout?cvsToken=${map.body.token}`,
      );

      const selection = await ctx
        .http()
        .get(`/v1/logistics/cvs-map/${map.body.token}`)
        .set(member.auth)
        .expect(200);
      expect(selection.body).toEqual({
        method: 'CVS_FAMILY',
        storeId: '011385',
        storeName: '全家 板橋文化店',
        storeAddress: '新北市板橋區文化路一段 188 號',
      });

      const other = await registerMember(ctx);
      const denied = await ctx
        .http()
        .get(`/v1/logistics/cvs-map/${map.body.token}`)
        .set(other.auth)
        .expect(404);
      expect(denied.body.error.code).toBe('CVS_SELECTION_NOT_FOUND');
    });

    it('綠界地圖帶回門市；外部導回網址、取消選店與過期代碼的處理', async () => {
      const member = await registerMember(ctx);
      const map = await openMap(member.auth, {
        method: 'CVS_711',
        returnUrl: 'https://evil.example/steal',
      });
      const reply = await ctx
        .http()
        .post('/v1/logistics/ecpay/map-reply')
        .type('form')
        .send({
          MerchantID: TEST_ENV.ECPAY_LOGISTICS_MERCHANT_ID,
          MerchantTradeNo: map.body.token,
          LogisticsSubType: 'UNIMARTC2C',
          CVSStoreID: '991182',
          CVSStoreName: '馥樺門市',
          CVSAddress: '台北市南港區三重路 23 號 1 樓',
          CVSTelephone: '',
          CVSOutSide: '0',
          ExtraData: map.body.token,
        })
        .expect(303);
      // 外部網域的導回網址被換成前台結帳頁
      expect(reply.headers.location).toBe(
        `http://web.test/zh-TW/checkout?cvsToken=${map.body.token}`,
      );
      const selection = await ctx
        .http()
        .get(`/v1/logistics/cvs-map/${map.body.token}`)
        .set(member.auth)
        .expect(200);
      expect(selection.body).toMatchObject({ method: 'CVS_711', storeId: '991182' });

      const cancelled = await openMap(member.auth, { method: 'CVS_HILIFE' });
      const back = await ctx
        .http()
        .post(`/v1/logistics/mock/map/${cancelled.body.token}`)
        .type('form')
        .send({ storeId: '2001', action: 'cancel' })
        .expect(303);
      expect(back.headers.location).toBe('http://web.test/zh-TW/checkout?cvsError=cancelled');

      const expired = await ctx
        .http()
        .post('/v1/logistics/ecpay/map-reply')
        .type('form')
        .send({ ExtraData: 'UNKNOWNTOKEN12345678', LogisticsSubType: 'UNIMARTC2C' })
        .expect(303);
      expect(expired.headers.location).toBe('http://web.test/checkout?cvsError=expired');

      await ctx
        .http()
        .post('/v1/logistics/cvs-map')
        .set(member.auth)
        .send({ method: 'HOME_DELIVERY' })
        .expect(400);
    });
  });

  describe('出貨', () => {
    it('建立物流單 → 模擬配送 → 訂單自動推進到已完成，物流狀態不能倒退', async () => {
      const admin = await createAdmin(ctx);
      const { member, order } = await placePaidOrder(ctx);

      const created = await ctx
        .http()
        .post(`/v1/admin/orders/${order.id}/shipment`)
        .set(admin.auth)
        .expect(201);
      expect(created.body.status).toBe('PROCESSING');
      expect(created.body.shipment).toMatchObject({
        provider: 'MOCK',
        status: 'CREATED',
        logisticsSubType: 'UNIMARTC2C',
      });
      expect(created.body.shipment.shipmentNo).toMatch(/^\d{8}$/);

      const again = await ctx
        .http()
        .post(`/v1/admin/orders/${order.id}/shipment`)
        .set(admin.auth)
        .expect(409);
      expect(again.body.error.code).toBe('SHIPMENT_NOT_ALLOWED');

      for (const [status, orderStatus] of [
        ['IN_TRANSIT', 'SHIPPED'],
        ['ARRIVED', 'SHIPPED'],
        ['PICKED_UP', 'COMPLETED'],
      ]) {
        const res = await ctx
          .http()
          .post(`/v1/admin/orders/${order.id}/shipment/simulate`)
          .set(admin.auth)
          .send({ status })
          .expect(201);
        expect(res.body.shipment.status).toBe(status);
        expect(res.body.status).toBe(orderStatus);
      }
      await ctx
        .http()
        .post(`/v1/admin/orders/${order.id}/shipment/simulate`)
        .set(admin.auth)
        .send({ status: 'IN_TRANSIT' })
        .expect(409);

      const mine = await ctx.http().get(`/v1/orders/${order.orderNo}`).set(member.auth).expect(200);
      expect(mine.body.shipment).toMatchObject({
        status: 'PICKED_UP',
        statusMessage: '消費者成功取件（模擬）',
      });
      expect(mine.body.shipment).not.toHaveProperty('merchantTradeNo');
      const events = (await adminOrder(admin.auth, order.id)).body.events;
      expect(events.map((e: { toStatus: string | null }) => e.toStatus).filter(Boolean)).toEqual([
        'PENDING_PAYMENT',
        'PAID',
        'PROCESSING',
        'SHIPPED',
        'COMPLETED',
      ]);
    });

    it('未付款訂單不能出貨；只有訂單讀取權限的帳號不能建立物流單', async () => {
      const admin = await createAdmin(ctx);
      const viewer = await createAdmin(ctx, ['order:read']);
      const { order } = await placeOrder(ctx);
      const res = await ctx
        .http()
        .post(`/v1/admin/orders/${order.id}/shipment`)
        .set(admin.auth)
        .expect(409);
      expect(res.body.error.code).toBe('SHIPMENT_NOT_ALLOWED');
      await ctx.http().post(`/v1/admin/orders/${order.id}/shipment`).set(viewer.auth).expect(403);
    });

    it('包裹退回：訂單停在已出貨，可重新寄送；改辦退款時釋放庫存', async () => {
      const admin = await createAdmin(ctx);
      const simulate = (id: string, status: string) =>
        ctx
          .http()
          .post(`/v1/admin/orders/${id}/shipment/simulate`)
          .set(admin.auth)
          .send({ status })
          .expect(201);

      const { order } = await placePaidOrder(ctx);
      await ctx.http().post(`/v1/admin/orders/${order.id}/shipment`).set(admin.auth).expect(201);
      await simulate(order.id, 'ARRIVED');
      const returned = await simulate(order.id, 'RETURNED');
      expect(returned.body.status).toBe('SHIPPED');
      expect(returned.body.shipment.status).toBe('RETURNED');
      expect(returned.body.events.map((e: { type: string }) => e.type)).toContain(
        'SHIPMENT_RETURNED',
      );

      const reshipped = await ctx
        .http()
        .post(`/v1/admin/orders/${order.id}/shipment`)
        .set(admin.auth)
        .expect(201);
      expect(reshipped.body.shipment.status).toBe('CREATED');
      expect(reshipped.body.shipment.merchantTradeNo).not.toBe(
        returned.body.shipment.merchantTradeNo,
      );
      expect((await simulate(order.id, 'PICKED_UP')).body.status).toBe('COMPLETED');

      const second = await placePaidOrder(ctx, { quantity: 2 });
      await ctx
        .http()
        .post(`/v1/admin/orders/${second.order.id}/shipment`)
        .set(admin.auth)
        .expect(201);
      await simulate(second.order.id, 'RETURNED');
      await ctx
        .http()
        .post(`/v1/admin/orders/${second.order.id}/status`)
        .set(admin.auth)
        .send({ status: 'REFUNDED', note: '包裹退回，顧客改退款' })
        .expect(201);
      const product = await ctx.prisma.product.findUniqueOrThrow({
        where: { id: second.product.id },
      });
      expect(product.stock).toBe(10);
    });

    it('綠界物流通知：驗證 MD5 檢查碼後推進訂單，重送不重複記錄，未知代碼只記錄訊息', async () => {
      const { order } = await placePaidOrder(ctx);
      // 綠界建單需要連線，這裡直接寫入一張綠界物流單
      await ctx.prisma.shipment.create({
        data: {
          orderId: order.id,
          provider: 'ECPAY',
          logisticsType: 'CVS',
          logisticsSubType: 'UNIMARTC2C',
          merchantTradeNo: 'P261005SHIPTEST0001',
          logisticsId: '1718546',
          shipmentNo: 'C9876543',
        },
      });
      const notify = (code: string, message: string) => {
        const params: Record<string, string> = {
          MerchantID: TEST_ENV.ECPAY_LOGISTICS_MERCHANT_ID,
          MerchantTradeNo: 'P261005SHIPTEST0001',
          RtnCode: code,
          RtnMsg: message,
          AllPayLogisticsID: '1718546',
          LogisticsType: 'CVS',
          LogisticsSubType: 'UNIMARTC2C',
          GoodsAmount: String(order.total),
          UpdateStatusDate: '2026/10/06 10:15:00',
          ReceiverName: '王小明',
          ReceiverPhone: '',
          ReceiverCellPhone: '0912345678',
          ReceiverEmail: '',
          ReceiverAddress: '',
          CVSPaymentNo: 'C9876543',
          CVSValidationNo: '1234',
          BookingNote: '',
        };
        params.CheckMacValue = generateCheckMacValue(
          params,
          TEST_ENV.ECPAY_LOGISTICS_HASH_KEY,
          TEST_ENV.ECPAY_LOGISTICS_HASH_IV,
          'md5',
        );
        return params;
      };
      const send = (body: Record<string, string>, status = 200) =>
        ctx.http().post('/v1/logistics/ecpay/notify').type('form').send(body).expect(status);

      expect((await send(notify('2068', '交貨便收件'))).text).toBe('1|OK');
      await send(notify('2068', '交貨便收件'));
      const tampered = { ...notify('2068', '交貨便收件'), RtnCode: '2067' };
      expect((await send(tampered, 400)).text).toBe('0|CheckMacValue Error');
      await send(notify('9999', '測試用狀態'));

      const saved = await ctx.prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { events: true, shipment: true },
      });
      // 已付款 → 處理中 → 已出貨（依序推進，不跳過）
      expect(saved.status).toBe('SHIPPED');
      expect(saved.events.filter((e) => e.toStatus === 'PROCESSING')).toHaveLength(1);
      expect(saved.shipment).toMatchObject({
        status: 'IN_TRANSIT',
        statusCode: '9999',
        validationNo: '1234',
      });
      expect(saved.events.filter((e) => e.type === 'SHIPMENT_STATUS')).toHaveLength(2);
    });
  });

  describe('電子發票', () => {
    it('付款成功後排入開立，排程開立後會員看得到發票號碼，不會重複開立', async () => {
      const { member, order } = await placePaidOrder(ctx);
      const pending = await ctx
        .http()
        .get(`/v1/orders/${order.orderNo}`)
        .set(member.auth)
        .expect(200);
      expect(pending.body.invoice).toMatchObject({
        status: 'PENDING',
        invoiceNo: null,
        amount: order.total,
      });

      expect(await invoices.processDue()).toBe(1);
      const issued = await ctx
        .http()
        .get(`/v1/orders/${order.orderNo}`)
        .set(member.auth)
        .expect(200);
      expect(issued.body.invoice.status).toBe('ISSUED');
      expect(issued.body.invoice.invoiceNo).toMatch(/^[A-Z]{2}\d{8}$/);
      expect(issued.body.invoice.randomNumber).toMatch(/^\d{4}$/);
      expect(issued.body.invoice).not.toHaveProperty('lastError');
      expect(await invoices.processDue()).toBe(0);
    });

    it('開立前就退款：取消開立', async () => {
      const admin = await createAdmin(ctx);
      const { order } = await placePaidOrder(ctx);
      await ctx
        .http()
        .post(`/v1/admin/orders/${order.id}/status`)
        .set(admin.auth)
        .send({ status: 'REFUNDED' })
        .expect(201);
      expect(await invoices.processDue()).toBe(0);
      const invoice = await ctx.prisma.invoice.findUniqueOrThrow({ where: { orderId: order.id } });
      expect(invoice).toMatchObject({ status: 'CANCELLED', invoiceNo: null });
    });

    it('當期退款作廢發票；跨期退款改開折讓單；已完成訂單退貨不自動回補庫存', async () => {
      const admin = await createAdmin(ctx);
      const current = await placePaidOrder(ctx);
      const previous = await placePaidOrder(ctx);
      expect(await invoices.processDue()).toBe(2);
      // 第二張發票改為兩個多月前開立（一定在上一期）
      await ctx.prisma.invoice.update({
        where: { orderId: previous.order.id },
        data: { invoiceDate: new Date(Date.now() - 70 * 86_400_000) },
      });
      // 第二筆訂單已完成（顧客取貨後於鑑賞期內退貨）
      for (const status of ['PROCESSING', 'SHIPPED', 'COMPLETED']) {
        await ctx
          .http()
          .post(`/v1/admin/orders/${previous.order.id}/status`)
          .set(admin.auth)
          .send({ status })
          .expect(201);
      }
      for (const { order } of [current, previous]) {
        await ctx
          .http()
          .post(`/v1/admin/orders/${order.id}/status`)
          .set(admin.auth)
          .send({ status: 'REFUNDED', note: '顧客退貨' })
          .expect(201);
      }
      expect(await invoices.processDue()).toBe(2);

      const voided = await adminOrder(admin.auth, current.order.id);
      expect(voided.body.invoice).toMatchObject({ status: 'VOIDED', needsAttention: false });
      const allowance = await adminOrder(admin.auth, previous.order.id);
      expect(allowance.body.invoice.status).toBe('ALLOWANCE_ISSUED');
      expect(allowance.body.invoice.allowanceNo).toMatch(/^\d{16}$/);
      expect(allowance.body.events.map((e: { type: string }) => e.type)).toContain(
        'INVOICE_ALLOWANCE',
      );

      const stock = async (id: string) =>
        (await ctx.prisma.product.findUniqueOrThrow({ where: { id } })).stock;
      expect(await stock(current.product.id)).toBe(10);
      expect(await stock(previous.product.id)).toBe(9);
    });

    it('沒有待處理工作的發票不能手動重試', async () => {
      const admin = await createAdmin(ctx);
      const { order } = await placePaidOrder(ctx);
      await invoices.processDue();
      const res = await ctx
        .http()
        .post(`/v1/admin/orders/${order.id}/invoice/retry`)
        .set(admin.auth)
        .expect(409);
      expect(res.body.error.code).toBe('INVOICE_NOT_RETRYABLE');
    });
  });
});
