import type { Schemas } from '@paddock64/api-client';
import { useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/format';

type Stats = Schemas['GarageStatsDto'];

/**
 * 車庫統計：數字卡與品牌分布。品牌分布用長條清單（單一數列、依數量排序、每列直接標示數值），
 * 本身就是可讀的清單，不需要另外的表格檢視。
 */
export function GarageStats({ stats, totalPaid }: { stats: Stats; totalPaid?: number }) {
  const t = useTranslations('garage');
  const top = stats.brands[0]?.count ?? 0;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
        <Tile label={t('models')} value={stats.models.toLocaleString('en-US')} />
        <Tile label={t('cars')} value={stats.cars.toLocaleString('en-US')} />
        {totalPaid !== undefined ? (
          <Tile label={t('totalPaid')} value={formatPrice(totalPaid)} hint={t('privateHint')} />
        ) : null}
        <Tile
          label={t('scales')}
          value={stats.scales.map((s) => s.label).join(' · ') || '—'}
          small
        />
      </dl>
      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
        <h2 className="mb-3 text-sm font-semibold">{t('brands')}</h2>
        {stats.brands.length ? (
          <ol className="space-y-2.5">
            {stats.brands.map((brand) => (
              <li
                key={brand.label}
                className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3 text-sm"
              >
                <span className="truncate text-ink-2">{brand.label}</span>
                <span className="h-3 overflow-hidden rounded-r-[4px] bg-paper" aria-hidden>
                  <span
                    className="block h-full rounded-r-[4px] bg-ink"
                    style={{ width: `${(brand.count / top) * 100}%` }}
                  />
                </span>
                <span className="text-right font-semibold tabular">{brand.count}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-mute">—</p>
        )}
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  small,
}: {
  label: string;
  value: string;
  hint?: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
      <dt className="text-xs text-mute">{label}</dt>
      <dd className={small ? 'mt-1 text-sm font-semibold' : 'display mt-1 text-2xl tabular'}>
        {value}
      </dd>
      {hint ? <p className="mt-0.5 text-[11px] text-faint">{hint}</p> : null}
    </div>
  );
}
