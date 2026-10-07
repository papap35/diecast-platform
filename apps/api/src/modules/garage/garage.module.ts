import { Module } from '@nestjs/common';
import {
  AdminGarageController,
  GarageController,
  PublicGarageController,
} from './garage.controller.js';
import { GarageService } from './garage.service.js';

@Module({
  controllers: [GarageController, PublicGarageController, AdminGarageController],
  providers: [GarageService],
})
export class GarageModule {}
