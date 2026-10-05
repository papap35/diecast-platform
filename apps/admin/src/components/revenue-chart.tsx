'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatPrice, formatShortDate } from '@/lib/format';

export interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

const HEIGHT = 240;
const MARGIN = { top: 20, right: 8, bottom: 28, left: 56 };
const MAX_BAR = 24;
const RADIUS = 4;

/** 1/2/5 × 10^n 的整齊刻度 */
export function niceScale(max: number, ticks = 4): { max: number; step: number } {
  if (max <= 0) return { max: ticks * 1000, step: 1000 };
  const raw = max / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  return { max: step * Math.ceil(max / step), step };
}

/** 柱頂 4px 圓角、底部貼齊基線為直角 */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export function RevenueChart({ data, locale }: { data: RevenuePoint[]; locale: string }) {
  const t = useTranslations('dashboard');
  const { ref, width } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [view, setView] = useState<'chart' | 'table'>('chart');

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const peakIndex = data.reduce(
    (best, d, i) => (d.revenue > (data[best]?.revenue ?? -1) ? i : best),
    0,
  );
  const { max, step } = niceScale(Math.max(...data.map((d) => d.revenue), 0));
  const band = data.length ? innerW / data.length : 0;
  const barW = Math.min(MAX_BAR, band * 0.6);
  const y = (value: number) => MARGIN.top + innerH - (value / max) * innerH;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const labelEvery = band < 34 ? 2 : 1;
  const hovered = active !== null ? data[active] : undefined;

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{t('salesTrend')}</h2>
          <p className="text-xs text-mute">{t('salesTrendHint')}</p>
        </div>
        <button
          type="button"
          onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-mute ring-1 ring-line hover:text-ink"
        >
          {view === 'chart' ? t('tableView') : t('chartView')}
        </button>
      </div>

      {view === 'table' ? (
        <div className="max-h-64 overflow-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th className="text-right">{t('revenue')}</th>
                <th className="text-right">{t('orders')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}>
                  <td className="tabular">{d.date}</td>
                  <td className="text-right tabular">{formatPrice(d.revenue)}</td>
                  <td className="text-right tabular">{d.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative" style={{ height: HEIGHT }}>
          {width > 0 ? (
            <svg width={width} height={HEIGHT} role="img" aria-label={t('salesTrend')}>
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={MARGIN.left}
                    x2={width - MARGIN.right}
                    y1={y(tick)}
                    y2={y(tick)}
                    stroke="var(--color-grid)"
                    strokeWidth={1}
                  />
                  <text
                    x={MARGIN.left - 8}
                    y={y(tick)}
                    dy="0.32em"
                    textAnchor="end"
                    className="tabular fill-mute text-[11px]"
                  >
                    {tick >= 1000 ? `${(tick / 1000).toLocaleString('en-US')}K` : tick}
                  </text>
                </g>
              ))}
              {data.map((d, i) => {
                const x = MARGIN.left + i * band + (band - barW) / 2;
                const top = y(d.revenue);
                return (
                  <g key={d.date}>
                    <path
                      d={barPath(x, top, barW, MARGIN.top + innerH - top)}
                      fill="var(--color-series-1)"
                      opacity={active === null || active === i ? 1 : 0.45}
                    />
                    {i % labelEvery === 0 || i === data.length - 1 ? (
                      <text
                        x={x + barW / 2}
                        y={HEIGHT - 8}
                        textAnchor="middle"
                        className="tabular fill-mute text-[11px]"
                      >
                        {formatShortDate(d.date, locale)}
                      </text>
                    ) : null}
                    {i === peakIndex && d.revenue > 0 ? (
                      <text
                        x={x + barW / 2}
                        y={top - 6}
                        textAnchor="middle"
                        className="tabular fill-ink-2 text-[11px] font-semibold"
                      >
                        {formatPrice(d.revenue)}
                      </text>
                    ) : null}
                    {/* 整個區間都是滑鼠／鍵盤的觸發範圍，比柱子本身大 */}
                    <rect
                      x={MARGIN.left + i * band}
                      y={MARGIN.top}
                      width={band}
                      height={innerH}
                      fill="transparent"
                      tabIndex={0}
                      aria-label={`${d.date} ${formatPrice(d.revenue)}`}
                      onPointerEnter={() => setActive(i)}
                      onPointerLeave={() => setActive(null)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(null)}
                      className="cursor-default outline-none"
                    />
                  </g>
                );
              })}
            </svg>
          ) : null}
          {hovered && active !== null ? (
            <div
              role="tooltip"
              className={cn(
                'pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs text-white shadow-lg',
              )}
              style={{
                left: Math.min(Math.max(MARGIN.left + active * band + band / 2, 70), width - 70),
                top: Math.max(0, y(hovered.revenue) - 64),
              }}
            >
              <p className="text-sm font-bold tabular">{formatPrice(hovered.revenue)}</p>
              <p className="text-white/70">
                {hovered.date} · {t('orders')} {hovered.orders}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
