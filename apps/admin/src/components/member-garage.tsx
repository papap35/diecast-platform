'use client';

import type { Schemas } from '@paddock64/api-client';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { hideGarageAction } from '@/app/actions/sales';
import { formatDateTime } from '@/lib/format';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

type Garage = Schemas['AdminGarageDto'];

/** 後台會員頁的收藏車庫：只讀清單（不含購入價與備註），可把不當的公開車庫設為不公開 */
export function MemberGarage({
  garage,
  memberId,
  canWrite,
  storefrontUrl,
  locale,
}: {
  garage: Garage;
  memberId: string;
  canWrite: boolean;
  storefrontUrl: string;
  locale: string;
}) {
  const t = useTranslations('members.garage');
  const te = useTranslations('errors');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { settings, stats, items } = garage;

  return (
    <section className="card mt-5 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
        <div>
          <h2 className="text-sm font-semibold">{t('title')}</h2>
          <p className="text-xs text-mute">
            {t('summary', { models: stats.models, cars: stats.cars })}
            {stats.brands.length
              ? ` · ${stats.brands
                  .slice(0, 4)
                  .map((brand) => `${brand.label} ${brand.count}`)
                  .join('、')}`
              : ''}
          </p>
          <p className="text-xs text-faint">{t('privacyHint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {settings.public && settings.handle ? (
            <>
              <Badge tone="info">{t('public')}</Badge>
              <a
                href={`${storefrontUrl}/zh-TW/garage/${settings.handle}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-ink-2 hover:underline"
              >
                /garage/{settings.handle} ↗
              </a>
              {canWrite ? (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(t('hideConfirm'))) return;
                    startTransition(async () => {
                      const result = await hideGarageAction(memberId);
                      setError(
                        result.ok
                          ? null
                          : te.has(result.error.code)
                            ? te(result.error.code)
                            : result.error.message,
                      );
                    });
                  }}
                >
                  {t('hide')}
                </Button>
              ) : null}
            </>
          ) : (
            <Badge tone="neutral">
              {t('private')}
              {settings.handle ? ` · ${settings.handle}` : ''}
            </Badge>
          )}
        </div>
      </div>
      {error ? (
        <p
          role="alert"
          className="mx-5 mb-3 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent"
        >
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>{t('model')}</th>
              <th>{t('condition')}</th>
              <th className="text-right">{t('quantity')}</th>
              <th>{t('source')}</th>
              <th>{t('added')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-mute">
                  {t('empty')}
                </td>
              </tr>
            ) : null}
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md bg-canvas">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {item.isFavorite ? (
                          <span className="mr-1 text-gold" aria-label={t('favorite')}>
                            ★
                          </span>
                        ) : null}
                        {item.productId ? (
                          <Link href={`/products/${item.productId}`} className="hover:underline">
                            {item.name}
                          </Link>
                        ) : (
                          item.name
                        )}
                      </p>
                      <p className="text-xs text-mute">
                        {[item.brandName, item.scale].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap text-ink-2">
                  {t(`conditions.${item.condition}`)}
                </td>
                <td className="text-right tabular">{item.quantity}</td>
                <td className="whitespace-nowrap text-xs">
                  {item.order ? (
                    <Link
                      href={`/orders/${item.order.id}`}
                      className="font-semibold tabular hover:underline"
                    >
                      {item.order.orderNo}
                    </Link>
                  ) : (
                    <span className="text-mute">{t('manual')}</span>
                  )}
                </td>
                <td className="whitespace-nowrap text-xs text-mute tabular">
                  {formatDateTime(item.createdAt, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
