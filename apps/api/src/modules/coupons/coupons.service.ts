import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import type { Coupon, MemberTier, Prisma, ShippingMethod } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { type OrderPricing, type PricingLine, priceOrder } from './coupon-pricing.js';
import type { CouponPreviewDto, CouponPreviewRequestDto } from './dto/coupon.dto.js';

type Db = Prisma.TransactionClient | PrismaService;

export interface AppliedCoupon {
  coupon: Coupon;
  pricing: OrderPricing;
}

/**
 * 優惠券的使用規則：
 * - 下單時在訂單交易內驗證、寫入使用紀錄並原子增加使用次數（總量不會超發）
 * - 同一會員的結帳本來就排隊執行（advisory lock），每人可用次數不會被並發請求繞過
 * - 未付款就取消或逾期 → 退回使用次數；付款後退款不退回
 * - 鎖的順序固定為「優惠券 → 商品庫存」，與取消訂單時相同，避免互相等待
 */
@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 驗證優惠券並計價（結帳與預覽共用；總使用次數的最終檢查在 redeem） */
  async apply(
    db: Db,
    code: string,
    member: { id: string; tier: MemberTier },
    lines: PricingLine[],
    method: ShippingMethod,
    now = new Date(),
  ): Promise<AppliedCoupon> {
    const coupon = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!coupon) throw AppException.notFound(ErrorCode.COUPON_NOT_FOUND, '找不到這個優惠碼');
    const pricing = priceOrder(lines, method, member.tier, coupon, now);
    const used = await db.couponRedemption.count({
      where: { couponId: coupon.id, memberId: member.id, releasedAt: null },
    });
    if (used >= coupon.perMemberLimit) {
      throw AppException.conflict(ErrorCode.COUPON_ALREADY_USED, '你已經使用過這張優惠券');
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw AppException.conflict(ErrorCode.COUPON_USED_UP, '這張優惠券已經被領完了');
    }
    return { coupon, pricing };
  }

  /** 訂單交易內：寫入使用紀錄並增加使用次數；達上限時整筆訂單回滾 */
  async redeem(
    tx: Prisma.TransactionClient,
    applied: AppliedCoupon,
    memberId: string,
    orderId: string,
  ): Promise<void> {
    const { coupon, pricing } = applied;
    await tx.couponRedemption.create({
      data: {
        couponId: coupon.id,
        memberId,
        orderId,
        amount: pricing.discount + pricing.shippingDiscount,
      },
    });
    const updated = await tx.$executeRaw`
      UPDATE "Coupon" SET "usedCount" = "usedCount" + 1, "updatedAt" = now()
      WHERE "id" = ${coupon.id}::uuid AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
    if (updated === 0) {
      throw AppException.conflict(ErrorCode.COUPON_USED_UP, '這張優惠券已經被領完了');
    }
  }

  /** 未付款取消或逾期：退回使用次數，會員可以再使用 */
  async release(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const redemption = await tx.couponRedemption.findUnique({ where: { orderId } });
    if (!redemption || redemption.releasedAt) return;
    await tx.couponRedemption.update({
      where: { id: redemption.id },
      data: { releasedAt: new Date() },
    });
    await tx.$executeRaw`
      UPDATE "Coupon" SET "usedCount" = "usedCount" - 1, "updatedAt" = now()
      WHERE "id" = ${redemption.couponId}::uuid`;
  }

  /** 結帳頁試算：立即購買帶 items，否則以購物車計算 */
  async preview(memberId: string, dto: CouponPreviewRequestDto): Promise<CouponPreviewDto> {
    const member = await this.prisma.member.findUniqueOrThrow({
      where: { id: memberId },
      select: { id: true, tier: true },
    });
    const requested =
      dto.items ??
      (
        await this.prisma.cartItem.findMany({
          where: { cart: { memberId } },
          select: { productId: true, quantity: true },
        })
      ).map((item) => ({ productId: item.productId, quantity: item.quantity }));
    if (requested.length === 0) {
      throw AppException.badRequest(ErrorCode.CART_EMPTY, '購物車是空的');
    }
    const products = await this.prisma.product.findMany({
      where: { id: { in: requested.map((item) => item.productId) } },
      select: { id: true, price: true, saleType: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    const lines = requested.flatMap(({ productId, quantity }) => {
      const product = byId.get(productId);
      return product ? [{ saleType: product.saleType, lineTotal: product.price * quantity }] : [];
    });
    const { coupon, pricing } = await this.apply(
      this.prisma,
      dto.code,
      member,
      lines,
      dto.shippingMethod,
    );
    return {
      code: coupon.code,
      name: coupon.name,
      type: coupon.type,
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      shippingFee: pricing.shippingFee,
      shippingDiscount: pricing.shippingDiscount,
      total: pricing.total,
    };
  }
}
