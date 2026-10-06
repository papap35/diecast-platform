'use client';

import type { Schemas } from '@paddock64/api-client';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { removeGarageItemAction, updateGarageItemAction } from '@/app/actions/collector';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/cn';
import { formatDate, formatPrice } from '@/lib/format';
import { StarIcon } from '../icons';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Field, Input, Select } from '../ui/field';
import { CarPlaceholder } from './car-placeholder';

type Item = Schemas['GarageItemDto'];
export const CONDITIONS: Schemas['GarageCondition'][] = [
  'SEALED',
  'OPENED',
  'DISPLAYED',
  'PLAYWORN',
];

/** 車庫中的一台車；editable 時可以標最愛、編輯狀態與購入資訊、移除 */
export function GarageItemCard({ item, editable = false }: { item: Item; editable?: boolean }) {
  const t = useTranslations('garage');
  const te = useTranslations('errors');
  const locale = useLocale() as AppLocale;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => ReturnType<typeof removeGarageItemAction>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (result.ok) after?.();
      else setError(te.has(result.error.code) ? te(result.error.code) : result.error.message);
    });

  const save = (form: FormData) => {
    const price = String(form.get('pricePaid') ?? '').trim();
    const acquired = String(form.get('acquiredAt') ?? '');
    run(
      () =>
        updateGarageItemAction(
          item.id,
          {
            condition: form.get('condition') as Schemas['GarageCondition'],
            quantity: Number(form.get('quantity')) || 1,
            pricePaid: price ? Number(price) : null,
            acquiredAt: acquired ? new Date(`${acquired}T12:00:00+08:00`).toISOString() : null,
            note: String(form.get('note') ?? ''),
          },
          locale,
        ),
      () => setEditing(false),
    );
  };

  const image = item.imageUrl ? (
    <Image
      src={item.imageUrl}
      alt=""
      fill
      unoptimized
      sizes="(min-width: 1024px) 25vw, 50vw"
      className="object-cover"
    />
  ) : (
    <CarPlaceholder className="h-full w-full" />
  );

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="relative aspect-[4/3] bg-paper">
        {item.productSlug ? (
          <Link href={`/products/${item.productSlug}`} aria-label={item.name}>
            {image}
          </Link>
        ) : (
          image
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Badge tone={item.source === 'ORDER' ? 'info' : 'neutral'}>
            {item.source === 'ORDER' ? t('sourceOrder') : t('sourceManual')}
          </Badge>
        </div>
        {editable ? (
          <button
            type="button"
            onClick={() =>
              run(() => updateGarageItemAction(item.id, { isFavorite: !item.isFavorite }, locale))
            }
            disabled={pending}
            aria-pressed={item.isFavorite}
            aria-label={t('favorite')}
            title={t('favorite')}
            className={cn(
              'absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 shadow-card',
              item.isFavorite ? 'text-gold' : 'text-ink-2 hover:text-gold',
            )}
          >
            <StarIcon size={18} filled={item.isFavorite} />
          </button>
        ) : item.isFavorite ? (
          <span className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-gold shadow-card">
            <StarIcon size={18} filled aria-label={t('favorite')} />
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="flex items-center justify-between gap-2 text-xs text-mute">
          <span className="truncate font-semibold tracking-wide uppercase">
            {item.brandName ?? '—'}
          </span>
          <span className="shrink-0">{item.scale}</span>
        </p>
        <h3 className="line-clamp-2 text-sm leading-5 font-semibold">{item.name}</h3>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Badge>{t(`conditions.${item.condition}`)}</Badge>
          {item.quantity > 1 ? <Badge tone="dark">×{item.quantity}</Badge> : null}
        </div>
        {editable && (item.pricePaid !== null || item.acquiredAt) ? (
          <p className="text-xs text-mute tabular">
            {[
              item.pricePaid !== null ? formatPrice(item.pricePaid) : null,
              item.acquiredAt ? formatDate(item.acquiredAt, locale) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}
        {item.note ? <p className="text-xs text-ink-2">{item.note}</p> : null}

        {editable && !editing ? (
          <div className="mt-auto flex gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
              disabled={pending}
            >
              {t('edit')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (window.confirm(t('removeConfirm'))) run(() => removeGarageItemAction(item.id));
              }}
            >
              {t('remove')}
            </Button>
          </div>
        ) : null}

        {editable && editing ? (
          <form action={save} className="mt-2 grid grid-cols-2 gap-3 border-t border-line pt-3">
            <Field label={t('condition')} name={`condition-${item.id}`} className="col-span-2">
              <Select id={`condition-${item.id}`} name="condition" defaultValue={item.condition}>
                {CONDITIONS.map((condition) => (
                  <option key={condition} value={condition}>
                    {t(`conditions.${condition}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('quantity')} name={`quantity-${item.id}`}>
              <Input
                id={`quantity-${item.id}`}
                name="quantity"
                type="number"
                min={1}
                max={99}
                defaultValue={item.quantity}
              />
            </Field>
            <Field label={t('pricePaid')} name={`price-${item.id}`}>
              <Input
                id={`price-${item.id}`}
                name="pricePaid"
                type="number"
                min={0}
                defaultValue={item.pricePaid ?? ''}
              />
            </Field>
            <Field label={t('acquiredAt')} name={`acquired-${item.id}`} className="col-span-2">
              <Input
                id={`acquired-${item.id}`}
                name="acquiredAt"
                type="date"
                defaultValue={item.acquiredAt ? toTaipeiDate(item.acquiredAt) : ''}
              />
            </Field>
            <Field label={t('note')} name={`note-${item.id}`} className="col-span-2">
              <Input
                id={`note-${item.id}`}
                name="note"
                maxLength={500}
                defaultValue={item.note ?? ''}
              />
            </Field>
            <div className="col-span-2 flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {t('save')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        ) : null}
        {error ? <p className="text-xs text-accent">{error}</p> : null}
      </div>
    </article>
  );
}

/** ISO 時間 → 台灣日期（YYYY-MM-DD，給 date 輸入框） */
export function toTaipeiDate(value: string): string {
  return new Date(new Date(value).getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}
