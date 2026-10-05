import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SUPPORTED_LOCALES, type Locale } from '../../../common/i18n/locale.js';
import { MemberTier } from '../../../generated/prisma/enums.js';
import { TokenPairDto } from './token.dto.js';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** 至少 8 個字元 */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: Locale;

  /** 是否同意收到新品與活動電子報 */
  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class MemberProfileDto {
  id!: string;
  email!: string;
  name!: string;
  phone!: string | null;
  @ApiProperty({ enum: SUPPORTED_LOCALES })
  locale!: string;
  marketingOptIn!: boolean;
  /** 會員等級（決定優先購資格與免運優惠） */
  @ApiProperty({ enum: MemberTier, enumName: 'MemberTier' })
  tier!: MemberTier;
  createdAt!: Date;
}

export class MemberAuthResultDto {
  member!: MemberProfileDto;
  tokens!: TokenPairDto;
}
