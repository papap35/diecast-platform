import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';

export function Price({
  price,
  compareAtPrice,
  className,
  size = 'md',
}: {
  price: number;
  compareAtPrice?: number | null;
  className?: string;
  size?: 'md' | 'lg';
}) {
  return (
    <span className={cn('inline-flex items-baseline gap-2 tabular', className)}>
      <span className={cn('font-bold', size === 'lg' ? 'text-3xl' : 'text-base')}>
        {formatPrice(price)}
      </span>
      {compareAtPrice && compareAtPrice > price ? (
        <span className={cn('text-mute line-through', size === 'lg' ? 'text-base' : 'text-xs')}>
          {formatPrice(compareAtPrice)}
        </span>
      ) : null}
    </span>
  );
}
