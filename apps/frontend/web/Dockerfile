FROM oven/bun:latest AS build
WORKDIR /app
# Workspace manifests + the shared domain package must be present before
# `bun install` so that `@gzclp/domain: workspace:*` resolves to the in-tree
# package and the workspace graph loads without missing-manifest errors.
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/backend/api/package.json ./apps/backend/api/
COPY apps/frontend/web/package.json ./apps/frontend/web/
COPY apps/frontend/mobile/package.json ./apps/frontend/mobile/
COPY packages ./packages
RUN bun install
ARG COMMIT_SHA
COPY . .
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN bun run build:web && chmod -R a+r /app/apps/frontend/web/dist

FROM nginx:alpine
COPY --from=build /app/apps/frontend/web/dist /usr/share/nginx/html
COPY apps/frontend/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/frontend/web/security-headers.conf /etc/nginx/security-headers.conf

ARG COMMIT_SHA
LABEL org.opencontainers.image.source="https://github.com/rechedev9/gravity-room"
LABEL org.opencontainers.image.revision="${COMMIT_SHA}"

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
