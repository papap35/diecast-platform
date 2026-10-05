import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentProvider } from '../../../generated/prisma/enums.js';

export class StartPaymentDto {
  /**
   * 付款完成後導回的網址（Web 頁面或 App deep link，需在允許清單內）。
   * 省略時導回 Web 前台的訂單頁。
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  returnUrl?: string;
}

export class PaymentInstructionDto {
  @ApiProperty({ enum: PaymentProvider, enumName: 'PaymentProvider' })
  provider!: PaymentProvider;
  /** redirect：直接導向 url；form_post：以 POST 表單把 fields 送到 url（綠界） */
  @ApiProperty({ enum: ['redirect', 'form_post'] })
  type!: 'redirect' | 'form_post';
  url!: string;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  fields!: Record<string, string>;
  merchantTradeNo!: string;
  /** 訂單付款期限 */
  expiresAt!: Date | null;
}
