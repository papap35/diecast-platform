/**
 * 開賣瞬間資料庫連線在做什麼：每 50ms 取樣一次 pg_stat_activity，統計 API 連線的狀態。
 *
 *   tsx loadtest/db-waits.ts <label>
 *
 * 讀 loadtest/.data/drop.json 的開賣時間，從開賣起取樣 SAMPLE_SECONDS 秒（預設 6），
 * 輸出 loadtest/.data/db-waits-<label>.json。狀態分成：
 * - 執行 SQL：連線正在資料庫裡跑查詢
 * - 等列鎖：卡在別的交易握著的列鎖（開賣時就是那件限量商品的庫存列）
 * - 交易中等 API：交易開著、資料庫已經做完，等 Node 送下一句 SQL 或 COMMIT
 * - 閒置：連線池裡沒被用到的連線
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const LABEL = process.argv[2] ?? 'run';
const SAMPLE_SECONDS = Number(process.env.SAMPLE_SECONDS ?? 6);
const INTERVAL_MS = 50;
const STATES = ['執行 SQL', '等列鎖', '交易中等 API', '閒置'] as const;
type State = (typeof STATES)[number];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }),
});

function classify(state: string | null, waitType: string | null): State | null {
  if (state === 'idle') return '閒置';
  if (state === 'idle in transaction') return '交易中等 API';
  if (state === 'active') return waitType === 'Lock' ? '等列鎖' : '執行 SQL';
  return null;
}

async function sample(): Promise<Record<State, number>> {
  const rows = await prisma.$queryRaw<
    { state: string | null; wait_type: string | null; n: number }[]
  >`
    SELECT state, wait_event_type AS wait_type, count(*)::int AS n
    FROM pg_stat_activity
    WHERE datname = current_database() AND backend_type = 'client backend' AND pid <> pg_backend_pid()
    GROUP BY 1, 2`;
  const counts = Object.fromEntries(STATES.map((s) => [s, 0])) as Record<State, number>;
  for (const row of rows) {
    const state = classify(row.state, row.wait_type);
    if (state) counts[state] += row.n;
  }
  return counts;
}

async function main(): Promise<void> {
  const { releaseAt } = JSON.parse(readFileSync('loadtest/.data/drop.json', 'utf8')) as {
    releaseAt: string;
  };
  const start = new Date(releaseAt).getTime();
  await prisma.$queryRaw`SELECT 1`;
  await sleep(Math.max(0, start - Date.now()));

  const samples: Record<State, number>[] = [];
  while (Date.now() < start + SAMPLE_SECONDS * 1000) {
    const t = Date.now();
    samples.push(await sample());
    await sleep(Math.max(0, INTERVAL_MS - (Date.now() - t)));
  }

  const avg = (s: State) => samples.reduce((sum, x) => sum + x[s], 0) / samples.length;
  const busy = STATES.filter((s) => s !== '閒置').reduce((sum, s) => sum + avg(s), 0);
  const result = {
    label: LABEL,
    seconds: SAMPLE_SECONDS,
    samples: samples.length,
    states: Object.fromEntries(
      STATES.map((s) => [
        s,
        {
          avg: Math.round(avg(s) * 10) / 10,
          max: Math.max(...samples.map((x) => x[s])),
          // 佔「有在用的連線」的比例（不含閒置）
          share: s === '閒置' || busy === 0 ? null : Math.round((avg(s) / busy) * 100),
        },
      ]),
    ),
  };
  writeFileSync(`loadtest/.data/db-waits-${LABEL}.json`, JSON.stringify(result, null, 2));
  console.log(`開賣後 ${SAMPLE_SECONDS} 秒的資料庫連線（取樣 ${samples.length} 次）：`);
  console.table(result.states);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
