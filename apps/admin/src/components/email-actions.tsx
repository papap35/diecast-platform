'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { retryEmailAction, retryFailedEmailsAction } from '@/app/actions/emails';
import { Button } from './ui/button';

function Message({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return (
    <span
      role={message.ok ? 'status' : 'alert'}
      className={message.ok ? 'text-xs text-ok' : 'text-xs text-accent'}
    >
      {message.text}
    </span>
  );
}

/**
 * 單封寄送失敗的信重新排入寄送。
 * 重新排入後頁面會更新成「待寄出」，按鈕隱藏但元件保留，結果訊息才不會跟著消失。
 */
export function RetryEmailButton({ id, failed }: { id: string; failed: boolean }) {
  const t = useTranslations('emails');
  const te = useTranslations('errors');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span className="inline-flex items-center gap-3">
      <Message message={message} />
      {failed ? (
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await retryEmailAction(id);
              setMessage(
                result.ok
                  ? { ok: true, text: t('queued') }
                  : {
                      ok: false,
                      text: te.has(result.error.code)
                        ? te(result.error.code)
                        : result.error.message,
                    },
              );
            })
          }
        >
          {t('retry')}
        </Button>
      ) : null}
    </span>
  );
}

/** 全部寄送失敗的信重新排入（寄信服務故障排除後使用） */
export function RetryFailedButton({ count }: { count: number }) {
  const t = useTranslations('emails');
  const te = useTranslations('errors');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span className="inline-flex items-center gap-3">
      <Message message={message} />
      {count > 0 ? (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(t('retryAllConfirm', { count }))) return;
            startTransition(async () => {
              const result = await retryFailedEmailsAction();
              setMessage(
                result.ok
                  ? { ok: true, text: t('queuedCount', { count: result.data.count }) }
                  : {
                      ok: false,
                      text: te.has(result.error.code)
                        ? te(result.error.code)
                        : result.error.message,
                    },
              );
            });
          }}
        >
          {t('retryAll', { count })}
        </Button>
      ) : null}
    </span>
  );
}
