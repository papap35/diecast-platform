'use server';

import type { Schemas } from '@paddock64/api-client';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  type ActionError,
  type ActionResult,
  toActionError,
  UNAUTHORIZED,
} from '@/lib/action-result';
import { actionApi } from '@/lib/api';
import { fromTaipeiInput } from '@/lib/format';
import { ensureAccessToken } from '@/lib/session';

type CreateProduct = Schemas['CreateProductDto'];

export interface ProductFormState {
  error?: ActionError;
  saved?: boolean;
}

const LOCALES = ['zh-TW', 'en', 'zh-CN'] as const;
const SPEC_KEYS = ['material', 'wheels', 'packaging', 'edition', 'features'] as const;

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
};
const optionalInt = (formData: FormData, key: string) => {
  const value = text(formData, key);
  return value === '' ? null : Number(value);
};

/** 把商品表單轉成 API 需要的格式：空白的語系不送出（前台會回退到繁中） */
function productBody(formData: FormData): Omit<CreateProduct, 'stock'> {
  const translations = LOCALES.flatMap((locale) => {
    const name = text(formData, `name.${locale}`);
    const description = text(formData, `description.${locale}`);
    if (locale !== 'zh-TW' && !name) return [];
    return [{ locale, name, subtitle: text(formData, `subtitle.${locale}`) || null, description }];
  });
  const specs = Object.fromEntries(
    SPEC_KEYS.flatMap((key) => {
      const value = text(formData, `spec.${key}`);
      return value ? [[key, value]] : [];
    }),
  );
  const images = formData
    .getAll('image.url')
    .map((url, index) => ({
      url: String(url).trim(),
      alt: String(formData.getAll('image.alt')[index] ?? '').trim() || null,
    }))
    .filter((image) => image.url);

  return {
    slug: text(formData, 'slug'),
    sku: text(formData, 'sku'),
    brandId: text(formData, 'brandId'),
    categoryId: text(formData, 'categoryId'),
    scale: text(formData, 'scale'),
    price: Number(text(formData, 'price')),
    compareAtPrice: optionalInt(formData, 'compareAtPrice'),
    status: text(formData, 'status') as CreateProduct['status'],
    saleType: text(formData, 'saleType') as CreateProduct['saleType'],
    releaseAt: fromTaipeiInput(text(formData, 'releaseAt')),
    preorderClosesAt: fromTaipeiInput(text(formData, 'preorderClosesAt')),
    expectedShipAt: fromTaipeiInput(text(formData, 'expectedShipAt')),
    earlyAccessTier: (text(formData, 'earlyAccessTier') ||
      null) as CreateProduct['earlyAccessTier'],
    earlyAccessAt: fromTaipeiInput(text(formData, 'earlyAccessAt')),
    purchaseLimit: optionalInt(formData, 'purchaseLimit'),
    isFeatured: formData.get('isFeatured') === 'on',
    specs,
    translations,
    images,
  };
}

export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  if (!(await ensureAccessToken())) return { error: UNAUTHORIZED };
  const api = await actionApi();
  const { data, error, response } = await api.POST('/v1/admin/products', {
    body: { ...productBody(formData), stock: Number(text(formData, 'stock') || 0) },
  });
  if (!response.ok || !data) return { error: toActionError(error, response.status) };
  redirect(`/products/${data.id}?created=1`);
}

export async function updateProductAction(
  id: string,
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  if (!(await ensureAccessToken())) return { error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.PATCH('/v1/admin/products/{id}', {
    params: { path: { id } },
    body: productBody(formData),
  });
  if (!response.ok) return { error: toActionError(error, response.status) };
  refresh();
  return { saved: true };
}

export async function archiveProductAction(id: string): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.DELETE('/v1/admin/products/{id}', {
    params: { path: { id } },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}

export async function adjustStockAction(
  id: string,
  delta: number,
  note: string,
): Promise<ActionResult<number>> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { data, error, response } = await api.POST('/v1/admin/products/{id}/stock', {
    params: { path: { id } },
    body: { delta, ...(note ? { note } : {}) },
  });
  if (!response.ok || !data) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: data.stock };
}

// ── 品牌與分類 ──

export async function saveBrandAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  if (!(await ensureAccessToken())) return { error: UNAUTHORIZED };
  const id = text(formData, 'id');
  const description = text(formData, 'description');
  const body = {
    slug: text(formData, 'slug'),
    name: text(formData, 'name'),
    country: text(formData, 'country').toUpperCase() || null,
    logoUrl: text(formData, 'logoUrl') || null,
    sortOrder: Number(text(formData, 'sortOrder') || 0),
    isActive: formData.get('isActive') === 'on',
    translations: description ? [{ locale: 'zh-TW' as const, description }] : [],
  };
  const api = await actionApi();
  const result = id
    ? await api.PATCH('/v1/admin/brands/{id}', { params: { path: { id } }, body })
    : await api.POST('/v1/admin/brands', { body });
  if (!result.response.ok) return { error: toActionError(result.error, result.response.status) };
  refresh();
  return { saved: true };
}

export async function deleteBrandAction(id: string): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.DELETE('/v1/admin/brands/{id}', {
    params: { path: { id } },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}

export async function saveCategoryAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  if (!(await ensureAccessToken())) return { error: UNAUTHORIZED };
  const id = text(formData, 'id');
  const translations = LOCALES.flatMap((locale) => {
    const name = text(formData, `name.${locale}`);
    return name ? [{ locale, name }] : [];
  });
  const body = {
    slug: text(formData, 'slug'),
    parentId: text(formData, 'parentId') || null,
    sortOrder: Number(text(formData, 'sortOrder') || 0),
    isActive: formData.get('isActive') === 'on',
    translations,
  };
  const api = await actionApi();
  const result = id
    ? await api.PATCH('/v1/admin/categories/{id}', { params: { path: { id } }, body })
    : await api.POST('/v1/admin/categories', { body });
  if (!result.response.ok) return { error: toActionError(result.error, result.response.status) };
  refresh();
  return { saved: true };
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  if (!(await ensureAccessToken())) return { ok: false, error: UNAUTHORIZED };
  const api = await actionApi();
  const { error, response } = await api.DELETE('/v1/admin/categories/{id}', {
    params: { path: { id } },
  });
  if (!response.ok) return { ok: false, error: toActionError(error, response.status) };
  refresh();
  return { ok: true, data: undefined };
}
