/** 橫幅底色（與前台 PromoBanners 相同）；放在一般模組，Server 與 Client Component 都能讀取 */
export const BANNER_THEMES = ['INK', 'RED', 'NAVY', 'GOLD'] as const;

export const THEME_COLORS: Record<(typeof BANNER_THEMES)[number], string> = {
  INK: '#16161a',
  RED: '#a91c15',
  NAVY: '#1d3f6e',
  GOLD: '#7a5a12',
};
