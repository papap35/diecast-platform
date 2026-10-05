import type { OrderStatus, ShippingMethod } from '../../generated/prisma/client.js';

export interface ShippingRate {
  fee: number;
  /** 訂單小計達此金額免運 */
  freeThreshold: number;
}

/** 運費表：宅配 120 元滿 1,500 免運；超商取貨 60 元滿 1,000 免運 */
export const SHIPPING_RATES: Record<ShippingMethod, ShippingRate> = {
  HOME_DELIVERY: { fee: 120, freeThreshold: 1500 },
  CVS_711: { fee: 60, freeThreshold: 1000 },
  CVS_FAMILY: { fee: 60, freeThreshold: 1000 },
  CVS_HILIFE: { fee: 60, freeThreshold: 1000 },
  CVS_OKMART: { fee: 60, freeThreshold: 1000 },
};

export function calculateShippingFee(method: ShippingMethod, subtotal: number): number {
  const rate = SHIPPING_RATES[method];
  return subtotal >= rate.freeThreshold ? 0 : rate.fee;
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
