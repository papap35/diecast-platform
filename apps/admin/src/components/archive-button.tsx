'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { archiveProductAction } from '@/app/actions/catalog';
import { Button } from './ui/button';

export function ArchiveButton({ productId }: { productId: string }) {
  const t = useTranslations('products');
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="danger"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t('archiveConfirm'))) return;
        startTransition(async () => {
          await archiveProductAction(productId);
        });
      }}
    >
      {t('archive')}
    </Button>
  );
}
