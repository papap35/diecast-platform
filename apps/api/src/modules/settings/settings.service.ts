import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import type { StoreSettings } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { ShippingRates } from '../orders/order-rules.js';
import type { StoreSettingsDto, UpdateStoreSettingsDto } from './dto/settings.dto.js';

/**
 * 每個 API 執行個體各自快取。後台修改後本機立即生效，
 * 其他執行個體最晚 15 秒後套用（實際金額一律以下單當下讀到的設定計算）。
 */
const CACHE_TTL_MS = 15_000;

@Injectable()
export class SettingsService {
  private cache: { value: StoreSettings; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<StoreSettings> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.value;
    // 遷移時已寫入預設值；資料表被清空（例如測試）時以預設值補回
    const value = await this.prisma.storeSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });
    this.cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  }

  async shippingRates(): Promise<ShippingRates> {
    return toShippingRates(await this.get());
  }

  async update(dto: UpdateStoreSettingsDto): Promise<StoreSettingsDto> {
    if (dto.limitedPaymentTimeoutMinutes > dto.paymentTimeoutMinutes) {
      const message = '限量商品的付款期限不可長於一般訂單';
      throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, message, [
        { field: 'limitedPaymentTimeoutMinutes', messages: [message] },
      ]);
    }
    const data = {
      homeDeliveryFee: dto.homeDeliveryFee,
      homeFreeShippingThreshold: dto.homeFreeShippingThreshold,
      cvsFee: dto.cvsFee,
      cvsFreeShippingThreshold: dto.cvsFreeShippingThreshold,
      paymentTimeoutMinutes: dto.paymentTimeoutMinutes,
      limitedPaymentTimeoutMinutes: dto.limitedPaymentTimeoutMinutes,
    };
    const value = await this.prisma.storeSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
    this.cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return toDto(value);
  }

  async getDto(): Promise<StoreSettingsDto> {
    return toDto(await this.get());
  }
}

export function toShippingRates(settings: StoreSettings): ShippingRates {
  return {
    home: { fee: settings.homeDeliveryFee, freeThreshold: settings.homeFreeShippingThreshold },
    cvs: { fee: settings.cvsFee, freeThreshold: settings.cvsFreeShippingThreshold },
  };
}

function toDto(settings: StoreSettings): StoreSettingsDto {
  return {
    homeDeliveryFee: settings.homeDeliveryFee,
    homeFreeShippingThreshold: settings.homeFreeShippingThreshold,
    cvsFee: settings.cvsFee,
    cvsFreeShippingThreshold: settings.cvsFreeShippingThreshold,
    paymentTimeoutMinutes: settings.paymentTimeoutMinutes,
    limitedPaymentTimeoutMinutes: settings.limitedPaymentTimeoutMinutes,
    updatedAt: settings.updatedAt,
  };
}
