import type { MemberTier, OrderStatus, ShippingMethod } from '../../generated/prisma/client.js';

export interface ShippingRate {
  fee: number;
  /** 訂單小計達此金額免運（0 表示一律免運） */
  freeThreshold: number;
}

/** 運費設定：宅配一組、各家超商共用一組（後台「系統設定」可調整，見 SettingsService） */
export interface ShippingRates {
  home: ShippingRate;
  cvs: ShippingRate;
}

export function shippingRate(method: ShippingMethod, rates: ShippingRates): ShippingRate {
  return method === 'HOME_DELIVERY' ? rates.home : rates.cvs;
}

/** 會員等級的免運優惠：冠軍車手門檻打六折，傳奇車手全站免運 */
export function freeShippingThreshold(
  method: ShippingMethod,
  tier: MemberTier,
  rates: ShippingRates,
): number {
  if (tier === 'LEGEND') return 0;
  const base = shippingRate(method, rates).freeThreshold;
  return tier === 'CHAMPION' ? Math.round(base * 0.6) : base;
}

export function calculateShippingFee(
  method: ShippingMethod,
  subtotal: number,
  tier: MemberTier,
  rates: ShippingRates,
): number {
  return subtotal >= freeShippingThreshold(method, tier, rates)
    ? 0
    : shippingRate(method, rates).fee;
}

export function isConvenienceStore(method: ShippingMethod): boolean {
  return method !== 'HOME_DELIVERY';
}

/**
 * 訂單狀態機。任何狀態變更都必須通過這張表，
 * 避免後台誤操作（例如把已出貨的訂單改回待付款）。
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'REFUNDED'],
  // 包裹逾期未取被退回時退款
  SHIPPED: ['COMPLETED', 'REFUNDED'],
  // 七天鑑賞期內退貨
  COMPLETED: ['REFUNDED'],
  // 已取消的訂單若收到延遲付款，退款後標記為已退款
  CANCELLED: ['REFUNDED'],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from];
}

/**
 * 會釋放庫存的狀態變更：未付款取消、出貨完成前退款（含包裹退回）。
 * 已取消的訂單庫存早已釋放；已完成訂單的退貨要先驗貨，由後台手動調整庫存。
 */
export function releasesStock(from: OrderStatus, to: OrderStatus): boolean {
  return (
    (from === 'PENDING_PAYMENT' && to === 'CANCELLED') ||
    (to === 'REFUNDED' && from !== 'CANCELLED' && from !== 'COMPLETED')
  );
}

/** 計入會員累計消費的狀態 */
export const SPENT_STATUSES: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'];
