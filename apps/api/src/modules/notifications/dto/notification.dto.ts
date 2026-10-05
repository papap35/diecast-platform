import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsOptional, IsUUID } from 'class-validator';
import { PageMeta } from '../../../common/http/pagination.dto.js';
import { NotificationType } from '../../../generated/prisma/enums.js';

export class NotificationDto {
  id!: string;
  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  type!: NotificationType;
  title!: string;
  body!: string;
  /** 前台路徑（不含語系），例如 /account/orders/P64… */
  link!: string | null;
  readAt!: Date | null;
  createdAt!: Date;
}

export class NotificationListDto {
  data!: NotificationDto[];
  meta!: PageMeta;
  unreadCount!: number;
}

export class UnreadCountDto {
  count!: number;
}

export class MarkReadDto {
  /** 要標示為已讀的通知；省略表示全部 */
  @IsOptional()
  @IsUUID('all', { each: true })
  @ArrayMaxSize(100)
  ids?: string[];
}

export class MarkReadResultDto {
  updated!: number;
}
