import { getTranslations } from 'next-intl/server';
import { ShieldIcon } from './icons';
import { PageHeader } from './page-header';

/** 角色沒有這個頁面的權限時顯示（側邊選單已隱藏，這裡處理直接輸入網址的情況） */
export async function NoAccess({ title }: { title: string }) {
  const t = await getTranslations('common');
  return (
    <>
      <PageHeader title={title} />
      <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
        <ShieldIcon size={28} className="text-faint" />
        <p className="text-sm text-mute">{t('noAccess')}</p>
      </div>
    </>
  );
}
