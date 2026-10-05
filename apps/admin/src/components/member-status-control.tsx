'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { updateMemberStatusAction } from '@/app/actions/sales';
import { Button } from './ui/button';

export function MemberStatusControl({
  memberId,
  status,
}: {
  memberId: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
}) {
  const t = useTranslations('members');
  const [pending, startTransition] = useTransition();
  if (status === 'DELETED') return null;
  const suspend = status === 'ACTIVE';
  return (
    <Button
      type="button"
      variant={suspend ? 'danger' : 'secondary'}
      disabled={pending}
      onClick={() => {
        if (suspend && !window.confirm(t('suspendConfirm'))) return;
        startTransition(async () => {
          await updateMemberStatusAction(memberId, suspend ? 'SUSPENDED' : 'ACTIVE');
        });
      }}
    >
      {suspend ? t('suspend') : t('activate')}
    </Button>
  );
}
