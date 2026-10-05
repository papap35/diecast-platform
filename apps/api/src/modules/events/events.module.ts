import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [CatalogModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
