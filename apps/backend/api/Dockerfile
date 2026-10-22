# The API on the VPS: esbuild bundles the server and the migration step, so the image needs no node_modules
# except the native argon2 binding. The env check and the migrations run before the server starts.
FROM node:24.18.0-slim AS build
WORKDIR /app
RUN corepack enable
ENV CI=true
# Every workspace manifest, so the frozen lockfile matches the workspace.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/backend/api/package.json apps/backend/api/
COPY apps/frontend/web/package.json apps/frontend/web/
COPY apps/frontend/mobile/package.json apps/frontend/mobile/
COPY packages/api-client/package.json packages/api-client/
COPY packages/database/package.json packages/database/
COPY packages/design-tokens/package.json packages/design-tokens/
COPY packages/domain/package.json packages/domain/
RUN pnpm install --frozen-lockfile --filter api... --ignore-scripts
COPY packages/domain packages/domain
COPY packages/database packages/database
COPY apps/backend/api apps/backend/api
# The banner gives bundled CommonJS packages the `require` that ESM lacks.
RUN apps/backend/api/node_modules/.bin/esbuild apps/backend/api/src/dev-server.ts apps/backend/api/src/scripts/migrate-deploy.ts \
      apps/backend/api/scripts/check-env.ts \
      --bundle --platform=node --format=esm --target=node24 --external:@node-rs/argon2 \
      --entry-names=[name] --out-extension:.js=.mjs --outdir=/out/dist --log-level=warning \
      --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" \
 && argon2="$(readlink -f apps/backend/api/node_modules/@node-rs/argon2)" \
 && mkdir -p /out/node_modules/@node-rs \
 && cp -rL "$argon2" "$(dirname "$argon2")/argon2-linux-x64-gnu" /out/node_modules/@node-rs/ \
 && cp -r packages/database/migrations /out/migrations

FROM node:24.18.0-slim
WORKDIR /app
# MIGRATIONS_DIR resolves to ../migrations from the bundle in dist.
COPY --from=build /out ./
ENV NODE_ENV=production
USER node
EXPOSE 3001
# A bad env fails before any DDL, so a rollback finds the schema untouched.
CMD ["sh", "-c", "node dist/check-env.mjs && node dist/migrate-deploy.mjs && exec node dist/dev-server.mjs"]
