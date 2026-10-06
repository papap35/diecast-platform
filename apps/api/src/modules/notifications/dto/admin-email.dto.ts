import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageMeta, PaginationQuery } from '../../../common/http/pagination.dto.js';
import { EmailStatus, NotificationType } from '../../../generated/prisma/enums.js';

/** 信件類型：站內通知同步寄出的 Email、電子報、其他（例如電子報測試信） */
export const EMAIL_KINDS = ['NOTIFICATION', 'CAMPAIGN', 'OTHER'] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export class AdminEmailQueryDto extends PaginationQuery {
  @ApiPropertyOptional({ enum: EmailStatus, enumName: 'EmailStatus' })
  @IsOptional()
  @IsIn(Object.values(EmailStatus))
  status?: EmailStatus;

  @ApiPropertyOptional({ enum: EMAIL_KINDS, enumName: 'EmailKind' })
  @IsOptional()
  @IsIn(EMAIL_KINDS)
  kind?: EmailKind;

  /** 收件人或主旨關鍵字 */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class AdminEmailListItemDto {
  id!: string;
  to!: string;
  subject!: string;
  @ApiProperty({ enum: EMAIL_KINDS, enumName: 'EmailKind' })
  kind!: EmailKind;
  @ApiProperty({ enum: EmailStatus, enumName: 'EmailStatus' })
  status!: EmailStatus;
  attempts!: number;
  /** 寄送失敗後的下次自動重試時間 */
  nextAttemptAt!: Date | null;
  lastError!: string | null;
  sentAt!: Date | null;
  createdAt!: Date;
}

export class EmailStatsDto {
  pending!: number;
  sent!: number;
  failed!: number;
}

export class AdminEmailListDto {
  data!: AdminEmailListItemDto[];
  meta!: PageMeta;
  /** 全部信件的狀態統計（不受篩選影響） */
  stats!: EmailStatsDto;
}

export class EmailCampaignRefDto {
  id!: string;
  name!: string;
}

export class AdminEmailDto extends AdminEmailListItemDto {
  /** 純文字內容 */
  text!: string;
  unsubscribeUrl!: string | null;
  campaign!: EmailCampaignRefDto | null;
  /** 收件人是會員時的會員 id（後台會員頁連結） */
  memberId!: string | null;
  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType', nullable: true })
  notificationType!: NotificationType | null;
}

export class RetryEmailsResultDto {
  /** 重新排入寄送的封數 */
  count!: number;
}
