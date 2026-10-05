'use client';

import type { Schemas } from '@paddock64/api-client';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { addOrderNoteAction, updateOrderStatusAction } from '@/app/actions/sales';
import { Button } from './ui/button';
import { Field, Input, Select, Textarea } from './ui/field';

type Status = Schemas['UpdateOrderStatusDto']['status'];

export function OrderStatusControl({
  orderId,
  nextStatuses,
  canWrite,
}: {
  orderId: string;
  nextStatuses: Status[];
  canWrite: boolean;
}) {
  const t = useTranslations('orders');
  const te = useTranslations('errors');
  const [status, setStatus] = useState<Status | ''>(nextStatuses[0] ?? '');
  const [note, setNote] = useState('');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fail = (code: string, message: string) => setError(te.has(code) ? te(code) : message);

  return (
    <div className="flex flex-col gap-5">
      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold">{t('changeStatus')}</h2>
        {nextStatuses.length === 0 ? (
          <p className="text-sm text-mute">{t('noTransitions')}</p>
        ) : (
          <>
            <Field label={t('nextStatus')} name="next-status">
              <Select
                id="next-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                disabled={!canWrite}
              >
                {nextStatuses.map((s) => (
                  <option key={s} value={s}>
                    {t(`statuses.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('statusNote')} name="status-note">
              <Input
                id="status-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={!canWrite}
              />
            </Field>
            {status === 'REFUNDED' ? (
              <p className="rounded-lg bg-warn-soft p-2.5 text-xs text-warn">
                {t('refundWarning')}
              </p>
            ) : null}
            {canWrite ? (
              <Button
                type="button"
                disabled={pending || !status}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await updateOrderStatusAction(
                      orderId,
                      status as Status,
                      note.trim(),
                    );
                    if (result.ok) setNote('');
                    else fail(result.error.code, result.error.message);
                  })
                }
              >
                {t('apply')}
              </Button>
            ) : null}
          </>
        )}
        {error ? <p className="text-xs text-accent">{error}</p> : null}
      </section>

      {canWrite ? (
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">{t('addNote')}</h2>
          <Textarea
            rows={3}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder={t('notePlaceholder')}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={pending || !memo.trim()}
            onClick={() =>
              startTransition(async () => {
                const result = await addOrderNoteAction(orderId, memo.trim());
                if (result.ok) setMemo('');
                else fail(result.error.code, result.error.message);
              })
            }
          >
            {t('addNote')}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
