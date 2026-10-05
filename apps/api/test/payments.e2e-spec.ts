import { generateCheckMacValue } from '../src/modules/payments/providers/ecpay-checkmac.js';
import { OrdersService } from '../src/modules/orders/orders.service.js';
import { createProduct, CVS_CHECKOUT, registerMember } from './fixtures.js';
import { TEST_ENV } from './test-env.js';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

describe('付款與訂單生命週期 (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  async function placeOrder(quantity = 1, overrides = {}) {
    const product = await createProduct(ctx.prisma, { price: 800, stock: 5, ...overrides });
    const member = await registerMember(ctx);
    const order = await ctx
      .http()
      .post('/v1/orders')
      .set(member.auth)
      .send({ ...CVS_CHECKOUT, items: [{ productId: product.id, quantity }] })
      .expect(201);
    return { product, member, order: order.body };
  }

  async function ecpayPayment(orderId: string, amount: number) {
    return ctx.prisma.payment.create({
      data: {
        orderId,
        provider: 'ECPAY',
        merchantTradeNo: `T${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 20),
        amount,
        returnUrl: 'http://web.test/zh-TW/account/orders/x',
      },
    });
  }

  function signedNotify(merchantTradeNo: string, amount: number, rtnCode = '1') {
    const params: Record<string, string> = {
      MerchantID: TEST_ENV.ECPAY_MERCHANT_ID,
      MerchantTradeNo: merchantTradeNo,
      StoreID: '',
      RtnCode: rtnCode,
      RtnMsg: rtnCode === '1' ? '交易成功' : '交易失敗',
      TradeNo: '2610052015301234',
      TradeAmt: String(amount),
      PaymentDate: '2026/10/05 20:16:02',
      PaymentType: 'Credit_CreditCard',
      PaymentTypeChargeFee: '25',
      TradeDate: '2026/10/05 20:15:30',
      SimulatePaid: '0',
      CustomField1: '',
      CustomField2: '',
      CustomField3: '',
      CustomField4: '',
    };
    params.CheckMacValue = generateCheckMacValue(
      params,
      TEST_ENV.ECPAY_HASH_KEY,
      TEST_ENV.ECPAY_HASH_IV,
    );
    return params;
  }

  it('模擬金流：開始付款 → 付款成功 → 訂單轉為已付款並累計會員消費', async () => {
    const { member, order } = await placeOrder(2);

    const start = await ctx
      .http()
      .post(`/v1/orders/${order.orderNo}/payments`)
      .set(member.auth)
      .send({})
      .expect(201);
    expect(start.body).toMatchObject({ provider: 'MOCK', type: 'redirect' });
    expect(start.body.url).toBe(`http://api.test/v1/payments/mock/${start.body.merchantTradeNo}`);

    const page = await ctx
      .http()
      .get(`/v1/payments/mock/${start.body.merchantTradeNo}`)
      .expect(200);
    expect(page.text).toContain(order.orderNo);

    const done = await ctx
      .http()
      .post(`/v1/payments/mock/${start.body.merchantTradeNo}/complete`)
      .type('form')
      .send({ result: 'success' })
      .expect(303);
    expect(done.headers.location).toBe(
      `http://web.test/zh-TW/account/orders/${order.orderNo}?payment=success`,
    );

    const paid = await ctx.http().get(`/v1/orders/${order.orderNo}`).set(member.auth).expect(200);
    expect(paid.body.status).toBe('PAID');
    expect(paid.body.payments[0]).toMatchObject({ status: 'SUCCEEDED', provider: 'MOCK' });
    const saved = await ctx.prisma.member.findUniqueOrThrow({ where: { id: member.id } });
    expect(saved.totalSpent).toBe(order.total);
  });

  it('付款失敗時訂單維持待付款，可以重新付款', async () => {
    const { member, order } = await placeOrder();
    const start = await ctx
      .http()
      .post(`/v1/orders/${order.orderNo}/payments`)
      .set(member.auth)
      .send({})
      .expect(201);
    await ctx
      .http()
      .post(`/v1/payments/mock/${start.body.merchantTradeNo}/complete`)
      .type('form')
      .send({ result: 'failure' })
      .expect(303);

    const after = await ctx.http().get(`/v1/orders/${order.orderNo}`).set(member.auth).expect(200);
    expect(after.body.status).toBe('PENDING_PAYMENT');
    expect(after.body.canPay).toBe(true);
    await ctx
      .http()
      .post(`/v1/orders/${order.orderNo}/payments`)
      .set(member.auth)
      .send({})
      .expect(201);
  });

  it('付款後導回網址不接受外部網域（防止開放式重新導向）', async () => {
    const { member, order } = await placeOrder();
    const start = await ctx
      .http()
      .post(`/v1/orders/${order.orderNo}/payments`)
      .set(member.auth)
      .send({ returnUrl: 'https://evil.example/phish' })
      .expect(201);
    const payment = await ctx.prisma.payment.findUniqueOrThrow({
      where: { merchantTradeNo: start.body.merchantTradeNo },
    });
    expect(payment.returnUrl).toBe(`http://web.test/zh-TW/account/orders/${order.orderNo}`);
  });

  it('綠界通知：驗證檢查碼後入帳，重送同一通知只處理一次', async () => {
    const { order } = await placeOrder();
    const payment = await ecpayPayment(order.id, order.total);
    const body = signedNotify(payment.merchantTradeNo, order.total);

    const first = await ctx
      .http()
      .post('/v1/payments/ecpay/notify')
      .type('form')
      .send(body)
      .expect(200);
    expect(first.text).toBe('1|OK');
    const second = await ctx
      .http()
      .post('/v1/payments/ecpay/notify')
      .type('form')
      .send(body)
      .expect(200);
    expect(second.text).toBe('1|OK');

    const saved = await ctx.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { events: true },
    });
    expect(saved.status).toBe('PAID');
    expect(saved.events.filter((e) => e.toStatus === 'PAID')).toHaveLength(1);
  });

  it('綠界通知檢查碼錯誤或金額被竄改時不入帳', async () => {
    const { order } = await placeOrder();
    const payment = await ecpayPayment(order.id, order.total);

    const tampered = { ...signedNotify(payment.merchantTradeNo, order.total), TradeAmt: '1' };
    const res = await ctx
      .http()
      .post('/v1/payments/ecpay/notify')
      .type('form')
      .send(tampered)
      .expect(400);
    expect(res.text).toBe('0|CheckMacValue Error');

    // 檢查碼正確但金額與訂單不符（例如後台設定錯誤）也不能入帳
    const wrongAmount = signedNotify(payment.merchantTradeNo, order.total - 100);
    await ctx.http().post('/v1/payments/ecpay/notify').type('form').send(wrongAmount).expect(200);

    const saved = await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.status).toBe('PENDING_PAYMENT');
    const savedPayment = await ctx.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(savedPayment.status).toBe('FAILED');
  });

  it('逾期未付款：排程取消訂單並釋放庫存', async () => {
    const { product, order } = await placeOrder(3);
    expect((await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(
      2,
    );

    await ctx.prisma.order.update({
      where: { id: order.id },
      data: { paymentDeadline: new Date(Date.now() - 1000) },
    });
    const cancelled = await ctx.app.get(OrdersService).expireUnpaidOrders();
    expect(cancelled).toBe(1);

    const saved = await ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.status).toBe('CANCELLED');
    expect((await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(
      5,
    );
    const movement = await ctx.prisma.stockMovement.findFirstOrThrow({
      where: { productId: product.id, reason: 'ORDER_EXPIRED' },
    });
    expect(movement).toMatchObject({ delta: 3, balance: 5 });
  });

  it('訂單已逾期取消後才收到付款：不改變訂單，記錄需人工退款', async () => {
    const { order } = await placeOrder();
    const payment = await ecpayPayment(order.id, order.total);
    await ctx.prisma.order.update({
      where: { id: order.id },
      data: { paymentDeadline: new Date(0) },
    });
    await ctx.app.get(OrdersService).expireUnpaidOrders();

    await ctx
      .http()
      .post('/v1/payments/ecpay/notify')
      .type('form')
      .send(signedNotify(payment.merchantTradeNo, order.total))
      .expect(200);

    const saved = await ctx.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { events: true },
    });
    expect(saved.status).toBe('CANCELLED');
    expect(saved.events.some((e) => e.type === 'LATE_PAYMENT')).toBe(true);
  });

  it('會員可取消未付款訂單，已付款訂單不能自行取消', async () => {
    const { member, order, product } = await placeOrder(2);
    const res = await ctx
      .http()
      .post(`/v1/orders/${order.orderNo}/cancel`)
      .set(member.auth)
      .expect(200);
    expect(res.body.status).toBe('CANCELLED');
    expect((await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(
      5,
    );

    const second = await placeOrder();
    const payment = await ecpayPayment(second.order.id, second.order.total);
    await ctx
      .http()
      .post('/v1/payments/ecpay/notify')
      .type('form')
      .send(signedNotify(payment.merchantTradeNo, second.order.total))
      .expect(200);
    const denied = await ctx
      .http()
      .post(`/v1/orders/${second.order.orderNo}/cancel`)
      .set(second.member.auth)
      .expect(409);
    expect(denied.body.error.code).toBe('ORDER_NOT_CANCELLABLE');
  });

  it('看不到別人的訂單', async () => {
    const { order } = await placeOrder();
    const stranger = await registerMember(ctx);
    const res = await ctx.http().get(`/v1/orders/${order.orderNo}`).set(stranger.auth).expect(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
  });
});
