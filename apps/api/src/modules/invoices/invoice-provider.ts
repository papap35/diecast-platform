import type { IntegrationProvider, Prisma } from '../../generated/prisma/client.js';
import type { InvoiceOrder } from './ecpay-invoice.js';

export interface IssuedInvoice {
  invoiceNo: string;
  invoiceDate: Date;
  randomNumber: string;
  raw: Prisma.InputJsonValue;
}

export interface FoundInvoice extends IssuedInvoice {
  voided: boolean;
}

export interface ReversalTarget {
  invoiceNo: string;
  invoiceDate: Date;
  order: InvoiceOrder;
}

/** 電子發票加值中心介面：新增加值中心（例如藍新、ezPay）只要實作這個介面 */
export interface InvoiceProvider {
  readonly provider: IntegrationProvider;
  issue(order: InvoiceOrder): Promise<IssuedInvoice>;
  /** 以訂單編號（RelateNumber）查詢是否已開立，重試前用來避免重複開立 */
  find(relateNumber: string): Promise<FoundInvoice | null>;
  void(target: ReversalTarget, reason: string): Promise<Prisma.InputJsonValue>;
  allowance(target: ReversalTarget): Promise<{ allowanceNo: string; raw: Prisma.InputJsonValue }>;
}
