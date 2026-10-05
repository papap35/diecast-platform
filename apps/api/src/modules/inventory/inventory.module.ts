import { Global, Module } from '@nestjs/common';
import { DropGateService } from './drop-gate.service.js';
import { InventoryService } from './inventory.service.js';

@Global()
@Module({
  providers: [InventoryService, DropGateService],
  exports: [InventoryService, DropGateService],
})
export class InventoryModule {}
