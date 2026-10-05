import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import {
  EcpayCallbackController,
  MockPaymentController,
  PaymentsController,
} from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { EcpayGateway } from './providers/ecpay.gateway.js';
import { MockGateway } from './providers/mock.gateway.js';

@Module({
  imports: [OrdersModule],
  controllers: [PaymentsController, EcpayCallbackController, MockPaymentController],
  providers: [PaymentsService, MockGateway, EcpayGateway],
})
export class PaymentsModule {}
