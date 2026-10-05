import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SUPPORTED_LOCALES, type Locale } from '../../../common/i18n/locale.js';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  /** 台灣手機號碼，例如 0912345678 */
  @IsOptional()
  @Matches(/^09\d{8}$/, { message: '手機號碼格式應為 09 開頭共 10 碼' })
  phone?: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: Locale;

  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}

export class DeleteAccountDto {
  /** 為避免誤刪，需再次輸入密碼 */
  @IsString()
  @MinLength(1)
  password!: string;
}
