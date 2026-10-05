import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PageMeta, PaginationQuery } from '../../../common/http/pagination.dto.js';
import { SUPPORTED_LOCALES, type Locale } from '../../../common/i18n/locale.js';
import {
  CITIZEN_CERT,
  DONATION_CODE,
  isValidTaxId,
  MOBILE_BARCODE,
  TW_MOBILE,
} from '../../../common/validation/tw.js';
import {
  IntegrationProvider,
  InvoiceStatus,
  InvoiceType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  SaleType,
  ShipmentStatus,
  ShippingMethod,
} from '../../../generated/prisma/enums.js';

function IsTaxId() {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isTaxId',
      target: object.constructor,
      propertyName,
      options: { message: '統一編號格式不正確' },
      validator: { validate: (value: unknown) => typeof value === 'string' && isValidTaxId(value) },
    });
}

/** 載具號碼依發票類型檢查：手機條碼或自然人憑證 */
function IsCarrierNumber() {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isCarrierNumber',
      target: object.constructor,
      propertyName,
      options: { message: '載具號碼格式不正確' },
      validator: {
        validate: (value: unknown, args) => {
          if (typeof value !== 'string') return false;
          const type = (args?.object as CheckoutDto | undefined)?.invoiceType;
          return type === 'MOBILE_BARCODE' ? MOBILE_BARCODE.test(value) : CITIZEN_CERT.test(value);
        },
      },
    });
}

const isHomeDelivery = (o: CheckoutDto) => o.shippingMethod === 'HOME_DELIVERY';
const isCvs = (o: CheckoutDto) =>
  o.shippingMethod !== undefined && o.shippingMethod !== 'HOME_DELIVERY';

export class CheckoutItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class CheckoutDto {
  /** 直接購買（不經購物車，例如限量發售的「立即購買」）；省略則結帳整個購物車 */
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  items?: CheckoutItemDto[];

  @ApiProperty({ enum: ShippingMethod, enumName: 'ShippingMethod' })
  @IsIn(Object.values(ShippingMethod))
  shippingMethod!: ShippingMethod;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  recipientName!: string;

  /** 手機號碼（超商取貨通知會寄到這支手機） */
  @Matches(TW_MOBILE, { message: '手機號碼格式應為 09 開頭共 10 碼' })
  recipientPhone!: string;

  /** 預設為會員 Email */
  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @ValidateIf(isHomeDelivery)
  @Matches(/^\d{3}(\d{2,3})?$/, { message: '郵遞區號應為 3、5 或 6 碼數字' })
  postalCode?: string;

  @ValidateIf(isHomeDelivery)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  city?: string;

  @ValidateIf(isHomeDelivery)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  district?: string;

  @ValidateIf(isHomeDelivery)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  addressLine?: string;

  /** 超商門市代號（由電子地圖選店取得） */
  @ValidateIf(isCvs)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  cvsStoreId?: string;

  @ValidateIf(isCvs)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  cvsStoreName?: string;

  @ValidateIf(isCvs)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  cvsStoreAddress?: string;

  @ApiProperty({ enum: InvoiceType, enumName: 'InvoiceType' })
  @IsIn(Object.values(InvoiceType))
  invoiceType!: InvoiceType;

  /** 手機條碼（/ 開頭 8 碼）或自然人憑證號碼，依 invoiceType 而定 */
  @ValidateIf(
    (o: CheckoutDto) => o.invoiceType === 'MOBILE_BARCODE' || o.invoiceType === 'CITIZEN_CERT',
  )
  @IsCarrierNumber()
  invoiceCarrierNum?: string;

  @ValidateIf((o: CheckoutDto) => o.invoiceType === 'DONATION')
  @Matches(DONATION_CODE, { message: '捐贈碼為 3–7 碼數字' })
  invoiceDonationCode?: string;

  @ValidateIf((o: CheckoutDto) => o.invoiceType === 'COMPANY')
  @IsTaxId()
  invoiceTaxId?: string;

  @ValidateIf((o: CheckoutDto) => o.invoiceType === 'COMPANY')
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  invoiceTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: Locale;
}

export class OrderItemDto {
  productId!: string;
  sku!: string;
  name!: string;
  imageUrl!: string | null;
  @ApiProperty({ enum: SaleType, enumName: 'SaleType' })
  saleType!: SaleType;
  unitPrice!: number;
  quantity!: number;
  lineTotal!: number;
}

export class OrderPaymentDto {
  @ApiProperty({ enum: PaymentProvider, enumName: 'PaymentProvider' })
  provider!: PaymentProvider;
  @ApiProperty({ enum: PaymentStatus, enumName: 'PaymentStatus' })
  status!: PaymentStatus;
  amount!: number;
  method!: string | null;
  paidAt!: Date | null;
  createdAt!: Date;
}

export class OrderShipmentDto {
  @ApiProperty({ enum: IntegrationProvider, enumName: 'IntegrationProvider' })
  provider!: IntegrationProvider;
  @ApiProperty({ enum: ShipmentStatus, enumName: 'ShipmentStatus' })
  status!: ShipmentStatus;
  /** 綠界物流子類型，例如 UNIMARTC2C、TCAT */
  logisticsSubType!: string;
  /** 寄貨編號（超商）或託運單號（宅配），可用來查詢配送進度 */
  shipmentNo!: string | null;
  /** 驗證碼（7-ELEVEN 交貨便） */
  validationNo!: string | null;
  /** 最新物流狀態說明 */
  statusMessage!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class OrderInvoiceDto {
  @ApiProperty({ enum: InvoiceStatus, enumName: 'InvoiceStatus' })
  status!: InvoiceStatus;
  invoiceNo!: string | null;
  invoiceDate!: Date | null;
  /** 發票隨機碼（對獎、查詢用） */
  randomNumber!: string | null;
  /** 跨期退款開立的折讓單號 */
  allowanceNo!: string | null;
  amount!: number;
}

export class OrderDto {
  id!: string;
  orderNo!: string;
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status!: OrderStatus;
  locale!: string;
  currency!: string;
  subtotal!: number;
  shippingFee!: number;
  discountTotal!: number;
  total!: number;
  @ApiProperty({ enum: ShippingMethod, enumName: 'ShippingMethod' })
  shippingMethod!: ShippingMethod;
  recipientName!: string;
  recipientPhone!: string;
  recipientEmail!: string;
  postalCode!: string | null;
  city!: string | null;
  district!: string | null;
  addressLine!: string | null;
  cvsStoreId!: string | null;
  cvsStoreName!: string | null;
  cvsStoreAddress!: string | null;
  @ApiProperty({ enum: InvoiceType, enumName: 'InvoiceType' })
  invoiceType!: InvoiceType;
  invoiceCarrierNum!: string | null;
  invoiceDonationCode!: string | null;
  invoiceTaxId!: string | null;
  invoiceTitle!: string | null;
  note!: string | null;
  /** 未付款訂單的付款期限，逾期自動取消 */
  paymentDeadline!: Date | null;
  paidAt!: Date | null;
  shippedAt!: Date | null;
  completedAt!: Date | null;
  cancelledAt!: Date | null;
  cancelReason!: string | null;
  createdAt!: Date;
  items!: OrderItemDto[];
  payments!: OrderPaymentDto[];
  /** 物流單（出貨後才有） */
  shipment!: OrderShipmentDto | null;
  /** 電子發票（付款成功後開立） */
  invoice!: OrderInvoiceDto | null;
  /** 預購訂單的預計出貨時間（現貨訂單為 null） */
  expectedShipAt!: Date | null;
  /** 是否可以（重新）付款 */
  canPay!: boolean;
  /** 會員是否可自行取消 */
  canCancel!: boolean;
}

export class OrderSummaryDto {
  id!: string;
  orderNo!: string;
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status!: OrderStatus;
  total!: number;
  itemCount!: number;
  firstItemName!: string;
  firstItemImageUrl!: string | null;
  paymentDeadline!: Date | null;
  createdAt!: Date;
}

export class OrderListDto {
  data!: OrderSummaryDto[];
  meta!: PageMeta;
}

export class OrderListQueryDto extends PaginationQuery {
  @ApiPropertyOptional({ enum: OrderStatus, enumName: 'OrderStatus' })
  @IsOptional()
  @IsIn(Object.values(OrderStatus))
  status?: OrderStatus;
}
