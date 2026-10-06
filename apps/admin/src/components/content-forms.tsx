'use client';

import type { Schemas } from '@paddock64/api-client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, type ReactNode, useActionState, useState, useTransition } from 'react';
import {
  type ContentFormState,
  deleteBannerAction,
  deleteEventAction,
  saveBannerAction,
  saveEventAction,
} from '@/app/actions/content';
import { BANNER_THEMES as THEMES, THEME_COLORS } from '@/lib/banner-themes';
import { cn } from '@/lib/cn';
import { toTaipeiInput } from '@/lib/format';
import { LocaleTabs } from './locale-tabs';
import { Button } from './ui/button';
import { Field, Input, Select, Textarea } from './ui/field';

type AdminEvent = Schemas['AdminEventDto'];
type AdminBanner = Schemas['AdminBannerDto'];

const EVENT_TYPES = ['EXHIBITION', 'MEETUP', 'LAUNCH', 'ONLINE'] as const;
const CONTENT_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
const PLACEMENTS = ['HOME_PROMO', 'ANNOUNCEMENT'] as const;

function Feedback({ state }: { state: ContentFormState }) {
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
        {te.has(state.error.code) ? te(state.error.code) : state.error.message}
        {state.error.fields ? ` (${Object.keys(state.error.fields).join(', ')})` : ''}
      </p>
    );
  }
  return state.saved ? (
    <p role="status" className="rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">
      {tc('saved')}
    </p>
  ) : null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card flex flex-col gap-4 p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function EventForm({
  event,
  products,
}: {
  event?: AdminEvent;
  products: { id: string; label: string }[];
}) {
  const t = useTranslations('events');
  const tc = useTranslations('common');
  const tContent = useTranslations('content');
  const [state, formAction, pending] = useActionState(saveEventAction, {});
  const fields = state.error?.fields ?? {};
  const translation = (locale: string) => event?.translations.find((tr) => tr.locale === locale);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <fieldset disabled={pending} className="contents">
        {event ? <input type="hidden" name="id" value={event.id} /> : null}
        <Feedback state={state} />
        <Section title={t('sections.content')}>
          <LocaleTabs>
            {(locale) => (
              <>
                <Field
                  label={t('fields.title')}
                  name={`title.${locale}`}
                  hint={locale === 'zh-TW' ? tContent('required') : tContent('optional')}
                  error={locale === 'zh-TW' ? fields.translations : undefined}
                >
                  <Input
                    id={`title.${locale}`}
                    name={`title.${locale}`}
                    required={locale === 'zh-TW'}
                    maxLength={120}
                    defaultValue={translation(locale)?.title ?? ''}
                  />
                </Field>
                <Field label={t('fields.summary')} name={`summary.${locale}`}>
                  <Input
                    id={`summary.${locale}`}
                    name={`summary.${locale}`}
                    maxLength={300}
                    defaultValue={translation(locale)?.summary ?? ''}
                  />
                </Field>
                <Field label={t('fields.body')} name={`body.${locale}`} hint={t('fields.bodyHint')}>
                  <Textarea
                    id={`body.${locale}`}
                    name={`body.${locale}`}
                    rows={8}
                    defaultValue={translation(locale)?.body ?? ''}
                  />
                </Field>
              </>
            )}
          </LocaleTabs>
        </Section>

        <Section title={t('sections.basic')}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Slug" name="slug" hint={t('fields.slugHint')} error={fields.slug}>
              <Input id="slug" name="slug" required defaultValue={event?.slug} />
            </Field>
            <Field label={t('fields.type')} name="type">
              <Select id="type" name="type" defaultValue={event?.type ?? 'EXHIBITION'}>
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`types.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tc('status')} name="status">
              <Select id="status" name="status" defaultValue={event?.status ?? 'DRAFT'}>
                {CONTENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {tContent(`statuses.${status}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('fields.startsAt')} name="startsAt" error={fields.startsAt}>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={toTaipeiInput(event?.startsAt)}
              />
            </Field>
            <Field label={t('fields.endsAt')} name="endsAt" error={fields.endsAt}>
              <Input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={toTaipeiInput(event?.endsAt)}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('fields.venue')} name="venue">
              <Input id="venue" name="venue" maxLength={100} defaultValue={event?.venue ?? ''} />
            </Field>
            <Field label={t('fields.address')} name="address">
              <Input
                id="address"
                name="address"
                maxLength={200}
                defaultValue={event?.address ?? ''}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('fields.url')} name="url" hint={t('fields.urlHint')} error={fields.url}>
              <Input id="url" name="url" defaultValue={event?.url ?? ''} />
            </Field>
            <Field
              label={t('fields.coverImageUrl')}
              name="coverImageUrl"
              hint={tContent('imageHint')}
              error={fields.coverImageUrl}
            >
              <Input
                id="coverImageUrl"
                name="coverImageUrl"
                defaultValue={event?.coverImageUrl ?? ''}
              />
            </Field>
          </div>
          <Field
            label={t('fields.product')}
            name="productId"
            hint={t('fields.productHint')}
            error={fields.productId}
          >
            <Select id="productId" name="productId" defaultValue={event?.productId ?? ''}>
              <option value="">{tc('none')}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.label}
                </option>
              ))}
            </Select>
          </Field>
        </Section>

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? tc('saving') : event ? tc('save') : t('create')}
          </Button>
          {event ? (
            <DeleteButton
              onDelete={() => deleteEventAction(event.id)}
              redirectTo="/events"
              confirm={t('deleteConfirm')}
            />
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}

function DeleteButton({
  onDelete,
  redirectTo,
  confirm,
}: {
  onDelete: () => Promise<{ ok: boolean }>;
  redirectTo: string;
  confirm: string;
}) {
  const tc = useTranslations('common');
  const router = useRouter();
  const [deleting, startDelete] = useTransition();
  return (
    <Button
      type="button"
      variant="danger"
      disabled={deleting}
      onClick={() => {
        if (!window.confirm(confirm)) return;
        startDelete(async () => {
          const result = await onDelete();
          if (result.ok) router.push(redirectTo);
        });
      }}
    >
      {tc('delete')}
    </Button>
  );
}

interface PreviewState {
  placement: (typeof PLACEMENTS)[number];
  theme: (typeof THEMES)[number];
  title: string;
  subtitle: string;
  ctaLabel: string;
  imageUrl: string;
}

function readPreview(form: HTMLFormElement): PreviewState {
  const data = new FormData(form);
  const value = (key: string) => String(data.get(key) ?? '');
  return {
    placement: value('placement') as PreviewState['placement'],
    theme: value('theme') as PreviewState['theme'],
    title: value('title.zh-TW'),
    subtitle: value('subtitle.zh-TW'),
    ctaLabel: value('ctaLabel.zh-TW'),
    imageUrl: value('imageUrl'),
  };
}

export function BannerForm({ banner, apiBaseUrl }: { banner?: AdminBanner; apiBaseUrl: string }) {
  const t = useTranslations('banners');
  const tc = useTranslations('common');
  const tContent = useTranslations('content');
  const [state, formAction, pending] = useActionState(saveBannerAction, {});
  const fields = state.error?.fields ?? {};
  const translation = (locale: string) => banner?.translations.find((tr) => tr.locale === locale);
  const [preview, setPreview] = useState<PreviewState>({
    placement: banner?.placement ?? 'HOME_PROMO',
    theme: banner?.theme ?? 'NAVY',
    title: translation('zh-TW')?.title ?? '',
    subtitle: translation('zh-TW')?.subtitle ?? '',
    ctaLabel: translation('zh-TW')?.ctaLabel ?? '',
    imageUrl: banner?.imageUrl ?? '',
  });
  const onChange = (event: FormEvent<HTMLFormElement>) =>
    setPreview(readPreview(event.currentTarget));
  const imageSrc = preview.imageUrl.startsWith('/')
    ? `${apiBaseUrl}${preview.imageUrl}`
    : preview.imageUrl;

  return (
    <form
      action={formAction}
      onChange={onChange}
      key={banner?.id ?? 'new'}
      className="card flex flex-col gap-4 p-5"
    >
      <h2 className="text-sm font-semibold">
        {banner ? `${tc('edit')}：${banner.title}` : t('new')}
      </h2>
      <fieldset disabled={pending} className="contents">
        {banner ? <input type="hidden" name="id" value={banner.id} /> : null}
        <Feedback state={state} />

        <div aria-label={t('preview')} className="rounded-xl bg-canvas p-3">
          <p className="mb-2 text-[11px] font-semibold tracking-widest text-mute uppercase">
            {t('preview')}
          </p>
          {preview.placement === 'ANNOUNCEMENT' ? (
            <p className="rounded-md bg-[#16161a] px-3 py-2 text-center text-xs font-medium text-white">
              {preview.title || t('previewPlaceholder')}
            </p>
          ) : (
            <div
              className="relative flex min-h-36 flex-col justify-between gap-3 overflow-hidden rounded-2xl p-4 text-white"
              style={{ backgroundColor: THEME_COLORS[preview.theme] }}
            >
              <div className="relative z-10 max-w-[60%] space-y-1">
                <p className="text-lg leading-tight font-bold">
                  {preview.title || t('previewPlaceholder')}
                </p>
                {preview.subtitle ? (
                  <p className="text-xs text-white/75">{preview.subtitle}</p>
                ) : null}
              </div>
              {preview.ctaLabel ? (
                <p className="relative z-10 text-xs font-semibold">{preview.ctaLabel} →</p>
              ) : null}
              {imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- 預覽任意網址的圖片
                <img
                  src={imageSrc}
                  alt=""
                  className="absolute -right-3 -bottom-4 w-28 -rotate-6 rounded-lg ring-2 ring-white/15"
                />
              ) : null}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t('fields.placement')}
            name="placement"
            hint={banner ? t('fields.placementLocked') : undefined}
          >
            <Select
              id="placement"
              name="placement"
              disabled={!!banner}
              defaultValue={preview.placement}
            >
              {PLACEMENTS.map((placement) => (
                <option key={placement} value={placement}>
                  {t(`placements.${placement}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tc('status')} name="status">
            <Select id="status" name="status" defaultValue={banner?.status ?? 'DRAFT'}>
              {CONTENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {tContent(`statuses.${status}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {banner ? <input type="hidden" name="placement" value={banner.placement} /> : null}

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs font-semibold text-ink-2">{t('fields.theme')}</legend>
          <div className="flex gap-2">
            {THEMES.map((theme) => (
              <label key={theme} className="cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value={theme}
                  defaultChecked={(banner?.theme ?? 'NAVY') === theme}
                  className="peer sr-only"
                />
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-transparent ring-offset-2 peer-checked:ring-ink peer-focus-visible:ring-ink/50"
                  style={{ backgroundColor: THEME_COLORS[theme] }}
                  title={t(`themes.${theme}`)}
                >
                  <span className="sr-only">{t(`themes.${theme}`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <LocaleTabs>
          {(locale) => (
            <>
              <Field
                label={t('fields.title')}
                name={`title.${locale}`}
                hint={locale === 'zh-TW' ? tContent('required') : tContent('optional')}
                error={locale === 'zh-TW' ? fields.translations : undefined}
              >
                <Input
                  id={`title.${locale}`}
                  name={`title.${locale}`}
                  required={locale === 'zh-TW'}
                  maxLength={120}
                  defaultValue={translation(locale)?.title ?? ''}
                />
              </Field>
              <Field label={t('fields.subtitle')} name={`subtitle.${locale}`}>
                <Input
                  id={`subtitle.${locale}`}
                  name={`subtitle.${locale}`}
                  maxLength={200}
                  defaultValue={translation(locale)?.subtitle ?? ''}
                />
              </Field>
              <Field label={t('fields.ctaLabel')} name={`ctaLabel.${locale}`}>
                <Input
                  id={`ctaLabel.${locale}`}
                  name={`ctaLabel.${locale}`}
                  maxLength={30}
                  defaultValue={translation(locale)?.ctaLabel ?? ''}
                />
              </Field>
            </>
          )}
        </LocaleTabs>

        <Field
          label={t('fields.linkUrl')}
          name="linkUrl"
          hint={t('fields.linkHint')}
          error={fields.linkUrl}
        >
          <Input id="linkUrl" name="linkUrl" defaultValue={banner?.linkUrl ?? ''} />
        </Field>
        <Field
          label={t('fields.imageUrl')}
          name="imageUrl"
          hint={tContent('imageHint')}
          error={fields.imageUrl}
        >
          <Input id="imageUrl" name="imageUrl" defaultValue={banner?.imageUrl ?? ''} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('fields.startsAt')} name="startsAt" hint={t('fields.startsAtHint')}>
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              defaultValue={toTaipeiInput(banner?.startsAt)}
            />
          </Field>
          <Field
            label={t('fields.endsAt')}
            name="endsAt"
            hint={t('fields.endsAtHint')}
            error={fields.endsAt}
          >
            <Input
              id="endsAt"
              name="endsAt"
              type="datetime-local"
              defaultValue={toTaipeiInput(banner?.endsAt)}
            />
          </Field>
        </div>
        <Field label={t('fields.sortOrder')} name="sortOrder" hint={t('fields.sortOrderHint')}>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            min={-999}
            max={999}
            defaultValue={banner?.sortOrder ?? 0}
          />
        </Field>

        <div className={cn('flex gap-2')}>
          <Button type="submit" disabled={pending}>
            {pending ? tc('saving') : banner ? tc('save') : t('create')}
          </Button>
          {banner ? (
            <DeleteButton
              onDelete={() => deleteBannerAction(banner.id)}
              redirectTo="/banners"
              confirm={t('deleteConfirm')}
            />
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}
