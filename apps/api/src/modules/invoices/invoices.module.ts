import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service.js';
import { EcpayInvoiceProvider } from './providers/ecpay-invoice.provider.js';
import { MockInvoiceProvider } from './providers/mock-invoice.js';

@Module({
  providers: [InvoicesService, MockInvoiceProvider, EcpayInvoiceProvider],
  exports: [InvoicesService],
})
export class InvoicesModule {}
