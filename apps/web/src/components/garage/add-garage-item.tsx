'use client';

import type { Schemas } from '@paddock64/api-client';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState, useTransition } from 'react';
import { addGarageItemAction } from '@/app/actions/collector';
import type { AppLocale } from '@/i18n/routing';
import { Button } from '../ui/button';
import { Field, Input, Select } from '../ui/field';
import { CONDITIONS } from './garage-item-card';

const SCALES = ['1:64', '1:43', '1:24', '1:18', '1:12'];

/** 登錄其他來源（例如展場、二手）的車款 */
export function AddGarageItem() {
  const t = useTranslations('garage');
  const te = useTranslations('errors');
  const locale = useLocale() as AppLocale;
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (form: FormData) =>
    startTransition(async () => {
      setError(null);
      const price = String(form.get('pricePaid') ?? '').trim();
      const acquired = String(form.get('acquiredAt') ?? '');
      const input: Schemas['CreateGarageItemDto'] = {
        name: String(form.get('name') ?? '').trim(),
        brandName: String(form.get('brandName') ?? '').trim() || undefined,
        scale: String(form.get('scale') ?? '') || undefined,
        condition: form.get('condition') as Schemas['GarageCondition'],
        quantity: Number(form.get('quantity')) || 1,
        pricePaid: price ? Number(price) : undefined,
        acquiredAt: acquired ? new Date(`${acquired}T12:00:00+08:00`).toISOString() : undefined,
        note: String(form.get('note') ?? '').trim() || undefined,
        isFavorite: form.get('isFavorite') === 'on',
      };
      const result = await addGarageItemAction(input, locale);
      if (result.ok) {
        formRef.current?.reset();
        setOpen(false);
      } else {
        setError(te.has(result.error.code) ? te(result.error.code) : result.error.message);
      }
    });

  if (!open) {
    return <Button onClick={() => setOpen(true)}>{t('add')}</Button>;
  }
  return (
    <form
      ref={formRef}
      action={submit}
      className="grid gap-4 rounded-3xl bg-surface p-6 ring-1 ring-line sm:grid-cols-2"
    >
      <h2 className="text-base font-semibold sm:col-span-2">{t('addTitle')}</h2>
      <Field label={t('name')} name="garage-name" className="sm:col-span-2">
        <Input
          id="garage-name"
          name="name"
          required
          maxLength={100}
          placeholder={t('namePlaceholder')}
        />
      </Field>
      <Field label={t('brand')} name="garage-brand">
        <Input id="garage-brand" name="brandName" maxLength={60} />
      </Field>
      <Field label={t('scale')} name="garage-scale">
        <Select id="garage-scale" name="scale" defaultValue="1:64">
          {SCALES.map((scale) => (
            <option key={scale} value={scale}>
              {scale}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('condition')} name="garage-condition">
        <Select id="garage-condition" name="condition" defaultValue="SEALED">
          {CONDITIONS.map((condition) => (
            <option key={condition} value={condition}>
              {t(`conditions.${condition}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('quantity')} name="garage-quantity">
        <Input
          id="garage-quantity"
          name="quantity"
          type="number"
          min={1}
          max={99}
          defaultValue={1}
        />
      </Field>
      <Field label={t('pricePaid')} name="garage-price" hint={t('privateHint')}>
        <Input id="garage-price" name="pricePaid" type="number" min={0} />
      </Field>
      <Field label={t('acquiredAt')} name="garage-acquired">
        <Input id="garage-acquired" name="acquiredAt" type="date" />
      </Field>
      <Field label={t('note')} name="garage-note" className="sm:col-span-2">
        <Input id="garage-note" name="note" maxLength={500} />
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="isFavorite" className="h-4 w-4 accent-ink" />
        {t('markFavorite')}
      </label>
      {error ? <p className="text-sm text-accent sm:col-span-2">{error}</p> : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t('save')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
