import { Module } from '@nestjs/common';
import { AdminEmailsController } from './admin-emails.controller.js';
import { AdminEmailsService } from './admin-emails.service.js';
import { EmailOutboxService } from './email-outbox.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  controllers: [NotificationsController, AdminEmailsController],
  providers: [NotificationsService, EmailOutboxService, AdminEmailsService],
  exports: [NotificationsService, EmailOutboxService],
})
export class NotificationsModule {}
