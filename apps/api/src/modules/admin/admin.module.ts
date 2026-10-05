import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module.js';
import { LogisticsModule } from '../logistics/logistics.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import {
  AdminDashboardController,
  AdminMembersController,
  AdminOrdersController,
} from './admin-sales.controller.js';
import { AdminSalesService } from './admin-sales.service.js';

@Module({
  imports: [OrdersModule, LogisticsModule, InvoicesModule],
  controllers: [AdminDashboardController, AdminOrdersController, AdminMembersController],
  providers: [AdminSalesService],
})
export class AdminModule {}
