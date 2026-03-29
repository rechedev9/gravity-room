FROM oven/bun:latest AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
RUN bun install
ARG COMMIT_SHA
COPY . .
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN bun run build:web

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/security-headers.conf /etc/nginx/security-headers.conf

ARG COMMIT_SHA
LABEL org.opencontainers.image.source="https://github.com/rechedev9/gravity-room"
LABEL org.opencontainers.image.revision="${COMMIT_SHA}"

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
