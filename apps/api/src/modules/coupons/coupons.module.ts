import { Module } from '@nestjs/common';
import { AdminCouponsService } from './admin-coupons.service.js';
import { AdminCouponsController, CouponsController } from './coupons.controller.js';
import { CouponsService } from './coupons.service.js';

@Module({
  controllers: [CouponsController, AdminCouponsController],
  providers: [CouponsService, AdminCouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
