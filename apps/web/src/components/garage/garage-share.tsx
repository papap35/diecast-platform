'use client';

import type { Schemas } from '@paddock64/api-client';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { updateGarageSettingsAction } from '@/app/actions/collector';
import { getPathname } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { LinkIcon } from '../icons';
import { Button } from '../ui/button';
import { Field, Input } from '../ui/field';

/** 公開分享設定：開啟後任何人都能看到車庫（不含購入價與備註） */
export function GarageShare({
  settings,
  siteUrl,
}: {
  settings: Schemas['GarageSettingsDto'];
  siteUrl: string;
}) {
  const t = useTranslations('garage');
  const te = useTranslations('errors');
  const locale = useLocale() as AppLocale;
  const [current, setCurrent] = useState(settings);
  const [handle, setHandle] = useState(settings.handle ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const url = current.handle
    ? `${siteUrl}${getPathname({ href: `/garage/${current.handle}`, locale })}`
    : null;

  const save = (isPublic: boolean) =>
    startTransition(async () => {
      setMessage(null);
      const result = await updateGarageSettingsAction({
        public: isPublic,
        ...(handle ? { handle: handle.trim().toLowerCase() } : {}),
      });
      if (result.ok) {
        setCurrent(result.data);
        setMessage({ ok: true, text: t('shareSaved') });
      } else {
        const field = result.error.fields?.handle;
        setMessage({
          ok: false,
          text: field ?? (te.has(result.error.code) ? te(result.error.code) : result.error.message),
        });
      }
    });

  return (
    <section className="space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t('share')}</h2>
          <p className="text-xs text-mute">{t('shareHint')}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={current.public}
            disabled={pending}
            onChange={(e) => save(e.target.checked)}
            className="h-4 w-4 accent-ink"
          />
          {t('sharePublic')}
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field
          label={t('handle')}
          name="garage-handle"
          hint={t('handleHint')}
          className="min-w-56 flex-1"
        >
          <Input
            id="garage-handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            maxLength={20}
            placeholder="my-garage"
            autoComplete="off"
          />
        </Field>
        <Button
          variant="secondary"
          disabled={pending || !handle.trim()}
          onClick={() => save(current.public)}
        >
          {t('save')}
        </Button>
      </div>
      {current.public && url ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-paper px-3 py-2 text-sm">
          <LinkIcon size={16} className="shrink-0 text-mute" />
          <a
            href={url}
            className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline"
          >
            {url}
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(url);
              setMessage({ ok: true, text: t('copied') });
            }}
          >
            {t('copy')}
          </Button>
        </div>
      ) : null}
      {message ? (
        <p role="status" className={message.ok ? 'text-xs text-ok' : 'text-xs text-accent'}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
