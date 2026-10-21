# The prerender needs Chromium, so the build runs in the Playwright image of the locked version.
FROM mcr.microsoft.com/playwright:v1.61.1-noble AS build
WORKDIR /app
RUN corepack enable
ENV CI=true
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/backend/api/package.json apps/backend/api/
COPY apps/frontend/web/package.json apps/frontend/web/
COPY apps/frontend/mobile/package.json apps/frontend/mobile/
COPY packages/api-client/package.json packages/api-client/
COPY packages/database/package.json packages/database/
COPY packages/design-tokens/package.json packages/design-tokens/
COPY packages/domain/package.json packages/domain/
RUN pnpm install --frozen-lockfile --filter web...
COPY packages packages
COPY apps/frontend/web apps/frontend/web
# Same origin: the API is /api on the same host. The Google client ID is public, it ships in the bundle.
ENV VITE_API_URL= \
    VITE_GOOGLE_CLIENT_ID=563649081217-uh092o7iapi9t4d5a38d1522j8s66981.apps.googleusercontent.com
RUN pnpm --filter web build

FROM caddy:2.11.4-alpine
# Port 8080 needs no privilege. Without the file capability, Caddy starts under cap_drop ALL and no-new-privileges.
RUN setcap -r /usr/bin/caddy
USER nobody
COPY apps/frontend/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/frontend/web/dist /srv
EXPOSE 8080
