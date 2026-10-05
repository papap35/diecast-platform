import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.module.js';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { frontendOrigins, resolveReturnUrl, withQuery } from '../../common/http/return-url.js';
import type { Locale } from '../../common/i18n/locale.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { generateMerchantTradeNo } from '../orders/order-number.js';
import { OrdersService } from '../orders/orders.service.js';
import type { PaymentInstructionDto } from './dto/payment.dto.js';
import { EcpayGateway } from './providers/ecpay.gateway.js';
import { MockGateway } from './providers/mock.gateway.js';
import type { PaymentGateway } from './providers/payment-gateway.js';

export interface PaymentResult {
  success: boolean;
  providerTradeNo?: string;
  amount?: number;
  method?: string;
  paidAt?: Date;
  failedReason?: string;
  raw: Prisma.InputJsonValue;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly mock: MockGateway,
    private readonly ecpay: EcpayGateway,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private get gateway(): PaymentGateway {
    return this.config.PAYMENT_PROVIDER === 'ecpay' ? this.ecpay : this.mock;
  }

  /** 為待付款訂單建立一次付款嘗試，回傳前端該如何導向金流頁 */
  async start(
    memberId: string,
    orderNo: string,
    locale: Locale,
    returnUrl?: string,
  ): Promise<PaymentInstructionDto> {
    const order = await this.orders.findMemberOrder(memberId, orderNo);
    if (order.status !== 'PENDING_PAYMENT') {
      throw AppException.conflict(ErrorCode.ORDER_NOT_PAYABLE, '訂單不是待付款狀態');
    }
    if (order.paymentDeadline && order.paymentDeadline <= new Date()) {
      throw AppException.conflict(ErrorCode.ORDER_NOT_PAYABLE, '已超過付款期限，訂單將自動取消');
    }

    const gateway = this.gateway;
    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: gateway.provider,
        merchantTradeNo: generateMerchantTradeNo(),
        amount: order.total,
        returnUrl: resolveReturnUrl(
          returnUrl,
          `${this.config.WEB_BASE_URL}/${locale}/account/orders/${order.orderNo}`,
          frontendOrigins(this.config),
        ),
      },
    });

    const redirect = gateway.createCheckout({
      order,
      payment,
      locale,
      returnUrl: payment.returnUrl!,
    });
    return {
      provider: gateway.provider,
      ...redirect,
      merchantTradeNo: payment.merchantTradeNo,
      expiresAt: order.paymentDeadline,
    };
  }

  /**
   * 套用金流結果（冪等：同一筆付款通知重送多次只會處理一次）。
   * - 成功且訂單仍待付款 → 訂單轉為已付款
   * - 成功但訂單已逾期取消 → 記錄「需人工退款」，交由客服處理
   * - 失敗 → 付款標記失敗，訂單維持待付款，期限內可重新付款
   */
  async applyResult(
    merchantTradeNo: string,
    result: PaymentResult,
  ): Promise<{ orderNo: string; returnUrl: string | null }> {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { merchantTradeNo },
        include: { order: { include: { items: true } } },
      });
      if (!payment) throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這筆付款');
      const outcome = { orderNo: payment.order.orderNo, returnUrl: payment.returnUrl };

      if (payment.status !== 'PENDING') return outcome;

      if (result.success && result.amount !== undefined && result.amount !== payment.amount) {
        this.logger.error(
          `付款金額不符 ${merchantTradeNo}: 應付 ${payment.amount}，實收 ${result.amount}`,
        );
        result = { ...result, success: false, failedReason: '付款金額與訂單不符' };
      }

      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: result.success
          ? {
              status: 'SUCCEEDED',
              paidAt: result.paidAt ?? new Date(),
              providerTradeNo: result.providerTradeNo,
              method: result.method,
              rawNotify: result.raw,
            }
          : {
              status: 'FAILED',
              failedReason: result.failedReason,
              providerTradeNo: result.providerTradeNo,
              rawNotify: result.raw,
            },
      });
      if (count === 0) return outcome;

      const order = payment.order;
      if (!result.success) {
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: 'PAYMENT_FAILED',
            actorType: 'SYSTEM',
            message: `付款失敗：${result.failedReason ?? '未知原因'}`,
          },
        });
      } else if (order.status === 'PENDING_PAYMENT') {
        await this.orders.applyTransition(
          tx,
          order,
          'PAID',
          { type: 'SYSTEM' },
          `付款成功（${payment.provider}${result.method ? ` / ${result.method}` : ''}）`,
        );
      } else {
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: 'LATE_PAYMENT',
            actorType: 'SYSTEM',
            message: `訂單狀態為 ${order.status} 時收到付款 NT$${payment.amount}，需人工退款`,
          },
        });
      }
      return outcome;
    });
  }

  async findForMockPage(merchantTradeNo: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { merchantTradeNo },
      include: { order: { select: { orderNo: true, total: true, paymentDeadline: true } } },
    });
    if (!payment || payment.provider !== 'MOCK') {
      throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這筆付款');
    }
    return payment;
  }
}

/** 在導回網址附上付款結果 */
export function withPaymentResult(returnUrl: string, success: boolean): string {
  return withQuery(returnUrl, { payment: success ? 'success' : 'failed' });
}
