# Build context is the repo root (see docker-compose.yml services.api.build.context).
FROM oven/bun:latest
WORKDIR /app

# Workspace manifests + the shared domain package must be present before
# `bun install` so that `@gzclp/domain: workspace:*` resolves to the in-tree
# package and the workspace graph (apps/backend/*, apps/frontend/*) loads
# without missing-manifest errors.
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/backend/api/package.json ./apps/backend/api/
COPY apps/frontend/web/package.json ./apps/frontend/web/
COPY apps/frontend/mobile/package.json ./apps/frontend/mobile/
COPY packages ./packages
RUN bun install

COPY apps/backend/api ./apps/backend/api

ARG COMMIT_SHA
LABEL org.opencontainers.image.source="https://github.com/rechedev9/gravity-room"
LABEL org.opencontainers.image.revision="${COMMIT_SHA}"

EXPOSE 3001
WORKDIR /app/apps/backend/api
CMD ["bun", "src/index.ts"]
