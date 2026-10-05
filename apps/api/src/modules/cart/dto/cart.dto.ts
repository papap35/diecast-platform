import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { ShippingMethod } from '../../../generated/prisma/enums.js';
import { ProductSummaryDto } from '../../catalog/dto/catalog.dto.js';

export const CartIssue = {
  UNAVAILABLE: 'UNAVAILABLE',
  NOT_RELEASED: 'NOT_RELEASED',
  SOLD_OUT: 'SOLD_OUT',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
} as const;
export type CartIssue = (typeof CartIssue)[keyof typeof CartIssue];

export const MAX_QUANTITY_PER_ITEM = 99;

export class SetCartItemDto {
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_ITEM)
  quantity!: number;
}

export class CartItemDto {
  product!: ProductSummaryDto;
  quantity!: number;
  lineTotal!: number;
  /** 目前最多可購買數量（已考慮庫存與限購） */
  maxQuantity!: number;
  /** 結帳前需處理的問題；null 表示可以結帳 */
  @ApiProperty({ enum: CartIssue, enumName: 'CartIssue', nullable: true })
  issue!: CartIssue | null;
}

export class ShippingOptionDto {
  @ApiProperty({ enum: ShippingMethod, enumName: 'ShippingMethod' })
  method!: ShippingMethod;
  /** 依目前小計計算的運費 */
  fee!: number;
  /** 免運門檻 */
  freeThreshold!: number;
}

export class CartDto {
  items!: CartItemDto[];
  itemCount!: number;
  subtotal!: number;
  /** 是否有商品需要調整才能結帳 */
  hasIssues!: boolean;
  shippingOptions!: ShippingOptionDto[];
}
