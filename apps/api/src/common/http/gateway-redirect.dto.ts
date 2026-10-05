import { ApiProperty } from '@nestjs/swagger';

/** 導向第三方頁面（金流付款頁、物流電子地圖）的方式 */
export interface GatewayRedirect {
  type: 'redirect' | 'form_post';
  url: string;
  fields: Record<string, string>;
}

export class GatewayRedirectDto implements GatewayRedirect {
  /** redirect：直接導向 url；form_post：以 POST 表單把 fields 送到 url（綠界） */
  @ApiProperty({ enum: ['redirect', 'form_post'] })
  type!: 'redirect' | 'form_post';
  url!: string;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  fields!: Record<string, string>;
}
