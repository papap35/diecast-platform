import { Link } from '@/i18n/navigation';

/** 品牌標誌：格紋旗 + PADDOCK 64 */
export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Paddock 64">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <rect width="28" height="28" rx="7" fill="#16161a" />
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2, 3].map((col) =>
            (row + col) % 2 === 0 ? (
              <rect
                key={`${row}-${col}`}
                x={6 + col * 4}
                y={6 + row * 4}
                width="4"
                height="4"
                fill="#fff"
              />
            ) : null,
          ),
        )}
        <rect x="22" y="6" width="2" height="16" rx="1" fill="#d7261e" />
      </svg>
      <span className="font-display text-xl leading-none font-bold tracking-tight italic">
        PADDOCK<span className="text-accent">64</span>
      </span>
    </Link>
  );
}
