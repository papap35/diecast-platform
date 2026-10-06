/**
 * 限量發售壓力測試（k6）。
 *
 * 情境：開賣瞬間 N 位會員同時對同一個限量商品結帳（每人一次），
 * 同時間商品頁有穩定的瀏覽流量。驗證：
 * - 成立訂單數剛好等於庫存，其餘回應「售完」，沒有任何非預期錯誤
 * - 開賣尖峰時瀏覽商品頁的延遲
 *
 * 執行（先用 drop-data.ts prepare 準備資料）：
 *   k6 run -e LABEL=gate-on loadtest/drop.k6.js
 */
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import http from 'k6/http';
import { SharedArray } from 'k6/data';
import { Counter, Trend } from 'k6/metrics';

const data = JSON.parse(open('./.data/drop.json'));
const tokens = new SharedArray('tokens', () => data.tokens);
// 多個 API 執行個體以逗號分隔，請求依序分配（模擬負載平衡）
const APIS = (__ENV.API_URLS || 'http://localhost:4000').split(',');
const api = (n) => APIS[n % APIS.length];
const LABEL = __ENV.LABEL || 'run';
const releaseAt = new Date(data.releaseAt).getTime();

const created = new Counter('orders_created');
const soldOut = new Counter('orders_sold_out');
const unexpected = new Counter('orders_unexpected');
const checkoutTime = new Trend('checkout_time', true);
const soldOutTime = new Trend('sold_out_response_time', true);

export const options = {
  scenarios: {
    drop: {
      executor: 'per-vu-iterations',
      vus: tokens.length,
      iterations: 1,
      maxDuration: '3m',
      exec: 'buy',
    },
    browse: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.BROWSE_RPS || 100),
      timeUnit: '1s',
      duration: __ENV.BROWSE_DURATION || '90s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      exec: 'browse',
    },
  },
  thresholds: {
    orders_unexpected: ['count==0'],
    checks: ['rate==1'],
    // 設定門檻才會在摘要中產生「瀏覽情境」的延遲子指標
    'http_req_duration{scenario:browse}': ['p(95)<2000'],
    'http_reqs{scenario:browse}': ['count>0'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const ORDER = {
  shippingMethod: 'CVS_711',
  recipientName: '壓測會員',
  recipientPhone: '0912345678',
  cvsStoreId: '131386',
  cvsStoreName: '7-ELEVEN 建國門市',
  cvsStoreAddress: '臺北市中山區建國北路一段 100 號',
  invoiceType: 'MEMBER_CARRIER',
  items: [{ productId: data.productId, quantity: 1 }],
};

export function buy() {
  // 所有 VU 等到開賣時間同時送出，模擬整點搶購
  const wait = (releaseAt - Date.now()) / 1000;
  if (wait > 0) sleep(wait);
  // __VU 是全測試共用的編號（瀏覽情境的 VU 也會佔號），改用本情境內的迭代序號對應會員
  const token = tokens[exec.scenario.iterationInTest];
  const res = http.post(`${api(exec.scenario.iterationInTest)}/v1/orders`, JSON.stringify(ORDER), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    tags: { name: 'checkout' },
  });
  if (res.status === 201) {
    created.add(1);
    checkoutTime.add(res.timings.duration);
  } else if (res.status === 409 && res.json('error.code') === 'OUT_OF_STOCK') {
    soldOut.add(1);
    soldOutTime.add(res.timings.duration);
  } else {
    unexpected.add(1);
    console.warn(`非預期回應 ${res.status}: ${res.body && res.body.slice(0, 200)}`);
  }
  check(res, { 成立或售完: (r) => r.status === 201 || r.status === 409 });
}

export function browse() {
  const res = http.get(`${api(exec.scenario.iterationInTest)}/v1/products/${data.slug}`, {
    tags: { name: 'product' },
  });
  check(res, { '商品頁 200': (r) => r.status === 200 });
}

export function handleSummary(summary) {
  const metric = (name, stat) => summary.metrics[name]?.values?.[stat];
  const result = {
    label: LABEL,
    instances: APIS.length,
    members: tokens.length,
    stock: data.stock,
    created: metric('orders_created', 'count') ?? 0,
    soldOut: metric('orders_sold_out', 'count') ?? 0,
    unexpected: metric('orders_unexpected', 'count') ?? 0,
    checkout: pick(summary.metrics.checkout_time),
    soldOutResponse: pick(summary.metrics.sold_out_response_time),
    browse: pick(summary.metrics['http_req_duration{scenario:browse}']),
    browseRequests: metric('http_reqs{scenario:browse}', 'count'),
  };
  return {
    [`loadtest/.data/summary-${LABEL}.json`]: JSON.stringify(result, null, 2),
    stdout: `\n${JSON.stringify(result, null, 2)}\n`,
  };
}

function pick(trend) {
  if (!trend) return null;
  const v = trend.values;
  return {
    med: round(v.med),
    p95: round(v['p(95)']),
    p99: round(v['p(99)']),
    max: round(v.max),
  };
}

function round(value) {
  return value === undefined ? null : Math.round(value * 10) / 10;
}
