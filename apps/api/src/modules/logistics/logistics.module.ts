import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import {
  EcpayLogisticsCallbackController,
  LogisticsController,
  MockLogisticsController,
} from './logistics.controller.js';
import { LogisticsService } from './logistics.service.js';
import { EcpayLogistics } from './providers/ecpay-logistics.provider.js';
import { MockLogistics } from './providers/mock-logistics.js';

@Module({
  imports: [OrdersModule, NotificationsModule],
  controllers: [LogisticsController, EcpayLogisticsCallbackController, MockLogisticsController],
  providers: [LogisticsService, MockLogistics, EcpayLogistics],
  exports: [LogisticsService],
})
export class LogisticsModule {}
