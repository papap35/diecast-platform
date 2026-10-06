import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_CONFIG, type AppConfig, ConfigModule } from './config/config.module.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { RedisModule } from './infra/redis/redis.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { ContentModule } from './modules/content/content.module.js';
import { CouponsModule } from './modules/coupons/coupons.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { GarageModule } from './modules/garage/garage.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { InvoicesModule } from './modules/invoices/invoices.module.js';
import { LogisticsModule } from './modules/logistics/logistics.module.js';
import { MarketingModule } from './modules/marketing/marketing.module.js';
import { MembersModule } from './modules/members/members.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { RemindersModule } from './modules/reminders/reminders.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { SystemModule } from './modules/system/system.module.js';
import { WishlistModule } from './modules/wishlist/wishlist.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ ttl: 60_000, limit: config.RATE_LIMIT_PER_MINUTE }],
        skipIf: () => config.NODE_ENV === 'test',
      }),
    }),
    AuthModule,
    InventoryModule,
    MembersModule,
    CatalogModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    LogisticsModule,
    InvoicesModule,
    NotificationsModule,
    WishlistModule,
    RemindersModule,
    GarageModule,
    EventsModule,
    ContentModule,
    CouponsModule,
    MarketingModule,
    AdminModule,
    ReportsModule,
    HealthModule,
    // 放最後：OpenAPI 文件依模組順序排列，系統管理排在其他後台 API 之後
    SystemModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
