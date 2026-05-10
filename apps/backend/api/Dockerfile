# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3.10-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/domain/package.json ./packages/domain/
COPY apps/backend/api/package.json ./apps/backend/api/
COPY apps/frontend/web/package.json ./apps/frontend/web/
COPY apps/frontend/mobile/package.json ./apps/frontend/mobile/
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.10-alpine
RUN apk add --no-cache curl tini
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY packages/domain ./packages/domain
COPY apps/backend/api ./apps/backend/api
WORKDIR /app/apps/backend/api
ENV NODE_ENV=production PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3001/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bun", "src/index.ts"]
