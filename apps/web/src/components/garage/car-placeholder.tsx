/** 沒有商品圖的收藏（其他來源車款）顯示的車型剪影 */
export function CarPlaceholder({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <rect width="160" height="120" fill="var(--color-paper)" />
      <path
        d="M24 78c0-6 4-10 10-11l14-3 14-14c4-4 9-6 15-6h20c6 0 11 2 15 7l10 12 14 3c5 1 8 5 8 10v5c0 3-2 5-5 5H29c-3 0-5-2-5-5v-3Z"
        fill="var(--color-line-strong)"
      />
      <circle cx="50" cy="86" r="10" fill="var(--color-ink-2)" />
      <circle cx="112" cy="86" r="10" fill="var(--color-ink-2)" />
      <circle cx="50" cy="86" r="4" fill="var(--color-line)" />
      <circle cx="112" cy="86" r="4" fill="var(--color-line)" />
    </svg>
  );
}
