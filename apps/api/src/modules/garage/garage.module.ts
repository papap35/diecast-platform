import { Module } from '@nestjs/common';
import { GarageController, PublicGarageController } from './garage.controller.js';
import { GarageService } from './garage.service.js';

@Module({
  controllers: [GarageController, PublicGarageController],
  providers: [GarageService],
})
export class GarageModule {}
