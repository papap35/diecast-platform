import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import {
  AdminDashboardController,
  AdminMembersController,
  AdminOrdersController,
} from './admin-sales.controller.js';
import { AdminSalesService } from './admin-sales.service.js';

@Module({
  imports: [OrdersModule],
  controllers: [AdminDashboardController, AdminOrdersController, AdminMembersController],
  providers: [AdminSalesService],
})
export class AdminModule {}
