export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="26" height="26" viewBox="0 0 28 28" aria-hidden>
        <rect width="28" height="28" rx="7" fill={inverted ? '#ffffff' : '#16161a'} />
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2, 3].map((col) =>
            (row + col) % 2 === 0 ? (
              <rect
                key={`${row}-${col}`}
                x={6 + col * 4}
                y={6 + row * 4}
                width="4"
                height="4"
                fill={inverted ? '#16161a' : '#fff'}
              />
            ) : null,
          ),
        )}
        <rect x="22" y="6" width="2" height="16" rx="1" fill="#d7261e" />
      </svg>
      <span className="font-display text-lg leading-none font-bold tracking-tight italic">
        PADDOCK<span className="text-accent">64</span>
        <span
          className={`ml-1.5 align-middle text-[10px] font-semibold tracking-[0.2em] not-italic ${inverted ? 'text-white/50' : 'text-mute'}`}
        >
          ADMIN
        </span>
      </span>
    </span>
  );
}
