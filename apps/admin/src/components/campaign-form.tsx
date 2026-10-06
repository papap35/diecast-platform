'use client';

import type { Schemas } from '@paddock64/api-client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useActionState, useState, useTransition } from 'react';
import {
  cancelCampaignAction,
  type CouponFormState,
  deleteCampaignAction,
  saveCampaignAction,
  scheduleCampaignAction,
  testCampaignAction,
} from '@/app/actions/marketing';
import type { ActionError } from '@/lib/action-result';
import { LocaleTabs } from './locale-tabs';
import { Button } from './ui/button';
import { Field, Input, Select, Textarea } from './ui/field';

type Campaign = Schemas['CampaignDto'];
const TIERS = ['DRIVER', 'CHAMPION', 'LEGEND'] as const;

export function CampaignForm({ campaign }: { campaign?: Campaign }) {
  const t = useTranslations('campaigns');
  const tc = useTranslations('common');
  const tContent = useTranslations('content');
  const te = useTranslations('errors');
  const [state, formAction, pending] = useActionState<CouponFormState, FormData>(
    saveCampaignAction,
    {},
  );
  const editable = !campaign || campaign.status === 'DRAFT';
  const fields = state.error?.fields ?? {};
  const translation = (locale: string) => campaign?.translations.find((tr) => tr.locale === locale);

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-5">
      <fieldset disabled={pending || !editable} className="contents">
        {campaign ? <input type="hidden" name="id" value={campaign.id} /> : null}
        {state.error ? (
          <p role="alert" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
            {te.has(state.error.code) ? te(state.error.code) : state.error.message}
          </p>
        ) : null}
        {state.saved ? (
          <p role="status" className="rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">
            {tc('saved')}
          </p>
        ) : null}
        {!editable ? (
          <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-mute">{t('lockedHint')}</p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('fields.name')}
            name="name"
            hint={t('fields.nameHint')}
            error={fields.name}
          >
            <Input id="name" name="name" required maxLength={60} defaultValue={campaign?.name} />
          </Field>
          <Field label={t('fields.audience')} name="minTier" hint={t('fields.audienceHint')}>
            <Select id="minTier" name="minTier" defaultValue={campaign?.minTier ?? ''}>
              <option value="">{t('allSubscribers')}</option>
              {TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {t('tierOrAbove', { tier: t(`tiers.${tier}`) })}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <LocaleTabs>
          {(locale) => (
            <>
              <Field
                label={t('fields.subject')}
                name={`subject.${locale}`}
                hint={locale === 'zh-TW' ? tContent('required') : t('fields.optionalLocale')}
                error={locale === 'zh-TW' ? fields.translations : undefined}
              >
                <Input
                  id={`subject.${locale}`}
                  name={`subject.${locale}`}
                  required={locale === 'zh-TW'}
                  maxLength={120}
                  defaultValue={translation(locale)?.subject ?? ''}
                />
              </Field>
              <Field label={t('fields.body')} name={`body.${locale}`} hint={t('fields.bodyHint')}>
                <Textarea
                  id={`body.${locale}`}
                  name={`body.${locale}`}
                  rows={12}
                  defaultValue={translation(locale)?.body ?? ''}
                />
              </Field>
            </>
          )}
        </LocaleTabs>
        {editable ? (
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? tc('saving') : campaign ? tc('save') : t('create')}
            </Button>
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}

/** 寄送面板：測試信、立即寄送或排程、取消排程、刪除草稿 */
export function CampaignActions({ campaign }: { campaign: Campaign }) {
  const t = useTranslations('campaigns');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [scheduledAt, setScheduledAt] = useState('');
  const [testLocale, setTestLocale] = useState<'zh-TW' | 'en' | 'zh-CN'>('zh-TW');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (
    action: () => Promise<{ ok: true } | { ok: false; error: ActionError }>,
    success: string,
    after?: () => void,
  ) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setMessage({ ok: true, text: success });
        after?.();
      } else {
        setMessage({
          ok: false,
          text: te.has(result.error.code) ? te(result.error.code) : result.error.message,
        });
      }
    });

  return (
    <section className="card flex flex-col gap-4 p-5">
      <h2 className="text-sm font-semibold">{t('sendPanel')}</h2>
      {message ? (
        <p
          role={message.ok ? 'status' : 'alert'}
          className={
            message.ok
              ? 'rounded-xl bg-ok-soft px-3 py-2 text-xs text-ok'
              : 'rounded-xl bg-accent-soft px-3 py-2 text-xs text-accent'
          }
        >
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-ink-2">{t('testTitle')}</p>
        <div className="flex gap-2">
          <Select
            value={testLocale}
            onChange={(event) => setTestLocale(event.target.value as typeof testLocale)}
            aria-label={t('testLocale')}
            className="w-32"
          >
            <option value="zh-TW">繁體中文</option>
            <option value="en">English</option>
            <option value="zh-CN">简体中文</option>
          </Select>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => run(() => testCampaignAction(campaign.id, testLocale), t('testSent'))}
          >
            {t('sendTest')}
          </Button>
        </div>
        <p className="text-xs text-mute">{t('testHint')}</p>
      </div>

      {campaign.status === 'DRAFT' ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <p className="text-xs font-semibold text-ink-2">
            {t('sendTitle', { count: campaign.audienceCount })}
          </p>
          <Field label={t('scheduleAt')} name="scheduledAt" hint={t('scheduleHint')}>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={busy || campaign.audienceCount === 0}
              onClick={() => {
                if (!window.confirm(t('sendConfirm', { count: campaign.audienceCount }))) return;
                run(
                  () => scheduleCampaignAction(campaign.id, scheduledAt || null),
                  scheduledAt ? t('scheduled') : t('sendingSoon'),
                );
              }}
            >
              {scheduledAt ? t('schedule') : t('sendNow')}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={() => {
                if (!window.confirm(t('deleteConfirm'))) return;
                run(
                  () => deleteCampaignAction(campaign.id),
                  tc('saved'),
                  () => router.push('/campaigns'),
                );
              }}
            >
              {tc('delete')}
            </Button>
          </div>
        </div>
      ) : null}

      {campaign.status === 'SCHEDULED' ? (
        <div className="border-t border-line pt-4">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => run(() => cancelCampaignAction(campaign.id), t('cancelled'))}
          >
            {t('cancelSchedule')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
