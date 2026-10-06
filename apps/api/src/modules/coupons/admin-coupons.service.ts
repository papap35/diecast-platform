import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from '../../common/errors/app-exception.js';
import { pageMeta, skipTake } from '../../common/http/pagination.dto.js';
import { assertDateRange } from '../../common/validation/date-range.js';
import type { Coupon, CouponType, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type {
  AdminCouponDetailDto,
  AdminCouponDto,
  AdminCouponListDto,
  AdminCouponQueryDto,
  CouponState,
  CreateCouponDto,
  UpdateCouponDto,
} from './dto/coupon.dto.js';

export function couponState(coupon: Coupon, now = new Date()): CouponState {
  if (!coupon.isActive) return 'DISABLED';
  if (coupon.endsAt && coupon.endsAt <= now) return 'EXPIRED';
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return 'USED_UP';
  if (coupon.startsAt && coupon.startsAt > now) return 'SCHEDULED';
  return 'ACTIVE';
}

function toDto(coupon: Coupon, totalDiscount: number, now: Date): AdminCouponDto {
  return {
    id: coupon.id,
    code: coupon.code,
    name: coupon.name,
    type: coupon.type,
    value: coupon.value,
    minSubtotal: coupon.minSubtotal,
    maxDiscount: coupon.maxDiscount,
    minTier: coupon.minTier,
    appliesToLimited: coupon.appliesToLimited,
    usageLimit: coupon.usageLimit,
    perMemberLimit: coupon.perMemberLimit,
    usedCount: coupon.usedCount,
    startsAt: coupon.startsAt,
    endsAt: coupon.endsAt,
    isActive: coupon.isActive,
    state: couponState(coupon, now),
    totalDiscount,
    createdAt: coupon.createdAt,
    updatedAt: coupon.updatedAt,
  };
}

/** 各類型的面額規則：百分比 1–90、固定金額至少 1 元、免運券不需要面額 */
function normalizeValue(type: CouponType, value: number): number {
  if (type === 'FREE_SHIPPING') return 0;
  const valid = type === 'PERCENT' ? value >= 1 && value <= 90 : value >= 1;
  if (!valid) {
    throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, '折扣面額不正確', [
      {
        field: 'value',
        messages: [type === 'PERCENT' ? '百分比折扣需介於 1～90' : '折抵金額至少 1 元'],
      },
    ]);
  }
  return value;
}

@Injectable()
export class AdminCouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminCouponQueryDto): Promise<AdminCouponListDto> {
    const now = new Date();
    const q = query.q?.trim();
    const where: Prisma.CouponWhereInput = {
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.state ? this.stateWhere(query.state, now) : {}),
    };
    const [total, coupons] = await this.prisma.$transaction([
      this.prisma.coupon.count({ where }),
      this.prisma.coupon.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...skipTake(query),
      }),
    ]);
    const sums = await this.discountSums(coupons.map((coupon) => coupon.id));
    return {
      data: coupons.map((coupon) => toDto(coupon, sums.get(coupon.id) ?? 0, now)),
      meta: pageMeta(query.page, query.pageSize, total),
    };
  }

  async get(id: string): Promise<AdminCouponDetailDto> {
    const coupon = await this.findOrThrow(id);
    const [sums, redemptions] = await Promise.all([
      this.discountSums([id]),
      this.prisma.couponRedemption.findMany({
        where: { couponId: id },
        include: {
          order: { select: { orderNo: true } },
          member: { select: { email: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
      }),
    ]);
    return {
      ...toDto(coupon, sums.get(id) ?? 0, new Date()),
      redemptions: redemptions.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        orderNo: r.order.orderNo,
        memberId: r.memberId,
        memberEmail: r.member.email,
        amount: r.amount,
        createdAt: r.createdAt,
        releasedAt: r.releasedAt,
      })),
    };
  }

  async create(dto: CreateCouponDto): Promise<AdminCouponDetailDto> {
    assertDateRange(dto.startsAt, dto.endsAt);
    if (await this.prisma.coupon.findUnique({ where: { code: dto.code } })) {
      throw AppException.conflict(ErrorCode.COUPON_CODE_TAKEN, '優惠碼已存在');
    }
    const coupon = await this.prisma.coupon.create({
      data: {
        code: dto.code,
        name: dto.name.trim(),
        type: dto.type,
        value: normalizeValue(dto.type, dto.value),
        minSubtotal: dto.minSubtotal ?? 0,
        maxDiscount: dto.type === 'PERCENT' ? (dto.maxDiscount ?? null) : null,
        minTier: dto.minTier ?? null,
        appliesToLimited: dto.appliesToLimited ?? false,
        usageLimit: dto.usageLimit ?? null,
        perMemberLimit: dto.perMemberLimit ?? 1,
        startsAt: dto.startsAt ?? null,
        endsAt: dto.endsAt ?? null,
        isActive: dto.isActive ?? true,
      },
    });
    return this.get(coupon.id);
  }

  /** 優惠碼與類型不能改；總量上限不能低於已使用次數 */
  async update(id: string, dto: UpdateCouponDto): Promise<AdminCouponDetailDto> {
    const existing = await this.findOrThrow(id);
    assertDateRange(
      dto.startsAt === undefined ? existing.startsAt : dto.startsAt,
      dto.endsAt === undefined ? existing.endsAt : dto.endsAt,
    );
    if (dto.usageLimit != null && dto.usageLimit < existing.usedCount) {
      throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, '總使用次數不能低於已使用次數', [
        { field: 'usageLimit', messages: [`已使用 ${existing.usedCount} 次`] },
      ]);
    }
    await this.prisma.coupon.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        value: dto.value === undefined ? undefined : normalizeValue(existing.type, dto.value),
        minSubtotal: dto.minSubtotal,
        maxDiscount: existing.type === 'PERCENT' ? dto.maxDiscount : undefined,
        minTier: dto.minTier,
        appliesToLimited: dto.appliesToLimited,
        usageLimit: dto.usageLimit,
        perMemberLimit: dto.perMemberLimit,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        isActive: dto.isActive,
      },
    });
    return this.get(id);
  }

  /** 沒有人用過的才能刪除；用過的請改為停用，保留使用紀錄 */
  async remove(id: string): Promise<void> {
    await this.findOrThrow(id);
    if (await this.prisma.couponRedemption.count({ where: { couponId: id } })) {
      throw AppException.conflict(
        ErrorCode.COUPON_IN_USE,
        '已有使用紀錄的優惠券不能刪除，請改為停用',
      );
    }
    await this.prisma.coupon.delete({ where: { id } });
  }

  private stateWhere(state: CouponState, now: Date): Prisma.CouponWhereInput {
    const notExpired = { OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
    const notUsedUp = {
      OR: [{ usageLimit: null }, { usedCount: { lt: this.prisma.coupon.fields.usageLimit } }],
    };
    switch (state) {
      case 'DISABLED':
        return { isActive: false };
      case 'EXPIRED':
        return { isActive: true, endsAt: { lte: now } };
      case 'USED_UP':
        return {
          isActive: true,
          AND: [notExpired, { usedCount: { gte: this.prisma.coupon.fields.usageLimit } }],
        };
      case 'SCHEDULED':
        return { isActive: true, startsAt: { gt: now }, AND: [notExpired, notUsedUp] };
      case 'ACTIVE':
        return {
          isActive: true,
          AND: [notExpired, notUsedUp, { OR: [{ startsAt: null }, { startsAt: { lte: now } }] }],
        };
    }
  }

  private async discountSums(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.couponRedemption.groupBy({
      by: ['couponId'],
      where: { couponId: { in: ids }, releasedAt: null },
      _sum: { amount: true },
    });
    return new Map(rows.map((row) => [row.couponId, row._sum.amount ?? 0]));
  }

  private async findOrThrow(id: string): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw AppException.notFound(ErrorCode.NOT_FOUND, '找不到這張優惠券');
    return coupon;
  }
}
