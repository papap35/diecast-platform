import { escapeHtml as escape } from '../../common/http/html.js';
import type { CvsMethod } from './logistics-provider.js';

export interface MockStore {
  id: string;
  name: string;
  address: string;
}

const CHAIN_NAME: Record<CvsMethod, string> = {
  CVS_711: '7-ELEVEN',
  CVS_FAMILY: '全家便利商店',
  CVS_HILIFE: '萊爾富',
  CVS_OKMART: 'OK mart',
};

/** 模擬電子地圖的門市（示範資料，非真實門市清單） */
export const MOCK_STORES: Record<CvsMethod, MockStore[]> = {
  CVS_711: [
    { id: '131386', name: '7-ELEVEN 建國門市', address: '臺北市中山區建國北路一段 100 號' },
    { id: '172925', name: '7-ELEVEN 逢甲門市', address: '臺中市西屯區福星路 300 號' },
    { id: '991182', name: '7-ELEVEN 文化門市', address: '高雄市苓雅區文化路 66 號' },
  ],
  CVS_FAMILY: [
    { id: '011385', name: '全家 板橋文化店', address: '新北市板橋區文化路一段 188 號' },
    { id: '001779', name: '全家 新竹光復店', address: '新竹市東區光復路二段 101 號' },
    { id: '016820', name: '全家 臺南成大店', address: '臺南市東區大學路 18 號' },
  ],
  CVS_HILIFE: [
    { id: '2001', name: '萊爾富 松山民生店', address: '臺北市松山區民生東路四段 55 號' },
    { id: 'F227', name: '萊爾富 桃園中正店', address: '桃園市桃園區中正路 520 號' },
  ],
  CVS_OKMART: [
    { id: '1328', name: 'OK mart 中和景平店', address: '新北市中和區景平路 260 號' },
    { id: '1095', name: 'OK mart 嘉義興業店', address: '嘉義市西區興業西路 88 號' },
  ],
};

/** 模擬超商電子地圖：選一間門市後送回 API，再導回前台結帳頁 */
export function renderMockMapPage(token: string, method: CvsMethod): string {
  const stores = MOCK_STORES[method];
  const options = stores
    .map(
      (store, index) => `<label class="store">
        <input type="radio" name="storeId" value="${escape(store.id)}"${index === 0 ? ' checked' : ''}>
        <span><strong>${escape(store.name)}</strong><small>${escape(store.address)} · 店號 ${escape(store.id)}</small></span>
      </label>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>模擬超商電子地圖 Mock CVS Map</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font-family: system-ui, -apple-system, "Noto Sans TC", sans-serif; background: #f2f1ee; color: #18181b; display: grid; place-items: center; min-height: 100vh; }
  .card { width: min(460px, calc(100vw - 32px)); background: #fff; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,.08); overflow: hidden; }
  .banner { background: #fef3c7; color: #92400e; font-size: 13px; padding: 10px 20px; }
  .body { padding: 24px 20px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .muted { color: #71717a; font-size: 13px; margin: 0 0 16px; }
  form { display: grid; gap: 10px; }
  .store { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border: 1px solid #e4e4e7; border-radius: 12px; cursor: pointer; }
  .store:has(input:checked) { border-color: #18181b; box-shadow: inset 0 0 0 1px #18181b; }
  .store input { margin-top: 3px; }
  .store span { display: grid; gap: 2px; }
  .store small { color: #71717a; font-size: 12px; }
  button { font: inherit; font-weight: 600; border: 0; border-radius: 10px; padding: 14px; cursor: pointer; }
  .pick { background: #18181b; color: #fff; margin-top: 6px; }
  .cancel { background: transparent; color: #71717a; padding: 8px; }
  @media (prefers-color-scheme: dark) {
    body { background: #0c0c0e; color: #f4f4f5; }
    .card { background: #18181b; }
    .store { border-color: #3f3f46; }
    .store:has(input:checked) { border-color: #f4f4f5; box-shadow: inset 0 0 0 1px #f4f4f5; }
    .pick { background: #f4f4f5; color: #18181b; }
  }
</style>
</head>
<body>
  <main class="card">
    <div class="banner">這是模擬電子地圖，門市為示範資料 · Demo store picker</div>
    <div class="body">
      <h1>選擇 ${escape(CHAIN_NAME[method])} 取貨門市</h1>
      <p class="muted">正式環境會開啟綠界超商電子地圖。</p>
      <form method="post" action="/v1/logistics/mock/map/${escape(token)}">
        ${options}
        <button class="pick" type="submit">選擇這間門市 · Select</button>
        <button class="cancel" type="submit" name="action" value="cancel" formnovalidate>取消 · Cancel</button>
      </form>
    </div>
  </main>
</body>
</html>`;
}
