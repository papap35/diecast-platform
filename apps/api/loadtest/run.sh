#!/usr/bin/env bash
# 限量發售壓力測試：準備資料 → k6 → 驗證沒有超賣，並記錄期間的資料庫交易數。
# 需要先以 RATE_LIMIT_PER_MINUTE 放寬全域限流啟動 API（所有請求都來自同一個 IP）。
#   LABEL=gate-on bash loadtest/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
LABEL=${LABEL:-run}
DB_URL=${DATABASE_URL:-$(grep '^DATABASE_URL=' .env | cut -d= -f2-)}
xacts() {
  psql "$DB_URL" -Atc "SELECT xact_commit || ' ' || xact_rollback FROM pg_stat_database WHERE datname = current_database()"
}

npx tsx loadtest/drop-data.ts prepare
read -r commit_before rollback_before <<<"$(xacts)"
# 開賣瞬間另外取樣資料庫連線狀態（等列鎖、交易中等 API…）
npx tsx loadtest/db-waits.ts "$LABEL" > "loadtest/.data/db-waits-$LABEL.txt" 2>&1 &
sampler=$!
k6 run -q -e LABEL="$LABEL" -e API_URLS="${API_URLS:-http://localhost:4000}" \
  -e BROWSE_RPS="${BROWSE_RPS:-100}" -e BROWSE_DURATION="${BROWSE_DURATION:-70s}" \
  loadtest/drop.k6.js || true
read -r commit_after rollback_after <<<"$(xacts)"
wait "$sampler" || true
cat "loadtest/.data/db-waits-$LABEL.txt"
echo "資料庫交易：提交 $((commit_after - commit_before))、回滾 $((rollback_after - rollback_before))（含瀏覽、排程與取樣）"
npx tsx loadtest/drop-data.ts verify
