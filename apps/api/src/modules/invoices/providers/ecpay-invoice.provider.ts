import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../config/config.module.js';
import { ProviderError } from '../../../common/errors/provider-error.js';
import { parseEcpayDateTime } from '../../ecpay/format.js';
import {
  type AllowanceResult,
  buildAllowanceData,
  buildIssueData,
  buildVoidData,
  decryptInvoiceData,
  type EcpayInvoiceResult,
  encryptInvoiceData,
  type GetIssueResult,
  INVOICE_ENDPOINTS,
  type InvoiceOrder,
  type IssueResult,
} from '../ecpay-invoice.js';
import type {
  FoundInvoice,
  InvoiceProvider,
  IssuedInvoice,
  ReversalTarget,
} from '../invoice-provider.js';

/** 綠界 B2C 電子發票（JSON API，Data 以 AES 加密） */
@Injectable()
export class EcpayInvoiceProvider implements InvoiceProvider {
  readonly provider = 'ECPAY' as const;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async issue(order: InvoiceOrder): Promise<IssuedInvoice> {
    const result = succeeded(
      await this.call<IssueResult>(
        '/B2CInvoice/Issue',
        buildIssueData(this.config.ECPAY_INVOICE_MERCHANT_ID, order),
      ),
    );
    return {
      invoiceNo: result.InvoiceNo ?? '',
      invoiceDate: parseEcpayDateTime(result.InvoiceDate) ?? new Date(),
      randomNumber: result.RandomNumber ?? '',
      raw: { ...result },
    };
  }

  async find(relateNumber: string): Promise<FoundInvoice | null> {
    const result = await this.call<GetIssueResult>('/B2CInvoice/GetIssue', {
      RelateNumber: relateNumber,
    });
    if (result.RtnCode !== 1 || !result.IIS_Number) return null;
    return {
      invoiceNo: result.IIS_Number,
      invoiceDate: parseEcpayDateTime(result.IIS_Create_Date) ?? new Date(),
      randomNumber: result.IIS_Random_Number ?? '',
      voided: result.IIS_Invalid_Status === '1',
      raw: { ...result },
    };
  }

  async void(target: ReversalTarget, reason: string) {
    const result = succeeded(
      await this.call('/B2CInvoice/Invalid', {
        RelateNumber: target.order.orderNo,
        ...buildVoidData({ ...target, reason }),
      }),
    );
    return { ...result };
  }

  async allowance(target: ReversalTarget) {
    const result = succeeded(
      await this.call<AllowanceResult>('/B2CInvoice/Allowance', buildAllowanceData(target)),
    );
    return { allowanceNo: result.IA_Allow_No ?? '', raw: { ...result } };
  }

  private async call<T extends EcpayInvoiceResult>(
    path: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    const merchantId = this.config.ECPAY_INVOICE_MERCHANT_ID;
    const key = this.config.ECPAY_INVOICE_HASH_KEY;
    const iv = this.config.ECPAY_INVOICE_HASH_IV;
    let body: { TransCode?: number; TransMsg?: string; Data?: string };
    try {
      const res = await fetch(`${INVOICE_ENDPOINTS[this.config.ECPAY_ENV]}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          MerchantID: merchantId,
          RqHeader: { Timestamp: Math.floor(Date.now() / 1000) },
          Data: encryptInvoiceData({ MerchantID: merchantId, ...data }, key, iv),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new ProviderError(`綠界電子發票回應 HTTP ${res.status}`);
      body = (await res.json()) as typeof body;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(`無法連線綠界電子發票：${(error as Error).message}`);
    }
    if (body.TransCode !== 1 || !body.Data) {
      throw new ProviderError(
        `綠界電子發票傳輸錯誤：${body.TransCode} ${body.TransMsg ?? ''}`.trim(),
      );
    }
    return decryptInvoiceData<T>(body.Data, key, iv);
  }
}

function succeeded<T extends EcpayInvoiceResult>(result: T): T {
  if (result.RtnCode !== 1) throw new ProviderError(`${result.RtnCode} ${result.RtnMsg}`);
  return result;
}
