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
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { mockPageCsp } from '../../common/http/html.js';
import { frontendOrigins } from '../../common/http/return-url.js';
import { ApiLocaleQuery, ReqLocale } from '../../common/i18n/locale.decorator.js';
import type { Locale } from '../../common/i18n/locale.js';
import type { MemberPrincipal } from '../auth/auth.types.js';
import { CurrentMember, MemberAuth } from '../auth/decorators.js';
import { CvsMapInstructionDto, CvsSelectionDto, StartCvsMapDto } from './dto/logistics.dto.js';
import { selectionFromMapReply, shipmentStatusFromCode } from './ecpay-logistics.js';
import { LogisticsService } from './logistics.service.js';
import { MOCK_STORES, renderMockMapPage } from './mock-map-page.js';
import { EcpayLogistics } from './providers/ecpay-logistics.provider.js';

@ApiTags('Logistics')
@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logistics: LogisticsService) {}

  /**
   * 開啟超商電子地圖選店。回傳導向地圖的方式（同付款：`redirect` 或 `form_post`），
   * 選好門市後會導回 returnUrl 並附上 `cvsToken`。
   */
  @Post('cvs-map')
  @MemberAuth()
  @ApiLocaleQuery()
  startCvsMap(
    @CurrentMember() member: MemberPrincipal,
    @Body() dto: StartCvsMapDto,
    @ReqLocale() locale: Locale,
  ): Promise<CvsMapInstructionDto> {
    return this.logistics.startCvsMap(member.id, dto, locale);
  }

  /** 以 cvsToken 取回選店結果（30 分鐘內有效） */
  @Get('cvs-map/:token')
  @MemberAuth()
  getSelection(
    @CurrentMember() member: MemberPrincipal,
    @Param('token') token: string,
  ): Promise<CvsSelectionDto> {
    return this.logistics.getCvsSelection(member.id, token);
  }
}

/** 綠界物流回呼：電子地圖選店結果（瀏覽器導回）與物流狀態通知（伺服器對伺服器） */
@ApiTags('Logistics / Callbacks')
@SkipThrottle()
@Controller('logistics/ecpay')
export class EcpayLogisticsCallbackController {
  private readonly logger = new Logger(EcpayLogisticsCallbackController.name);

  constructor(
    private readonly logistics: LogisticsService,
    private readonly ecpay: EcpayLogistics,
  ) {}

  /** 電子地圖選店後綠界以瀏覽器 POST 帶回門市，存入選店工作階段後導回前台 */
  @Post('map-reply')
  async mapReply(@Body() body: Record<string, string>, @Res() res: Response): Promise<void> {
    const url = await this.logistics.completeCvsMap(
      body.ExtraData ?? '',
      selectionFromMapReply(body),
    );
    res.redirect(HttpStatus.SEE_OTHER, url);
  }

  /** 物流狀態通知，必須回應 `1|OK`，否則綠界會重送 */
  @Post('notify')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain')
  async notify(
    @Body() body: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    if (!this.ecpay.verify(body)) {
      this.logger.warn(`物流通知 CheckMacValue 驗證失敗：${body.MerchantTradeNo}`);
      res.status(HttpStatus.BAD_REQUEST);
      return '0|CheckMacValue Error';
    }
    const found = await this.logistics.applyStatus(body.MerchantTradeNo ?? '', {
      code: body.RtnCode ?? '',
      message: body.RtnMsg ?? '',
      status: shipmentStatusFromCode(body.RtnCode),
      shipmentNo: body.CVSPaymentNo || body.BookingNote || undefined,
      validationNo: body.CVSValidationNo || undefined,
      raw: body,
    });
    if (!found) this.logger.warn(`收到不存在的物流單通知：${body.MerchantTradeNo}`);
    return '1|OK';
  }
}

/** 模擬電子地圖（僅示範與開發使用，不列入 API 文件） */
@SkipThrottle()
@Controller('logistics/mock')
export class MockLogisticsController {
  constructor(
    private readonly logistics: LogisticsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('map/:token')
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/html; charset=utf-8')
  async page(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const session = await this.logistics.getMapSession(token);
    if (!session) {
      throw AppException.notFound(
        ErrorCode.CVS_SELECTION_NOT_FOUND,
        '選店連結已過期，請回到結帳頁重新選擇',
      );
    }
    res.setHeader('Content-Security-Policy', mockPageCsp(frontendOrigins(this.config)));
    return renderMockMapPage(token, session.method);
  }

  @Post('map/:token')
  @ApiExcludeEndpoint()
  async select(
    @Param('token') token: string,
    @Body() body: { storeId?: string; action?: string },
    @Res() res: Response,
  ): Promise<void> {
    const session = await this.logistics.getMapSession(token);
    const store =
      session && body.action !== 'cancel'
        ? MOCK_STORES[session.method].find((candidate) => candidate.id === body.storeId)
        : undefined;
    const url = await this.logistics.completeCvsMap(
      token,
      session && store
        ? {
            method: session.method,
            storeId: store.id,
            storeName: store.name,
            storeAddress: store.address,
          }
        : null,
    );
    res.redirect(HttpStatus.SEE_OTHER, url);
  }
}
