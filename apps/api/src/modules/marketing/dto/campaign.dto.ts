import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDate,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PageMeta, PaginationQuery } from '../../../common/http/pagination.dto.js';
import { SUPPORTED_LOCALES, type Locale } from '../../../common/i18n/locale.js';
import { CampaignStatus, MemberTier } from '../../../generated/prisma/enums.js';
import { TranslationLocaleInput } from '../../catalog/dto/admin-catalog.dto.js';

export class CampaignTranslationInput extends TranslationLocaleInput {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  subject!: string;

  /** 純文字，段落以空行分隔；{{name}} 會換成會員名稱 */
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;
}

export class CreateCampaignDto {
  /** 內部名稱（會員看不到） */
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  /** 收件對象的最低會員等級；不填表示所有訂閱的會員 */
  @ApiPropertyOptional({ enum: MemberTier, enumName: 'MemberTier', nullable: true })
  @IsOptional()
  @IsIn(Object.values(MemberTier))
  minTier?: MemberTier | null;

  @ValidateNested({ each: true })
  @Type(() => CampaignTranslationInput)
  @ArrayMinSize(1)
  @ArrayMaxSize(SUPPORTED_LOCALES.length)
  translations!: CampaignTranslationInput[];
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}

export class ScheduleCampaignDto {
  /** 預定寄送時間；不填或已過去表示立即（排程每分鐘檢查一次） */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date | null;
}

export class TestCampaignDto {
  /** 收件 Email；不填寄給目前登入的管理員 */
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: Locale;
}

export class CampaignQueryDto extends PaginationQuery {
  @ApiPropertyOptional({ enum: CampaignStatus, enumName: 'CampaignStatus' })
  @IsOptional()
  @IsIn(Object.values(CampaignStatus))
  status?: CampaignStatus;
}

export class CampaignTranslationDto {
  locale!: string;
  subject!: string;
  body!: string;
}

export class CampaignStatsDto {
  /** 已寫入外寄匣、等待寄出 */
  pending!: number;
  sent!: number;
  failed!: number;
}

export class CampaignDto {
  id!: string;
  name!: string;
  /** 繁中主旨 */
  subject!: string;
  @ApiProperty({ enum: CampaignStatus, enumName: 'CampaignStatus' })
  status!: CampaignStatus;
  @ApiProperty({ enum: MemberTier, enumName: 'MemberTier', nullable: true })
  minTier!: MemberTier | null;
  scheduledAt!: Date | null;
  startedAt!: Date | null;
  sentAt!: Date | null;
  /** 草稿與排程中為目前符合條件的人數；寄出後為實際收件人數 */
  audienceCount!: number;
  stats!: CampaignStatsDto;
  translations!: CampaignTranslationDto[];
  createdAt!: Date;
  updatedAt!: Date;
}

export class CampaignListDto {
  data!: CampaignDto[];
  meta!: PageMeta;
}

export class UnsubscribeDto {
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token!: string;
}
