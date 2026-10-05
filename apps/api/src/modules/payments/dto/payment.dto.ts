import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { GatewayRedirectDto } from '../../../common/http/gateway-redirect.dto.js';
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

export class PaymentInstructionDto extends GatewayRedirectDto {
  @ApiProperty({ enum: PaymentProvider, enumName: 'PaymentProvider' })
  provider!: PaymentProvider;
  merchantTradeNo!: string;
  /** 訂單付款期限 */
  expiresAt!: Date | null;
}
