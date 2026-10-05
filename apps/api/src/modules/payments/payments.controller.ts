import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { ApiLocaleQuery, ReqLocale } from '../../common/i18n/locale.decorator.js';
import type { Locale } from '../../common/i18n/locale.js';
import type { MemberPrincipal } from '../auth/auth.types.js';
import { CurrentMember, MemberAuth } from '../auth/decorators.js';
import { PaymentInstructionDto, StartPaymentDto } from './dto/payment.dto.js';
import { renderMockPaymentPage } from './mock-page.js';
import { EcpayGateway } from './providers/ecpay.gateway.js';
import { PaymentsService, type PaymentResult, withPaymentResult } from './payments.service.js';

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * 開始付款：回傳導向金流頁的方式。
   * `redirect` 直接開啟 url；`form_post` 需以 HTML 表單 POST fields 到 url（綠界規格）。
   */
  @Post('orders/:orderNo/payments')
  @MemberAuth()
  @ApiLocaleQuery()
  start(
    @CurrentMember() member: MemberPrincipal,
    @Param('orderNo') orderNo: string,
    @Body() dto: StartPaymentDto,
    @ReqLocale() locale: Locale,
  ): Promise<PaymentInstructionDto> {
    return this.payments.start(member.id, orderNo, locale, dto.returnUrl);
  }
}

/** 綠界回呼：ReturnURL（伺服器對伺服器通知）與 OrderResultURL（付款完成後瀏覽器導回） */
@ApiTags('Payments / Callbacks')
@SkipThrottle()
@Controller('payments/ecpay')
export class EcpayCallbackController {
  private readonly logger = new Logger(EcpayCallbackController.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly ecpay: EcpayGateway,
  ) {}

  /** 綠界付款結果通知，必須回應 `1|OK`，否則綠界會重送 */
  @Post('notify')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain')
  async notify(
    @Body() body: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    if (!this.ecpay.verify(body)) {
      this.logger.warn(`CheckMacValue 驗證失敗：${body.MerchantTradeNo}`);
      res.status(HttpStatus.BAD_REQUEST);
      return '0|CheckMacValue Error';
    }
    await this.payments.applyResult(body.MerchantTradeNo!, toPaymentResult(body));
    return '1|OK';
  }

  /** 付款完成後綠界以瀏覽器 POST 導回，處理結果後轉址回前台 */
  @Post('return')
  async return(@Body() body: Record<string, string>, @Res() res: Response): Promise<void> {
    if (!this.ecpay.verify(body)) {
      this.logger.warn(`OrderResultURL 驗證失敗：${body.MerchantTradeNo}`);
      res.status(HttpStatus.BAD_REQUEST).send('CheckMacValue Error');
      return;
    }
    const result = toPaymentResult(body);
    const { returnUrl } = await this.payments.applyResult(body.MerchantTradeNo!, result);
    res.redirect(HttpStatus.SEE_OTHER, withPaymentResult(returnUrl ?? '/', result.success));
  }
}

/** 模擬金流頁（僅示範與開發使用，不列入 API 文件） */
@SkipThrottle()
@Controller('payments/mock')
export class MockPaymentController {
  constructor(
    private readonly payments: PaymentsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get(':merchantTradeNo')
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/html; charset=utf-8')
  async page(
    @Param('merchantTradeNo') merchantTradeNo: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const payment = await this.payments.findForMockPage(merchantTradeNo);
    // 表單送出後會轉址回前台；瀏覽器對轉址也套用 form-action，因此要列出允許的前台網域
    const origins = [this.config.WEB_BASE_URL, ...this.config.CORS_ORIGINS].map(
      (url) => new URL(url).origin,
    );
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${[...new Set(origins)].join(' ')} paddock64:; base-uri 'none'; frame-ancestors 'none'`,
    );
    return renderMockPaymentPage(payment);
  }

  @Post(':merchantTradeNo/complete')
  @ApiExcludeEndpoint()
  async complete(
    @Param('merchantTradeNo') merchantTradeNo: string,
    @Body() body: { result?: string },
    @Res() res: Response,
  ): Promise<void> {
    await this.payments.findForMockPage(merchantTradeNo);
    const success = body.result === 'success';
    const { returnUrl } = await this.payments.applyResult(merchantTradeNo, {
      success,
      providerTradeNo: `MOCK-${Date.now()}`,
      method: 'MockCard',
      failedReason: success ? undefined : '模擬付款失敗（使用者選擇）',
      raw: { simulated: true, result: body.result ?? null },
    });
    res.redirect(HttpStatus.SEE_OTHER, withPaymentResult(returnUrl ?? '/', success));
  }
}

/** 綠界回傳欄位 → 內部付款結果 */
export function toPaymentResult(body: Record<string, string>): PaymentResult {
  const success = body.RtnCode === '1';
  return {
    success,
    providerTradeNo: body.TradeNo,
    amount: body.TradeAmt ? Number(body.TradeAmt) : undefined,
    method: body.PaymentType,
    paidAt: body.PaymentDate ? parseTaipeiTime(body.PaymentDate) : undefined,
    failedReason: success ? undefined : `${body.RtnCode ?? ''} ${body.RtnMsg ?? ''}`.trim(),
    raw: body,
  };
}

function parseTaipeiTime(value: string): Date | undefined {
  const match = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, y, m, d, hh, mm, ss] = match;
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}+08:00`);
}
