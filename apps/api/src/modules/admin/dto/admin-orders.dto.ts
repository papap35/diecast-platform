import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PageMeta, PaginationQuery } from '../../../common/http/pagination.dto.js';
import {
  ActorType,
  IntegrationProvider,
  OrderStatus,
  ShippingMethod,
} from '../../../generated/prisma/enums.js';
import { OrderDto, OrderInvoiceDto, OrderShipmentDto } from '../../orders/dto/order.dto.js';

export class AdminOrderQueryDto extends PaginationQuery {
  @ApiPropertyOptional({ enum: OrderStatus, enumName: 'OrderStatus' })
  @IsOptional()
  @IsIn(Object.values(OrderStatus))
  status?: OrderStatus;

  /** 訂單編號、會員 Email、收件人姓名或電話 */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  /** 建立時間起（含） */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  /** 建立時間迄（不含） */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

export class AdminOrderListItemDto {
  id!: string;
  orderNo!: string;
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status!: OrderStatus;
  total!: number;
  itemCount!: number;
  memberEmail!: string;
  recipientName!: string;
  @ApiProperty({ enum: ShippingMethod, enumName: 'ShippingMethod' })
  shippingMethod!: ShippingMethod;
  paidAt!: Date | null;
  createdAt!: Date;
}

export class AdminOrderListDto {
  data!: AdminOrderListItemDto[];
  meta!: PageMeta;
}

export class OrderMemberDto {
  id!: string;
  email!: string;
  name!: string;
  phone!: string | null;
}

export class OrderEventDto {
  id!: string;
  type!: string;
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus', nullable: true })
  fromStatus!: OrderStatus | null;
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus', nullable: true })
  toStatus!: OrderStatus | null;
  @ApiProperty({ enum: ActorType, enumName: 'ActorType' })
  actorType!: ActorType;
  actorId!: string | null;
  message!: string | null;
  createdAt!: Date;
}

export class AdminShipmentDto extends OrderShipmentDto {
  /** 本站送給物流商的交易編號 */
  merchantTradeNo!: string;
  /** 綠界物流交易編號（AllPayLogisticsID） */
  logisticsId!: string | null;
  /** 最新物流狀態代碼 */
  statusCode!: string | null;
}

export class AdminInvoiceDto extends OrderInvoiceDto {
  @ApiProperty({ enum: IntegrationProvider, enumName: 'IntegrationProvider' })
  provider!: IntegrationProvider;
  /** 開立或作廢的失敗次數 */
  attempts!: number;
  nextAttemptAt!: Date | null;
  lastError!: string | null;
  /** 自動重試已達上限，需要人工處理 */
  needsAttention!: boolean;
}

export class AdminOrderDto extends OrderDto {
  // 覆寫為後台版本（多了內部編號與重試資訊）。初始值只為滿足 TS 的類別欄位覆寫規則；
  // 明確標註 ApiProperty，否則 Swagger 會沿用父類別已產生的欄位定義
  @ApiProperty({ type: () => AdminShipmentDto, nullable: true })
  shipment: AdminShipmentDto | null = null;
  @ApiProperty({ type: () => AdminInvoiceDto, nullable: true })
  invoice: AdminInvoiceDto | null = null;
  member!: OrderMemberDto;
  events!: OrderEventDto[];
  /** 依狀態機目前可以變更成的狀態 */
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus', isArray: true })
  nextStatuses!: OrderStatus[];
  /** 目前可以建立（或退回後重新建立）物流單 */
  canCreateShipment!: boolean;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  @IsIn(Object.values(OrderStatus))
  status!: OrderStatus;

  /** 會記錄在訂單事件中，例如物流單號或退款原因 */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AddOrderNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message!: string;
}
