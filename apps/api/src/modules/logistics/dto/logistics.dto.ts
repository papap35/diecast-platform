import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { GatewayRedirectDto } from '../../../common/http/gateway-redirect.dto.js';
import { ShipmentStatus, ShippingMethod } from '../../../generated/prisma/enums.js';

const CVS_METHODS = Object.values(ShippingMethod).filter((method) => method !== 'HOME_DELIVERY');
const SIMULATED_STATUSES = Object.values(ShipmentStatus).filter((status) => status !== 'CREATED');

export class StartCvsMapDto {
  /** 超商（宅配不需選店） */
  @ApiProperty({ enum: ShippingMethod, enumName: 'ShippingMethod' })
  @IsIn(CVS_METHODS, { message: '請選擇超商取貨的配送方式' })
  method!: ShippingMethod;

  /**
   * 選店完成後導回的網址（Web 頁面或 App deep link，需在允許清單內），會附上 `?cvsToken=…`。
   * 省略時導回 Web 前台結帳頁。
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  returnUrl?: string;

  /** 行動裝置開啟手機版電子地圖 */
  @IsOptional()
  @IsBoolean()
  mobile?: boolean;
}

export class CvsMapInstructionDto extends GatewayRedirectDto {
  /** 選店工作階段代碼，選店完成後以 `cvsToken` 帶回 */
  token!: string;
}

export class CvsSelectionDto {
  @ApiProperty({ enum: ShippingMethod, enumName: 'ShippingMethod' })
  method!: ShippingMethod;
  storeId!: string;
  storeName!: string;
  storeAddress!: string;
}

export class SimulateShipmentDto {
  @ApiProperty({ enum: SIMULATED_STATUSES })
  @IsIn(SIMULATED_STATUSES)
  status!: Exclude<ShipmentStatus, 'CREATED'>;
}
