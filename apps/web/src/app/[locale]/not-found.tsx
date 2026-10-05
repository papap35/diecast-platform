import { getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/components/ui/button';

export default async function NotFound() {
  const t = await getTranslations('errors');
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <p className="display text-7xl text-line-strong">404</p>
      <h1 className="display mt-4 text-3xl">{t('notFoundTitle')}</h1>
      <p className="mt-2 text-sm text-mute">{t('notFoundBody')}</p>
      <ButtonLink href="/" className="mt-8">
        {t('backHome')}
      </ButtonLink>
    </div>
  );
}
