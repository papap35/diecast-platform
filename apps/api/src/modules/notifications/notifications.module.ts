import { Module } from '@nestjs/common';
import { EmailOutboxService } from './email-outbox.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailOutboxService],
  exports: [NotificationsService, EmailOutboxService],
})
export class NotificationsModule {}
