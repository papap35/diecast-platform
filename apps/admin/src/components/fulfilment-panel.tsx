'use client';

import type { Schemas } from '@paddock64/api-client';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import {
  createShipmentAction,
  retryInvoiceAction,
  simulateShipmentAction,
} from '@/app/actions/sales';
import type { ActionResult } from '@/lib/action-result';
import { formatDate, formatDateTime, formatInvoiceNo } from '@/lib/format';
import { Button } from './ui/button';

type Order = Schemas['AdminOrderDto'];
type SimulatedStatus = Schemas['SimulateShipmentDto']['status'];

/** 與 API 相同的物流狀態順序：模擬只能往前推進，退回與取件同為終點 */
const RANK: Record<Schemas['ShipmentStatus'], number> = {
  CREATED: 0,
  IN_TRANSIT: 1,
  ARRIVED: 2,
  PICKED_UP: 3,
  RETURNED: 3,
};
const SIMULATED: SimulatedStatus[] = ['IN_TRANSIT', 'ARRIVED', 'PICKED_UP', 'RETURNED'];

/** 訂單詳情側欄：物流單（建立、模擬配送）與電子發票（狀態、手動重試） */
export function FulfilmentPanel({ order, canWrite }: { order: Order; canWrite: boolean }) {
  const t = useTranslations('orders');
  const te = useTranslations('errors');
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { shipment, invoice } = order;
  const home = order.shippingMethod === 'HOME_DELIVERY';

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) {
        setError(te.has(result.error.code) ? te(result.error.code) : result.error.message);
      }
    });

  return (
    <>
      <section className="card flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t('shipmentTitle')}</h2>
          {shipment ? (
            <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold text-ink-2">
              {t(`shipmentStatuses.${shipment.status}`)}
            </span>
          ) : null}
        </div>
        {shipment ? (
          <dl className="space-y-1.5 text-xs">
            <Item
              label={t('provider')}
              value={`${t(`providers.${shipment.provider}`)} · ${shipment.logisticsSubType}`}
            />
            {shipment.shipmentNo ? (
              <Item
                label={home ? t('trackingNo') : t('shipmentNo')}
                value={
                  shipment.validationNo
                    ? `${shipment.shipmentNo}（${t('validationNo')} ${shipment.validationNo}）`
                    : shipment.shipmentNo
                }
              />
            ) : null}
            {shipment.logisticsId ? (
              <Item label={t('logisticsId')} value={shipment.logisticsId} />
            ) : null}
            {shipment.statusMessage ? (
              <Item
                label={t('latestStatus')}
                value={`${shipment.statusMessage}${shipment.statusCode ? `（${shipment.statusCode}）` : ''}`}
              />
            ) : null}
            <Item label={t('updatedAt')} value={formatDateTime(shipment.updatedAt, locale)} />
          </dl>
        ) : (
          <p className="text-xs text-mute">
            {order.canCreateShipment ? t('shipmentHint') : t('noShipment')}
          </p>
        )}
        {canWrite && order.canCreateShipment ? (
          <Button
            type="button"
            disabled={pending}
            onClick={() => run(() => createShipmentAction(order.id))}
          >
            {shipment ? t('reship') : t('createShipment')}
          </Button>
        ) : null}
        {canWrite && shipment?.provider === 'MOCK' && RANK[shipment.status] < 3 ? (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <p className="text-xs font-semibold text-mute">{t('simulate')}</p>
            <div className="flex flex-wrap gap-2">
              {SIMULATED.filter((status) => RANK[status] > RANK[shipment.status]).map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => simulateShipmentAction(order.id, status))}
                >
                  {t(`shipmentStatuses.${status}`)}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t('invoiceTitle')}</h2>
          {invoice ? (
            <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold text-ink-2">
              {t(`invoiceStatuses.${invoice.status}`)}
            </span>
          ) : null}
        </div>
        {invoice ? (
          <>
            <dl className="space-y-1.5 text-xs">
              <Item label={t('provider')} value={t(`providers.${invoice.provider}`)} />
              {invoice.invoiceNo ? (
                <Item label={t('invoiceNo')} value={formatInvoiceNo(invoice.invoiceNo)} />
              ) : null}
              {invoice.invoiceDate ? (
                <Item label={t('invoiceDate')} value={formatDate(invoice.invoiceDate, locale)} />
              ) : null}
              {invoice.randomNumber ? (
                <Item label={t('randomNumber')} value={invoice.randomNumber} />
              ) : null}
              {invoice.allowanceNo ? (
                <Item label={t('allowanceNo')} value={invoice.allowanceNo} />
              ) : null}
            </dl>
            {invoice.lastError ? (
              <div className="rounded-lg bg-accent-soft p-2.5 text-xs text-accent">
                <p className="font-semibold">{t('invoiceError', { attempts: invoice.attempts })}</p>
                <p className="mt-0.5 break-words">{invoice.lastError}</p>
                <p className="mt-1">
                  {invoice.needsAttention
                    ? t('invoiceNeedsAttention')
                    : invoice.nextAttemptAt
                      ? t('invoiceNextAttempt', {
                          time: formatDateTime(invoice.nextAttemptAt, locale),
                        })
                      : null}
                </p>
              </div>
            ) : null}
            {canWrite && (invoice.status === 'PENDING' || invoice.status === 'VOID_PENDING') ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => retryInvoiceAction(order.id))}
              >
                {t('retryInvoice')}
              </Button>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-mute">{t('noInvoice')}</p>
        )}
        {error ? <p className="text-xs text-accent">{error}</p> : null}
      </section>
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-mute">{label}</dt>
      <dd className="text-right tabular">{value}</dd>
    </div>
  );
}
