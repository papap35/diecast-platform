'use server';

import type { Schemas } from '@paddock64/api-client';
import { refresh } from 'next/cache';
import { type ActionResult, toActionError, UNAUTHORIZED } from '@/lib/action-result';
import { actionApi } from '@/lib/api';
import { ensureAccessToken } from '@/lib/session';

type OrderStatus = Schemas['UpdateOrderStatusDto']['status'];

export async function updateOrderStatusAction(
  id: string,
  status: OrderStatus,
  note: string,
): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.POST('/v1/admin/orders/{id}/status', {
    params: { path: { id } },
    body: { status, ...(note ? { note } : {}) },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}

export async function addOrderNoteAction(id: string, message: string): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.POST('/v1/admin/orders/{id}/notes', {
    params: { path: { id } },
    body: { message },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}

export async function updateMemberStatusAction(
  id: string,
  status: 'ACTIVE' | 'SUSPENDED',
): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.PATCH('/v1/admin/members/{id}/status', {
    params: { path: { id } },
    body: { status },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}

type SimulatedStatus = Schemas['SimulateShipmentDto']['status'];

export async function createShipmentAction(id: string): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.POST('/v1/admin/orders/{id}/shipment', {
    params: { path: { id } },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}

export async function simulateShipmentAction(
  id: string,
  status: SimulatedStatus,
): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.POST('/v1/admin/orders/{id}/shipment/simulate', {
    params: { path: { id } },
    body: { status },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}

export async function retryInvoiceAction(id: string): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.POST('/v1/admin/orders/{id}/invoice/retry', {
    params: { path: { id } },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}

/** 把會員的公開車庫設為不公開 */
export async function hideGarageAction(memberId: string): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.POST('/v1/admin/members/{id}/garage/hide', {
    params: { path: { id: memberId } },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}
