'use client';

import type { Schemas } from '@paddock64/api-client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useActionState, useTransition } from 'react';
import {
  deleteBrandAction,
  deleteCategoryAction,
  type ProductFormState,
  saveBrandAction,
  saveCategoryAction,
} from '@/app/actions/catalog';
import { Button } from './ui/button';
import { Checkbox, Field, Input, Select, Textarea } from './ui/field';

type Brand = Schemas['AdminBrandDto'];
type Category = Schemas['AdminCategoryDto'];

function Feedback({ state }: { state: ProductFormState }) {
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
        {te.has(state.error.code) ? te(state.error.code) : state.error.message}
      </p>
    );
  }
  return state.saved ? (
    <p className="rounded-lg bg-ok-soft px-3 py-2 text-xs text-ok">{tc('saved')}</p>
  ) : null;
}

export function BrandForm({ brand, canWrite }: { brand?: Brand; canWrite: boolean }) {
  const t = useTranslations('brands');
  const tc = useTranslations('common');
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveBrandAction, {});
  const [deleting, startDelete] = useTransition();
  const fields = state.error?.fields ?? {};

  return (
    <form action={formAction} key={brand?.id ?? 'new'} className="card flex flex-col gap-4 p-5">
      <h2 className="text-sm font-semibold">{brand ? `${tc('edit')}：${brand.name}` : t('new')}</h2>
      <fieldset disabled={!canWrite || pending} className="contents">
        {brand ? <input type="hidden" name="id" value={brand.id} /> : null}
        <Feedback state={state} />
        <Field label={t('name')} name="name" error={fields.name}>
          <Input id="name" name="name" required defaultValue={brand?.name} />
        </Field>
        <Field label={t('slug')} name="slug" error={fields.slug}>
          <Input id="slug" name="slug" required defaultValue={brand?.slug} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('country')} name="country" hint={t('countryHint')} error={fields.country}>
            <Input id="country" name="country" maxLength={2} defaultValue={brand?.country ?? ''} />
          </Field>
          <Field label={t('sortOrder')} name="sortOrder">
            <Input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={brand?.sortOrder ?? 0}
            />
          </Field>
        </div>
        <Field label={t('logoUrl')} name="logoUrl">
          <Input id="logoUrl" name="logoUrl" defaultValue={brand?.logoUrl ?? ''} />
        </Field>
        <Field label={t('description')} name="description">
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={
              brand?.translations.find((tr) => tr.locale === 'zh-TW')?.description ?? ''
            }
          />
        </Field>
        <Checkbox name="isActive" defaultChecked={brand?.isActive ?? true} label={t('active')} />
        {canWrite ? (
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? tc('saving') : tc('save')}
            </Button>
            {brand && brand.productCount === 0 ? (
              <Button
                type="button"
                variant="danger"
                disabled={deleting}
                onClick={() => {
                  if (!window.confirm(t('deleteConfirm'))) return;
                  startDelete(async () => {
                    const result = await deleteBrandAction(brand.id);
                    if (result.ok) router.push('/brands');
                  });
                }}
              >
                {tc('delete')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}

const LOCALES = ['zh-TW', 'en', 'zh-CN'] as const;

export function CategoryForm({
  category,
  roots,
  canWrite,
}: {
  category?: Category;
  roots: Category[];
  canWrite: boolean;
}) {
  const t = useTranslations('categories');
  const tc = useTranslations('common');
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveCategoryAction, {});
  const [deleting, startDelete] = useTransition();
  const fields = state.error?.fields ?? {};
  const name = (locale: string) =>
    category?.translations.find((tr) => tr.locale === locale)?.name ?? '';

  return (
    <form action={formAction} key={category?.id ?? 'new'} className="card flex flex-col gap-4 p-5">
      <h2 className="text-sm font-semibold">
        {category ? `${tc('edit')}：${name('zh-TW')}` : t('new')}
      </h2>
      <fieldset disabled={!canWrite || pending} className="contents">
        {category ? <input type="hidden" name="id" value={category.id} /> : null}
        <Feedback state={state} />
        {LOCALES.map((locale) => (
          <Field
            key={locale}
            label={`${t('name')}（${locale}）`}
            name={`name.${locale}`}
            error={locale === 'zh-TW' ? fields.translations : undefined}
          >
            <Input
              id={`name.${locale}`}
              name={`name.${locale}`}
              required={locale === 'zh-TW'}
              defaultValue={name(locale)}
            />
          </Field>
        ))}
        <Field label={t('slug')} name="slug" error={fields.slug}>
          <Input id="slug" name="slug" required defaultValue={category?.slug} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('parent')} name="parentId">
            <Select id="parentId" name="parentId" defaultValue={category?.parentId ?? ''}>
              <option value="">{t('root')}</option>
              {roots
                .filter((root) => root.id !== category?.id)
                .map((root) => (
                  <option key={root.id} value={root.id}>
                    {root.translations.find((tr) => tr.locale === 'zh-TW')?.name ?? root.slug}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label={t('sortOrder')} name="sortOrder">
            <Input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={category?.sortOrder ?? 0}
            />
          </Field>
        </div>
        <Checkbox name="isActive" defaultChecked={category?.isActive ?? true} label={t('active')} />
        {canWrite ? (
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? tc('saving') : tc('save')}
            </Button>
            {category && category.productCount === 0 ? (
              <Button
                type="button"
                variant="danger"
                disabled={deleting}
                onClick={() => {
                  if (!window.confirm(t('deleteConfirm'))) return;
                  startDelete(async () => {
                    const result = await deleteCategoryAction(category.id);
                    if (result.ok) router.push('/categories');
                  });
                }}
              >
                {tc('delete')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}
