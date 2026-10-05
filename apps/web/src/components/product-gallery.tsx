'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/cn';

export function ProductGallery({
  images,
  name,
}: {
  images: { url: string; alt: string | null }[];
  name: string;
}) {
  const [active, setActive] = useState(0);
  const current = images[active];
  if (!current) return <div className="aspect-[4/3] rounded-3xl bg-surface ring-1 ring-line" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
        <Image
          src={current.url}
          alt={current.alt ?? name}
          fill
          unoptimized
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="object-cover"
        />
      </div>
      {images.length > 1 ? (
        <div className="grid grid-cols-4 gap-3">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`${name} ${index + 1}`}
              aria-current={index === active}
              className={cn(
                'relative aspect-[4/3] overflow-hidden rounded-xl bg-surface ring-1 transition',
                index === active ? 'ring-2 ring-ink' : 'ring-line hover:ring-line-strong',
              )}
            >
              <Image
                src={image.url}
                alt=""
                fill
                unoptimized
                sizes="15vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
