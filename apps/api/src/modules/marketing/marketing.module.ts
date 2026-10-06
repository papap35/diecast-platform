import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service.js';
import { AdminCampaignsController, UnsubscribeController } from './marketing.controller.js';

/** 電子報與退訂 */
@Module({
  controllers: [UnsubscribeController, AdminCampaignsController],
  providers: [CampaignsService],
})
export class MarketingModule {}
