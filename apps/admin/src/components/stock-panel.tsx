'use client';

import type { Schemas } from '@paddock64/api-client';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { adjustStockAction } from '@/app/actions/catalog';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { Button } from './ui/button';
import { Field, Input } from './ui/field';

export function StockPanel({
  productId,
  stock,
  soldCount,
  movements,
  canWrite,
}: {
  productId: string;
  stock: number;
  soldCount: number;
  movements: Schemas['StockMovementDto'][];
  canWrite: boolean;
}) {
  const t = useTranslations('products');
  const te = useTranslations('errors');
  const locale = useLocale();
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const value = Number(delta);
    if (!Number.isInteger(value) || value === 0) return;
    startTransition(async () => {
      setError(null);
      const result = await adjustStockAction(productId, value, note.trim());
      if (result.ok) {
        setDelta('');
        setNote('');
      } else {
        setError(te.has(result.error.code) ? te(result.error.code) : result.error.message);
      }
    });
  };

  return (
    <section className="card flex flex-col gap-4 p-5">
      <h2 className="text-sm font-semibold">{t('sections.inventory')}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-canvas p-3">
          <p className="text-xs text-mute">{t('stock')}</p>
          <p className="text-2xl font-semibold">{stock}</p>
        </div>
        <div className="rounded-xl bg-canvas p-3">
          <p className="text-xs text-mute">{t('soldCount')}</p>
          <p className="text-2xl font-semibold">{soldCount}</p>
        </div>
      </div>

      {canWrite ? (
        <div className="flex flex-col gap-3 rounded-xl ring-1 ring-line p-3">
          <p className="text-xs font-semibold text-ink-2">{t('adjustStock')}</p>
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <Field label={t('delta')} name="delta" hint={t('deltaHint')}>
              <Input
                id="delta"
                type="number"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                placeholder="+10"
              />
            </Field>
            <Field label={t('note')} name="adjust-note">
              <Input id="adjust-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          {error ? <p className="text-xs text-accent">{error}</p> : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending || !delta}
            onClick={submit}
          >
            {t('adjust')}
          </Button>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-semibold text-ink-2">{t('movements')}</p>
        <div className="max-h-80 overflow-auto rounded-xl ring-1 ring-line">
          <table className="table-base text-xs [&_td]:px-2.5 [&_th]:px-2.5">
            <thead className="sticky top-0 bg-surface">
              <tr>
                <th>{t('time')}</th>
                <th>{t('reason')}</th>
                <th className="text-right">{t('change')}</th>
                <th className="text-right">{t('balance')}</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id} title={movement.note ?? undefined}>
                  <td className="whitespace-nowrap text-mute tabular">
                    {formatDateTime(movement.createdAt, locale).slice(5)}
                  </td>
                  <td>
                    <span className="whitespace-nowrap">{t(`reasons.${movement.reason}`)}</span>
                    {movement.note ? (
                      <span className="block text-faint">{movement.note}</span>
                    ) : null}
                  </td>
                  <td
                    className={cn(
                      'text-right font-semibold tabular',
                      movement.delta > 0 ? 'text-ok' : 'text-ink-2',
                    )}
                  >
                    {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
                  </td>
                  <td className="text-right tabular">{movement.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
