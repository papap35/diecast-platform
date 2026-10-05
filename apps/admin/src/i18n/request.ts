import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from './config';

/** 後台不在網址放語系，改用 cookie 記住管理員選擇的語言 */
export default getRequestConfig(async () => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(value) ? value : DEFAULT_LOCALE;
  return {
    locale,
    timeZone: 'Asia/Taipei',
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
