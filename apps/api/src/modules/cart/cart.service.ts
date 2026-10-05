import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import type { Locale } from '../../common/i18n/locale.js';
import type { ShippingMethod } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { Availability, computeAvailability, isPurchasable } from '../catalog/availability.js';
import { CatalogService, productSummaryInclude } from '../catalog/catalog.service.js';
import { calculateShippingFee, SHIPPING_RATES } from '../orders/order-rules.js';
import { purchasedQuantities } from '../orders/purchase-history.js';
import {
  type CartDto,
  CartIssue,
  type CartItemDto,
  MAX_QUANTITY_PER_ITEM,
} from './dto/cart.dto.js';

interface LimitInput {
  stock: number;
  purchaseLimit: number | null;
}

/** 單一商品目前可購買的上限：庫存、限購剩餘額度、單品上限取最小值 */
export function maxPurchasable(product: LimitInput, alreadyPurchased: number): number {
  const byLimit =
    product.purchaseLimit === null
      ? Number.POSITIVE_INFINITY
      : product.purchaseLimit - alreadyPurchased;
  return Math.max(0, Math.min(product.stock, byLimit, MAX_QUANTITY_PER_ITEM));
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async getCart(memberId: string, locale: Locale): Promise<CartDto> {
    const cart = await this.prisma.cart.findUnique({
      where: { memberId },
      include: {
        items: {
          include: { product: { include: productSummaryInclude } },
          orderBy: { addedAt: 'asc' },
        },
      },
    });
    const items = cart?.items ?? [];
    const purchased = await purchasedQuantities(
      this.prisma,
      memberId,
      items.map((item) => item.productId),
    );

    const now = new Date();
    const lines: CartItemDto[] = items.map((item) => {
      const availability = computeAvailability(item.product, now);
      const max = maxPurchasable(item.product, purchased.get(item.productId) ?? 0);
      return {
        product: this.catalog.toSummary(item.product, locale, now),
        quantity: item.quantity,
        lineTotal: item.quantity * item.product.price,
        maxQuantity: isPurchasable(availability) && item.product.status === 'ACTIVE' ? max : 0,
        issue: this.issueFor(item.product.status, availability, item.quantity, item.product, max),
      };
    });

    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    return {
      items: lines,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotal,
      hasIssues: lines.some((line) => line.issue !== null),
      shippingOptions: (Object.keys(SHIPPING_RATES) as ShippingMethod[]).map((method) => ({
        method,
        fee: calculateShippingFee(method, subtotal),
        freeThreshold: SHIPPING_RATES[method].freeThreshold,
      })),
    };
  }

  /** 設定購物車中某商品的數量（加入或更新）。不保留庫存，結帳時才扣 */
  async setItem(
    memberId: string,
    productId: string,
    quantity: number,
    locale: Locale,
  ): Promise<CartDto> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.status !== 'ACTIVE') {
      throw AppException.notFound(ErrorCode.PRODUCT_NOT_FOUND, '找不到這個商品');
    }
    assertPurchasable(computeAvailability(product));

    const purchased =
      (await purchasedQuantities(this.prisma, memberId, [productId])).get(productId) ?? 0;
    assertQuantityAllowed(product, purchased, quantity);

    const cart = await this.prisma.cart.upsert({
      where: { memberId },
      create: { memberId },
      update: {},
    });
    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: { cartId: cart.id, productId, quantity },
      update: { quantity },
    });
    await this.prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
    return this.getCart(memberId, locale);
  }

  async removeItem(memberId: string, productId: string, locale: Locale): Promise<CartDto> {
    await this.prisma.cartItem.deleteMany({ where: { productId, cart: { memberId } } });
    return this.getCart(memberId, locale);
  }

  async clear(memberId: string, locale: Locale): Promise<CartDto> {
    await this.prisma.cartItem.deleteMany({ where: { cart: { memberId } } });
    return this.getCart(memberId, locale);
  }

  private issueFor(
    status: string,
    availability: Availability,
    quantity: number,
    product: LimitInput,
    max: number,
  ): CartIssue | null {
    if (status !== 'ACTIVE' || availability === Availability.PREORDER_CLOSED)
      return CartIssue.UNAVAILABLE;
    if (availability === Availability.COMING_SOON) return CartIssue.NOT_RELEASED;
    if (availability === Availability.SOLD_OUT) return CartIssue.SOLD_OUT;
    if (quantity > max) {
      return product.stock < quantity ? CartIssue.INSUFFICIENT_STOCK : CartIssue.LIMIT_EXCEEDED;
    }
    return null;
  }
}

export function assertPurchasable(availability: Availability): void {
  if (isPurchasable(availability)) return;
  switch (availability) {
    case Availability.COMING_SOON:
      throw AppException.conflict(ErrorCode.NOT_RELEASED_YET, '商品尚未開賣');
    case Availability.PREORDER_CLOSED:
      throw AppException.conflict(ErrorCode.PREORDER_CLOSED, '預購已截止');
    default:
      throw AppException.conflict(ErrorCode.OUT_OF_STOCK, '商品已售完');
  }
}

export function assertQuantityAllowed(
  product: LimitInput,
  purchased: number,
  quantity: number,
): void {
  if (product.purchaseLimit !== null && purchased + quantity > product.purchaseLimit) {
    throw AppException.conflict(
      ErrorCode.PURCHASE_LIMIT_EXCEEDED,
      `此商品每人限購 ${product.purchaseLimit} 件`,
      {
        limit: product.purchaseLimit,
        purchased,
      },
    );
  }
  if (quantity > product.stock) {
    throw AppException.conflict(ErrorCode.OUT_OF_STOCK, `庫存不足，目前剩 ${product.stock} 件`, {
      available: product.stock,
    });
  }
}
