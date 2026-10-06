import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function formatPercent(value: number): string {
  const pct = value * 100;
  return `${pct >= 10 || pct === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

/** 報表區塊：標題、說明與內容 */
export function ReportPanel({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('card flex min-w-0 flex-col p-5', className)}>
      <div className="mb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint ? <p className="text-xs text-mute">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** 占比長條：單一色相表示大小，旁邊一定附百分比文字 */
export function ShareBar({ share }: { share: number }) {
  const pct = Math.max(0, Math.min(1, share));
  return (
    <div className="flex min-w-24 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas" aria-hidden>
        <div className="h-full rounded-full bg-series-1" style={{ width: `${pct * 100}%` }} />
      </div>
      <span className="w-11 text-right text-xs text-ink-2 tabular">{formatPercent(pct)}</span>
    </div>
  );
}

/**
 * 與前期比較：箭頭與百分比本身就表達方向，顏色只是輔助。
 * invert：數字變大是壞事（例如退款）時反轉顏色。
 */
export function Delta({
  current,
  previous,
  previousLabel,
  invert = false,
}: {
  current: number;
  previous: number;
  previousLabel: string;
  invert?: boolean;
}) {
  if (previous === 0) return <span>{previousLabel}</span>;
  const change = (current - previous) / previous;
  const flat = Math.abs(change) < 0.0005;
  const good = invert ? change < 0 : change > 0;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <span
        className={cn(
          'font-semibold tabular',
          flat ? 'text-mute' : good ? 'text-ok' : 'text-accent',
        )}
      >
        {flat ? '±0%' : `${change > 0 ? '▲' : '▼'} ${formatPercent(Math.abs(change))}`}
      </span>
      <span>{previousLabel}</span>
    </span>
  );
}

/** 只顯示前幾名，其餘合併成一列「其他」（顏色與排序都跟著項目本身，不因篩選改變） */
export function foldRows<T extends { revenue: number; units: number }>(
  rows: T[],
  limit: number,
): { visible: T[]; rest: { count: number; revenue: number; units: number } | null } {
  if (rows.length <= limit) return { visible: rows, rest: null };
  const hidden = rows.slice(limit);
  return {
    visible: rows.slice(0, limit),
    rest: {
      count: hidden.length,
      revenue: hidden.reduce((sum, row) => sum + row.revenue, 0),
      units: hidden.reduce((sum, row) => sum + row.units, 0),
    },
  };
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-6 text-center text-sm text-mute">
        {children}
      </td>
    </tr>
  );
}

export interface BarListItem {
  key: string;
  label: string;
  /** 主要數值（已格式化） */
  value: string;
  detail?: string;
  share: number;
}

/** 窄欄位用的長條清單：名稱與數值一行、長條一行，比表格好讀 */
export function BarList({ items }: { items: BarListItem[] }) {
  return (
    <ul className="flex flex-col gap-3.5">
      {items.map((item) => {
        const pct = Math.max(0, Math.min(1, item.share));
        return (
          <li key={item.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm">{item.label}</span>
              <span className="shrink-0 text-sm tabular">
                {item.value}
                <span className="ml-2 inline-block w-11 text-right text-xs text-mute">
                  {formatPercent(pct)}
                </span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas" aria-hidden>
              <div className="h-full rounded-full bg-series-1" style={{ width: `${pct * 100}%` }} />
            </div>
            {item.detail ? <p className="mt-1 text-xs text-mute">{item.detail}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
