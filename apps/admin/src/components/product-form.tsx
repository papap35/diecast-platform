'use client';

import type { Schemas } from '@paddock64/api-client';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { type ProductFormState } from '@/app/actions/catalog';
import { cn } from '@/lib/cn';
import { toTaipeiInput } from '@/lib/format';
import { PlusIcon } from './icons';
import { Button } from './ui/button';
import { Checkbox, Field, Input, Select, Textarea } from './ui/field';

type Product = Schemas['AdminProductDto'];
type Brand = Schemas['AdminBrandDto'];
type Category = Schemas['AdminCategoryDto'];

const LOCALES = [
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
] as const;
const SPEC_KEYS = ['material', 'wheels', 'packaging', 'edition', 'features'] as const;
const STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
const SALE_TYPES = ['REGULAR', 'PRE_ORDER', 'LIMITED'] as const;

export function ProductForm({
  action,
  product,
  brands,
  categories,
  canWrite,
}: {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  product?: Product;
  brands: Brand[];
  categories: Category[];
  canWrite: boolean;
}) {
  const t = useTranslations('products');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [state, formAction, pending] = useActionState(action, {});
  const [tab, setTab] = useState<(typeof LOCALES)[number]['code']>('zh-TW');
  const [images, setImages] = useState(
    product?.images.map((image) => ({
      key: image.id,
      url: image.path,
      preview: image.url,
      alt: image.alt ?? '',
    })) ?? [{ key: 'new-0', url: '', preview: '', alt: '' }],
  );
  const fields = state.error?.fields ?? {};
  const translation = (locale: string) => product?.translations.find((tr) => tr.locale === locale);
  const roots = categories.filter((category) => !category.parentId);
  const categoryName = (category: Category) =>
    category.translations.find((tr) => tr.locale === 'zh-TW')?.name ?? category.slug;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <fieldset disabled={!canWrite || pending} className="contents">
        {state.error ? (
          <p role="alert" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
            {te.has(state.error.code) ? te(state.error.code) : state.error.message}
            {state.error.fields ? ` (${Object.keys(state.error.fields).join(', ')})` : ''}
          </p>
        ) : null}
        {state.saved ? (
          <p role="status" className="rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">
            {tc('saved')}
          </p>
        ) : null}

        <Section title={t('sections.content')}>
          <div className="mb-4 flex gap-1 rounded-lg bg-canvas p-1">
            {LOCALES.map((locale) => (
              <button
                key={locale.code}
                type="button"
                onClick={() => setTab(locale.code)}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-sm font-semibold',
                  tab === locale.code ? 'bg-surface shadow-sm' : 'text-mute hover:text-ink',
                )}
              >
                {locale.label}
                {locale.code === 'zh-TW' ? <span className="ml-1 text-accent">*</span> : null}
              </button>
            ))}
          </div>
          {LOCALES.map((locale) => (
            <div
              key={locale.code}
              className={cn('grid gap-4', tab === locale.code ? '' : 'hidden')}
            >
              <Field
                label={t('translation.name')}
                name={`name.${locale.code}`}
                hint={
                  locale.code === 'zh-TW' ? t('translation.required') : t('translation.optional')
                }
                error={locale.code === 'zh-TW' ? fields.translations : undefined}
              >
                <Input
                  id={`name.${locale.code}`}
                  name={`name.${locale.code}`}
                  defaultValue={translation(locale.code)?.name ?? ''}
                />
              </Field>
              <Field label={t('translation.subtitle')} name={`subtitle.${locale.code}`}>
                <Input
                  id={`subtitle.${locale.code}`}
                  name={`subtitle.${locale.code}`}
                  defaultValue={translation(locale.code)?.subtitle ?? ''}
                />
              </Field>
              <Field label={t('translation.description')} name={`description.${locale.code}`}>
                <Textarea
                  id={`description.${locale.code}`}
                  name={`description.${locale.code}`}
                  rows={5}
                  defaultValue={translation(locale.code)?.description ?? ''}
                />
              </Field>
            </div>
          ))}
        </Section>

        <Section title={t('sections.basic')}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t('slug')} name="slug" error={fields.slug}>
              <Input
                id="slug"
                name="slug"
                required
                defaultValue={product?.slug}
                placeholder="formosa-taxi-95"
              />
            </Field>
            <Field label={t('sku')} name="sku" error={fields.sku}>
              <Input
                id="sku"
                name="sku"
                required
                defaultValue={product?.sku}
                placeholder="FD-64-001"
              />
            </Field>
            <Field label={t('scale')} name="scale" error={fields.scale}>
              <Input id="scale" name="scale" required defaultValue={product?.scale ?? '1:64'} />
            </Field>
            <Field label={t('brand')} name="brandId" error={fields.brandId}>
              <Select id="brandId" name="brandId" required defaultValue={product?.brandId ?? ''}>
                <option value="" disabled>
                  —
                </option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('category')} name="categoryId" error={fields.categoryId}>
              <Select
                id="categoryId"
                name="categoryId"
                required
                defaultValue={product?.categoryId ?? ''}
              >
                <option value="" disabled>
                  —
                </option>
                {roots.flatMap((root) => [
                  <option key={root.id} value={root.id}>
                    {categoryName(root)}
                  </option>,
                  ...categories
                    .filter((child) => child.parentId === root.id)
                    .map((child) => (
                      <option key={child.id} value={child.id}>
                        　└ {categoryName(child)}
                      </option>
                    )),
                ])}
              </Select>
            </Field>
            <Field label={tc('status')} name="status">
              <Select id="status" name="status" defaultValue={product?.status ?? 'DRAFT'}>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`statuses.${status}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Checkbox
              name="isFeatured"
              defaultChecked={product?.isFeatured}
              label={t('featured')}
            />
          </div>
        </Section>

        <Section title={t('sections.sale')}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('price')} name="price" error={fields.price}>
              <Input
                id="price"
                name="price"
                type="number"
                min={0}
                required
                defaultValue={product?.price}
              />
            </Field>
            <Field label={t('compareAtPrice')} name="compareAtPrice" error={fields.compareAtPrice}>
              <Input
                id="compareAtPrice"
                name="compareAtPrice"
                type="number"
                min={0}
                defaultValue={product?.compareAtPrice ?? ''}
              />
            </Field>
            <Field label={t('saleType')} name="saleType">
              <Select id="saleType" name="saleType" defaultValue={product?.saleType ?? 'REGULAR'}>
                {SALE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`saleTypes.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t('purchaseLimit')}
              name="purchaseLimit"
              hint={t('limitHint')}
              error={fields.purchaseLimit}
            >
              <Input
                id="purchaseLimit"
                name="purchaseLimit"
                type="number"
                min={1}
                defaultValue={product?.purchaseLimit ?? ''}
              />
            </Field>
            <Field
              label={t('releaseAt')}
              name="releaseAt"
              hint={t('timeHint')}
              error={fields.releaseAt}
            >
              <Input
                id="releaseAt"
                name="releaseAt"
                type="datetime-local"
                defaultValue={toTaipeiInput(product?.releaseAt)}
              />
            </Field>
            <Field
              label={t('preorderClosesAt')}
              name="preorderClosesAt"
              hint={t('timeHint')}
              error={fields.preorderClosesAt}
            >
              <Input
                id="preorderClosesAt"
                name="preorderClosesAt"
                type="datetime-local"
                defaultValue={toTaipeiInput(product?.preorderClosesAt)}
              />
            </Field>
            <Field label={t('expectedShipAt')} name="expectedShipAt" hint={t('timeHint')}>
              <Input
                id="expectedShipAt"
                name="expectedShipAt"
                type="datetime-local"
                defaultValue={toTaipeiInput(product?.expectedShipAt)}
              />
            </Field>
            {product ? null : (
              <Field label={t('initialStock')} name="stock" error={fields.stock}>
                <Input id="stock" name="stock" type="number" min={0} defaultValue={0} />
              </Field>
            )}
          </div>
        </Section>

        <Section title={t('sections.specs')}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SPEC_KEYS.map((key) => (
              <Field key={key} label={t(`specs.${key}`)} name={`spec.${key}`}>
                <Input
                  id={`spec.${key}`}
                  name={`spec.${key}`}
                  defaultValue={product?.specs[key] ?? ''}
                />
              </Field>
            ))}
          </div>
        </Section>

        <Section title={t('sections.media')}>
          <div className="flex flex-col gap-3">
            {images.map((image, index) => (
              <div
                key={image.key}
                className="grid items-end gap-3 sm:grid-cols-[6rem_1fr_14rem_auto]"
              >
                <div className="aspect-[4/3] overflow-hidden rounded-lg bg-canvas ring-1 ring-line">
                  {image.preview || image.url.startsWith('http') ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 任意來源的預覽圖，不經 next/image 最佳化
                    <img
                      src={image.preview || image.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <Field
                  label={`${t('imageUrl')} #${index + 1}`}
                  name={`image-url-${index}`}
                  hint={index === 0 ? t('imageHint') : undefined}
                >
                  <Input
                    id={`image-url-${index}`}
                    name="image.url"
                    value={image.url}
                    onChange={(e) =>
                      setImages((list) =>
                        list.map((item, i) =>
                          i === index ? { ...item, url: e.target.value, preview: '' } : item,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label={t('imageAlt')} name={`image-alt-${index}`}>
                  <Input
                    id={`image-alt-${index}`}
                    name="image.alt"
                    value={image.alt}
                    onChange={(e) =>
                      setImages((list) =>
                        list.map((item, i) =>
                          i === index ? { ...item, alt: e.target.value } : item,
                        ),
                      )
                    }
                  />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setImages((list) => list.filter((_, i) => i !== index))}
                >
                  {t('removeImage')}
                </Button>
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setImages((list) => [
                    ...list,
                    { key: `new-${Date.now()}`, url: '', preview: '', alt: '' },
                  ])
                }
              >
                <PlusIcon size={14} />
                {t('addImage')}
              </Button>
            </div>
          </div>
        </Section>

        {canWrite ? (
          <div className="sticky bottom-0 -mx-1 flex justify-end gap-3 border-t border-line bg-canvas/95 px-1 py-4 backdrop-blur">
            <Button type="submit" disabled={pending}>
              {pending ? tc('saving') : product ? tc('save') : tc('create')}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-mute">{tc('readOnly')}</p>
        )}
      </fieldset>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
