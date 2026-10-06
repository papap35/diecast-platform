import { InventoryService } from '../src/modules/inventory/inventory.service.js';
import { createProduct, CVS_CHECKOUT, registerMember } from './fixtures.js';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

describe('購物流程 (e2e)', () => {
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

  describe('商品目錄', () => {
    it('只列出上架商品，並依語系回傳名稱', async () => {
      const active = await createProduct(ctx.prisma);
      await createProduct(ctx.prisma, { status: 'DRAFT' });

      const res = await ctx.http().get('/v1/products?locale=en').expect(200);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0].slug).toBe(active.slug);
      expect(res.body.data[0].name).toMatch(/^Test Product/);
    });

    it('依販售狀態篩選：即將發售／售完', async () => {
      await createProduct(ctx.prisma, {
        saleType: 'LIMITED',
        releaseAt: new Date(Date.now() + 86_400_000),
      });
      await createProduct(ctx.prisma, { stock: 0 });
      await createProduct(ctx.prisma);

      const upcoming = await ctx.http().get('/v1/products?availability=upcoming').expect(200);
      expect(upcoming.body.data.map((p: { availability: string }) => p.availability)).toEqual([
        'COMING_SOON',
      ]);

      const soldOut = await ctx.http().get('/v1/products?availability=sold_out').expect(200);
      expect(soldOut.body.data.map((p: { availability: string }) => p.availability)).toEqual([
        'SOLD_OUT',
      ]);
    });

    it('商品詳情不存在時回傳 PRODUCT_NOT_FOUND', async () => {
      const res = await ctx.http().get('/v1/products/nope').expect(404);
      expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('購物車', () => {
    it('加入購物車並計算小計與運費選項', async () => {
      const product = await createProduct(ctx.prisma, { price: 450 });
      const member = await registerMember(ctx);

      const res = await ctx
        .http()
        .put(`/v1/cart/items/${product.id}`)
        .set(member.auth)
        .send({ quantity: 2 })
        .expect(200);
      expect(res.body.subtotal).toBe(900);
      const cvs = res.body.shippingOptions.find((o: { method: string }) => o.method === 'CVS_711');
      expect(cvs.fee).toBe(60);
    });

    it('尚未開賣的限量商品不能加入購物車', async () => {
      const product = await createProduct(ctx.prisma, {
        saleType: 'LIMITED',
        releaseAt: new Date(Date.now() + 3_600_000),
      });
      const member = await registerMember(ctx);
      const res = await ctx
        .http()
        .put(`/v1/cart/items/${product.id}`)
        .set(member.auth)
        .send({ quantity: 1 })
        .expect(409);
      expect(res.body.error.code).toBe('NOT_RELEASED_YET');
    });

    it('超過每人限購數量時拒絕', async () => {
      const product = await createProduct(ctx.prisma, { purchaseLimit: 2 });
      const member = await registerMember(ctx);
      const res = await ctx
        .http()
        .put(`/v1/cart/items/${product.id}`)
        .set(member.auth)
        .send({ quantity: 3 })
        .expect(409);
      expect(res.body.error.code).toBe('PURCHASE_LIMIT_EXCEEDED');
      expect(res.body.error.details).toMatchObject({ limit: 2, purchased: 0 });
    });
  });

  describe('結帳', () => {
    it('從購物車結帳：建立訂單、扣庫存、清空購物車、記錄庫存異動', async () => {
      const product = await createProduct(ctx.prisma, { price: 500, stock: 5 });
      const member = await registerMember(ctx);
      await ctx
        .http()
        .put(`/v1/cart/items/${product.id}`)
        .set(member.auth)
        .send({ quantity: 2 })
        .expect(200);

      const res = await ctx
        .http()
        .post('/v1/orders')
        .set(member.auth)
        .send(CVS_CHECKOUT)
        .expect(201);
      expect(res.body).toMatchObject({
        status: 'PENDING_PAYMENT',
        subtotal: 1000,
        shippingFee: 0,
        total: 1000,
        canPay: true,
      });
      expect(res.body.orderNo).toMatch(/^P64\d{6}[0-9A-Z]{5}$/);

      const after = await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(after.stock).toBe(3);
      const cart = await ctx.http().get('/v1/cart').set(member.auth).expect(200);
      expect(cart.body.items).toHaveLength(0);
      const movements = await ctx.prisma.stockMovement.findMany({
        where: { productId: product.id },
      });
      expect(movements).toEqual([
        expect.objectContaining({
          delta: -2,
          balance: 3,
          reason: 'ORDER_PLACED',
          orderId: res.body.id,
          actorId: member.id,
        }),
      ]);
    });

    it('多件商品依商品 ID 順序扣庫存，兩筆訂單同時買同樣幾件商品不會互等（deadlock）', async () => {
      const a = await createProduct(ctx.prisma);
      const b = await createProduct(ctx.prisma);
      const [first, second] = [a.id, b.id].sort();
      const member = await registerMember(ctx);
      const decrement = vi.spyOn(ctx.app.get(InventoryService), 'decrement');
      try {
        await ctx
          .http()
          .post('/v1/orders')
          .set(member.auth)
          .send({
            ...CVS_CHECKOUT,
            items: [
              { productId: second, quantity: 1 },
              { productId: first, quantity: 1 },
            ],
          })
          .expect(201);
        expect(decrement.mock.calls.map((call) => call[1])).toEqual([first, second]);
      } finally {
        decrement.mockRestore();
      }
    });

    it('購物車是空的時候回傳 CART_EMPTY', async () => {
      const member = await registerMember(ctx);
      const res = await ctx
        .http()
        .post('/v1/orders')
        .set(member.auth)
        .send(CVS_CHECKOUT)
        .expect(400);
      expect(res.body.error.code).toBe('CART_EMPTY');
    });

    it('宅配缺少地址、公司發票統編錯誤時回傳欄位錯誤', async () => {
      const product = await createProduct(ctx.prisma);
      const member = await registerMember(ctx);
      const res = await ctx
        .http()
        .post('/v1/orders')
        .set(member.auth)
        .send({
          items: [{ productId: product.id, quantity: 1 }],
          shippingMethod: 'HOME_DELIVERY',
          recipientName: '王小明',
          recipientPhone: '0912345678',
          invoiceType: 'COMPANY',
          invoiceTaxId: '12345678',
          invoiceTitle: '測試公司',
        })
        .expect(400);
      const fields = res.body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toEqual(
        expect.arrayContaining(['postalCode', 'city', 'addressLine', 'invoiceTaxId']),
      );
    });

    it('🏁 50 位會員同時搶購 10 件限量商品：剛好成立 10 筆、庫存歸零、不超賣', async () => {
      const product = await createProduct(ctx.prisma, {
        saleType: 'LIMITED',
        releaseAt: new Date(Date.now() - 1000),
        stock: 10,
        purchaseLimit: 1,
      });
      const members = await Promise.all(Array.from({ length: 50 }, () => registerMember(ctx)));

      const results = await Promise.all(
        members.map((member) =>
          ctx
            .http()
            .post('/v1/orders')
            .set(member.auth)
            .send({ ...CVS_CHECKOUT, items: [{ productId: product.id, quantity: 1 }] }),
        ),
      );

      const created = results.filter((r) => r.status === 201);
      const rejected = results.filter((r) => r.status === 409);
      expect(created).toHaveLength(10);
      expect(rejected).toHaveLength(40);
      expect(new Set(rejected.map((r) => r.body.error.code))).toEqual(new Set(['OUT_OF_STOCK']));

      const after = await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(after.stock).toBe(0);
      const sold = await ctx.prisma.orderItem.aggregate({
        where: { productId: product.id },
        _sum: { quantity: true },
      });
      expect(sold._sum.quantity).toBe(10);
    });

    it('同一會員同時送出多筆訂單，也無法繞過每人限購', async () => {
      const product = await createProduct(ctx.prisma, { stock: 100, purchaseLimit: 2 });
      const member = await registerMember(ctx);

      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          ctx
            .http()
            .post('/v1/orders')
            .set(member.auth)
            .send({ ...CVS_CHECKOUT, items: [{ productId: product.id, quantity: 1 }] }),
        ),
      );

      expect(results.filter((r) => r.status === 201)).toHaveLength(2);
      expect(results.filter((r) => r.status === 409).map((r) => r.body.error.code)).toEqual(
        Array(4).fill('PURCHASE_LIMIT_EXCEEDED'),
      );
    });
  });
});
