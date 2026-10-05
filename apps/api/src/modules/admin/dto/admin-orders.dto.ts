import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PageMeta, PaginationQuery } from '../../../common/http/pagination.dto.js';
import { ActorType, OrderStatus, ShippingMethod } from '../../../generated/prisma/enums.js';
import { OrderDto } from '../../orders/dto/order.dto.js';

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

export class AdminOrderDto extends OrderDto {
  member!: OrderMemberDto;
  events!: OrderEventDto[];
  /** 依狀態機目前可以變更成的狀態 */
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus', isArray: true })
  nextStatuses!: OrderStatus[];
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
