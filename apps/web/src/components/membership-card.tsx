import type { Schemas } from '@paddock64/api-client';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { CheckIcon, TrophyIcon } from './icons';

type Membership = Schemas['MembershipDto'];

/** 會員等級：目前等級、升級進度與各等級權益比較 */
export function MembershipCard({ membership }: { membership: Membership }) {
  const t = useTranslations('membership');
  const { tier, totalSpent, next, tiers } = membership;
  const current = tiers.find((info) => info.tier === tier)!;
  const progress = next
    ? Math.min(1, (totalSpent - current.threshold) / (next.threshold - current.threshold))
    : 1;
  const shipping = (amount: number) => (amount === 0 ? t('alwaysFree') : formatPrice(amount));

  return (
    <section className="overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
      <div className="bg-ink p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
              <TrophyIcon />
            </span>
            <div>
              <p className="text-xs text-white/60">{t('title')}</p>
              <p className="display text-2xl">{t(`tiers.${tier}`)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/60">{t('totalSpent')}</p>
            <p className="text-lg font-bold tabular">{formatPrice(totalSpent)}</p>
          </div>
        </div>
        <div className="mt-5">
          <div
            className="h-2 overflow-hidden rounded-full bg-white/15"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label={
              next
                ? t('nextTier', {
                    tier: t(`tiers.${next.tier}`),
                    amount: formatPrice(next.remaining),
                  })
                : t('topTier')
            }
          >
            <div className="h-full rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-white/75">
            {next
              ? t('nextTier', {
                  tier: t(`tiers.${next.tier}`),
                  amount: formatPrice(next.remaining),
                })
              : t('topTier')}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto p-2 sm:p-4">
        <table className="w-full min-w-[32rem] text-sm">
          <caption className="sr-only">{t('benefits')}</caption>
          <thead>
            <tr>
              <th scope="col" className="p-2 text-left text-xs font-semibold text-mute">
                {t('benefits')}
              </th>
              {tiers.map((info) => (
                <th
                  key={info.tier}
                  scope="col"
                  className={cn(
                    'rounded-t-xl p-2 text-center text-xs font-semibold',
                    info.tier === tier ? 'bg-paper text-ink' : 'text-mute',
                  )}
                >
                  {t(`tiers.${info.tier}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {(
              [
                ['threshold', (info) => formatPrice(info.threshold)],
                ['cvsShipping', (info) => shipping(info.cvsFreeShipping)],
                ['homeShipping', (info) => shipping(info.homeFreeShipping)],
                [
                  'earlyAccess',
                  (info) =>
                    info.earlyAccess ? (
                      <CheckIcon size={16} className="mx-auto text-ok" aria-label={t('yes')} />
                    ) : (
                      <span aria-label={t('no')}>—</span>
                    ),
                ],
              ] as const satisfies readonly [
                string,
                (info: Membership['tiers'][number]) => React.ReactNode,
              ][]
            ).map(([key, render]) => (
              <tr key={key} className="border-t border-line">
                <th scope="row" className="p-2 text-left text-xs font-medium text-ink-2">
                  {t(key)}
                </th>
                {tiers.map((info) => (
                  <td
                    key={info.tier}
                    className={cn(
                      'p-2 text-center text-xs',
                      info.tier === tier && 'bg-paper font-semibold',
                    )}
                  >
                    {render(info)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-2 pt-3 text-xs text-mute">{t('note')}</p>
      </div>
    </section>
  );
}
