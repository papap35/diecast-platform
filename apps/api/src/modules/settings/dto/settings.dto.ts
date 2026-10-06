import { IsInt, Max, Min } from 'class-validator';

export class StoreSettingsDto {
  /** 宅配運費 */
  homeDeliveryFee!: number;
  /** 宅配免運門檻（商品小計；0 表示一律免運） */
  homeFreeShippingThreshold!: number;
  /** 超商取貨運費（各家超商共用） */
  cvsFee!: number;
  /** 超商取貨免運門檻 */
  cvsFreeShippingThreshold!: number;
  /** 一般訂單的付款期限（分鐘） */
  paymentTimeoutMinutes!: number;
  /** 含限量商品的訂單付款期限（分鐘） */
  limitedPaymentTimeoutMinutes!: number;
  updatedAt!: Date;
}

export class UpdateStoreSettingsDto {
  @IsInt()
  @Min(0)
  @Max(1000)
  homeDeliveryFee!: number;

  @IsInt()
  @Min(0)
  @Max(100_000)
  homeFreeShippingThreshold!: number;

  @IsInt()
  @Min(0)
  @Max(1000)
  cvsFee!: number;

  @IsInt()
  @Min(0)
  @Max(100_000)
  cvsFreeShippingThreshold!: number;

  /** 10 分鐘～3 天 */
  @IsInt()
  @Min(10)
  @Max(4320)
  paymentTimeoutMinutes!: number;

  /** 5～120 分鐘，且不可長於一般訂單 */
  @IsInt()
  @Min(5)
  @Max(120)
  limitedPaymentTimeoutMinutes!: number;
}
