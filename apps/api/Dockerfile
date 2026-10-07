# syntax=docker/dockerfile:1.7
#
# Paddock 64 API 正式環境映像。建置內容（context）是 monorepo 根目錄：
#   docker build -f apps/api/Dockerfile -t paddock64-api .
#
# 部署前執行資料庫遷移（Railway 的 preDeployCommand）：
#   npx prisma migrate deploy

ARG NODE_VERSION=22.17

FROM node:${NODE_VERSION}-bookworm-slim AS base
# Prisma 的 schema engine（遷移用）需要 OpenSSL 3
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

# 只複製 manifest 與 Prisma schema：原始碼變動不會讓安裝依賴這一層失效
FROM base AS manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma

# ── 編譯 ──
FROM manifests AS build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @paddock64/api
COPY apps/api apps/api
RUN pnpm --filter @paddock64/api build

# ── 正式環境依賴：不含開發工具（prisma CLI 是正式依賴，部署前要跑 migrate deploy） ──
FROM manifests AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --prod --filter @paddock64/api

# ── 執行映像 ──
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=4000
WORKDIR /repo
COPY --from=prod-deps --chown=node:node /repo/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /repo/apps/api/dist ./apps/api/dist
COPY --chown=node:node apps/api/package.json apps/api/prisma.config.ts ./apps/api/
COPY --chown=node:node apps/api/prisma ./apps/api/prisma
COPY --chown=node:node apps/api/public ./apps/api/public
WORKDIR /repo/apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/v1/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/main.js"]
