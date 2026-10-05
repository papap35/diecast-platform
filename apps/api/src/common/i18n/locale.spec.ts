import { pickTranslation, resolveLocale } from './locale.js';

describe('resolveLocale', () => {
  it('明確指定的語系優先', () => {
    expect(resolveLocale('en', 'zh-TW')).toBe('en');
  });

  it('依 Accept-Language 權重挑選支援的語系', () => {
    expect(resolveLocale(undefined, 'fr-FR,en-US;q=0.8,zh-CN;q=0.9')).toBe('zh-CN');
    expect(resolveLocale(undefined, 'zh-Hant-TW,zh;q=0.8')).toBe('zh-TW');
    expect(resolveLocale(undefined, 'en-GB')).toBe('en');
  });

  it('不支援或未提供時回到繁中', () => {
    expect(resolveLocale('ja', 'ja-JP')).toBe('zh-TW');
    expect(resolveLocale()).toBe('zh-TW');
  });
});

describe('pickTranslation', () => {
  const translations = [
    { locale: 'zh-TW', name: '繁中' },
    { locale: 'en', name: 'English' },
  ];

  it('有對應語系就使用', () => {
    expect(pickTranslation(translations, 'en')?.name).toBe('English');
  });

  it('簡中缺翻譯時優先回退到繁中', () => {
    expect(pickTranslation(translations, 'zh-CN')?.name).toBe('繁中');
  });
});
