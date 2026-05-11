# Containers & App Runtime Hardening — Research

> Scope: Gravity Room production stack on a single Hetzner VPS, Docker Compose
> v2, services `caddy / api / analytics / postgres / redis`. Sources: official
> docs (docker.com, hub.docker.com, bun.com, fastapi.tiangolo.com, NIST).
> Cutoff verified May 2026.

## Verified versions (May 2026)

| Component      | In repo                  | Verified              |
| -------------- | ------------------------ | --------------------- |
| Bun            | `oven/bun:1.3.10-alpine` | 1.3.x active          |
| Python         | `python:3.12-slim`       | 3.12 LTS              |
| Uvicorn        | `0.34.0`                 | 0.34 latest           |
| FastAPI        | `0.115.6`                | 0.115 latest          |
| Postgres image | `postgres:18-alpine`     | 18-alpine / -bookworm |
| Redis image    | `redis:7-alpine`         | 7-alpine              |
| Caddy          | `caddy:2-alpine`         | 2.x                   |

NIST SP 800-190 (2017) remains current container security guidance.

## Current state (quoted)

`/home/reche/projects/TrackerRSN/docker-compose.yml`:

```
api:
  image: ghcr.io/rechedev9/gravity-room-api:${IMAGE_TAG:-latest}
  restart: unless-stopped
  env_file: .env
  networks: [gr-net]
  ...
postgres:
  image: postgres:18-alpine
  volumes:
    - /mnt/pg-vol:/var/lib/postgresql
```

No service has `read_only`, `cap_drop`, `security_opt`, `pids_limit`,
`mem_limit`, `cpus`, `user`, or `logging:`. api/analytics/postgres/redis
correctly do NOT publish ports — only `caddy` exposes 80/443.

`apps/backend/api/Dockerfile`:

```
FROM oven/bun:1.3.10-alpine
RUN apk add --no-cache curl tini
...
ENV NODE_ENV=production PORT=3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bun", "src/index.ts"]
```

Multi-stage (deps → runtime) — good. No `USER` directive — runs as root.

`apps/backend/analytics/Dockerfile`:

```
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl tini ...
...
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Single-stage; runs as root; tini already present.

DB pool in `apps/backend/api/src/db/index.ts`: `max: poolSize` defaults to
**50** via `DB_POOL_SIZE`. With Postgres default `max_connections=100`, 50
per API instance leaves no headroom for analytics/migrations. Too high.

## Gaps vs official best practice

| #   | Gap                                                                | Severity |
| --- | ------------------------------------------------------------------ | -------- |
| 1   | All services run as root inside container                          | P0       |
| 2   | No `security_opt: [no-new-privileges:true]`                        | P0       |
| 3   | No `cap_drop: [ALL]` + targeted `cap_add`                          | P0       |
| 4   | No `read_only: true` root filesystem                               | P1       |
| 5   | No resource limits (`mem_limit`, `cpus`, `pids_limit`)             | P1       |
| 6   | No log rotation declared per-service (relies on daemon defaults)   | P1       |
| 7   | `IMAGE_TAG=latest` default + no digest pinning                     | P1       |
| 8   | DB pool `max=50` is too large for the box                          | P1       |
| 9   | Postgres on `alpine` — Postgres community has weaker musl coverage | P2       |
| 10  | `env_file: .env` for secrets — workable but not best-practice      | P2       |
| 11  | No image scanning in CI                                            | P2       |

## Recommendations

### P0 — must do before next deploy

**P0-1. Run every container as non-root.**

- `oven/bun` images ship a `bun` user (uid 1000)
  ([Bun Docker guide](https://bun.com/docs/guides/ecosystem/docker)). Add
  `USER bun` after copy + chown.
- `python:3.12-slim` has no app user — create one. NIST SP 800-190 §4.4.4:
  "containers should run as a non-root user."
- Compose `user: "10001:10001"` is a defence-in-depth fallback.

**P0-2. `security_opt: [no-new-privileges:true]` on all services.**
Blocks setuid escalation inside containers. Cited as foundational by
[Docker Engine security](https://docs.docker.com/engine/security/).

**P0-3. `cap_drop: [ALL]` + minimal `cap_add`.**

- `caddy`: needs `NET_BIND_SERVICE` (ports 80/443).
- `api`, `analytics`, `postgres`, `redis`: zero caps needed — high ports
  over the internal bridge. DNS still works on the default bridge without
  `NET_RAW` (we don't use raw sockets/ICMP).

### P1 — within this hardening pass

**P1-1. `read_only: true` + targeted `tmpfs`.**

- `api`, `analytics`: `tmpfs: [/tmp]`.
- `caddy`: `/data` is already a bind mount — add `read_only: true` plus
  `tmpfs: [/tmp, /config]`.
- `redis`: already has `tmpfs: [/data]`; add `read_only: true`.
- `postgres`: skip (data dir is the point).

**P1-2. Resource limits.** Compose v2 maps these to cgroups without Swarm.
Suggested starting points: api 768m / 1.5 cpu, analytics 512m / 1.0 cpu,
postgres 1g / 1.5 cpu, redis 320m / 0.5 cpu, caddy 256m / 0.5 cpu;
`pids_limit: 100–300` per service.

**P1-3. Per-service log rotation.** `json-file` defaults to `max-size: -1`
(unlimited) per
[Docker json-file driver](https://docs.docker.com/engine/logging/drivers/json-file/).
Set `max-size: 10m, max-file: 3` via a YAML anchor.

**P1-4. Pin images by digest.** Convert all five images to
`name:tag@sha256:...`. Use Renovate's `docker:pinDigests` preset
([Renovate docs](https://docs.renovatebot.com/docker/)).

**P1-5. Drop `DB_POOL_SIZE` to 15.** PostgreSQL pool sizing formula is
`(cores * 2) + spindles` per app instance. 50 is wasteful on a 2–4 vCPU
box and risks exhausting `max_connections=100` under failure.

### P2 — nice-to-have / follow-ups

**P2-1. Analytics Dockerfile: multi-stage + non-root, retain `tini`.**
`tini` stays useful even with exec-form `CMD`: APScheduler spawns threads
and pip wheels occasionally fork helpers; tini reaps zombies cleanly
([Kludex/uvicorn#2257](https://github.com/Kludex/uvicorn/discussions/2257)).

**P2-2. uvicorn — keep single worker.** FastAPI's
[deployment guide](https://fastapi.tiangolo.com/deployment/server-workers/)
recommends a single uvicorn process per container under external
orchestration; `tiangolo/uvicorn-gunicorn-fastapi` is officially
deprecated. Analytics is CPU-bound on ML libs — workers would only
multiply memory.

**P2-3. Postgres → `postgres:18-bookworm`.** The
[official postgres image](https://hub.docker.com/_/postgres) notes Alpine
has weaker musl coverage in the Postgres community build farm and harder
extension installs. Image-size delta (~160 MB) is irrelevant on this disk.

**P2-4. Bun runtime.** `NODE_ENV=production` is set. `--smol` trades
perf for lower heap growth — enable only if RSS becomes a problem
([bun runtime](https://bun.com/docs/runtime)).

**P2-5. Secrets.** Compose v2 `secrets:` with `file:` source DOES work
outside Swarm — Docker mounts them under `/run/secrets/<name>`
([Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)).
Realistic stance: keep `env_file: .env` for now, but enforce
`chmod 600 /opt/gravity-room/.env` (host pass) — the .env file IS the
trust boundary.

**P2-6. Image scanning.** Recommend **Docker Scout** (native to Build/Push)

- **Grype** as a second opinion. Avoid Trivy until its March-2026 supply
  chain incident clears (DB updates paused).

## Proposed `docker-compose.yml` diff

```yaml
name: gravity-room

x-logging: &default-logging
  driver: json-file
  options:
    max-size: '10m'
    max-file: '3'

x-security: &default-security
  security_opt:
    - no-new-privileges:true
  cap_drop: [ALL]
  restart: unless-stopped
  logging: *default-logging

services:
  caddy:
    image: caddy:2-alpine@sha256:REPLACE_ME
    <<: *default-security
    cap_add:
      - NET_BIND_SERVICE
    ports: ['80:80', '443:443']
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./data/caddy:/data
      - ./data/web-dist:/srv/web:ro
    read_only: true
    tmpfs:
      - /tmp
      - /config
    networks: [gr-net]
    mem_limit: 256m
    cpus: 0.5
    pids_limit: 100
    depends_on: { api: { condition: service_healthy } }

  api:
    image: ghcr.io/rechedev9/gravity-room-api:${IMAGE_TAG:-latest}@sha256:REPLACE_ME
    <<: *default-security
    user: '1000:1000' # the `bun` user from oven/bun
    env_file: .env
    read_only: true
    tmpfs: [/tmp]
    networks: [gr-net]
    mem_limit: 768m
    cpus: 1.5
    pids_limit: 200
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    healthcheck:
      test: ['CMD', 'curl', '-fsS', 'http://localhost:3001/health']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

  analytics:
    image: ghcr.io/rechedev9/gravity-room-analytics:${IMAGE_TAG:-latest}@sha256:REPLACE_ME
    <<: *default-security
    user: '10001:10001' # created in Dockerfile (see below)
    env_file: .env
    read_only: true
    tmpfs: [/tmp]
    networks: [gr-net]
    mem_limit: 512m
    cpus: 1.0
    pids_limit: 200
    depends_on:
      postgres: { condition: service_healthy }
    healthcheck:
      test: ['CMD', 'curl', '-fsS', 'http://localhost:8000/health']
      interval: 60s
      timeout: 5s
      retries: 3
      start_period: 20s

  postgres:
    image: postgres:18-alpine@sha256:REPLACE_ME # P2: move to 18-bookworm
    <<: *default-security
    env_file: .env
    volumes:
      - /mnt/pg-vol:/var/lib/postgresql
    networks: [gr-net]
    mem_limit: 1g
    cpus: 1.5
    pids_limit: 300
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U $${POSTGRES_USER}']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  redis:
    image: redis:7-alpine@sha256:REPLACE_ME
    <<: *default-security
    command:
      [
        'redis-server',
        '--save',
        '',
        '--appendonly',
        'no',
        '--maxmemory',
        '256mb',
        '--maxmemory-policy',
        'allkeys-lru',
      ]
    read_only: true
    tmpfs: [/data]
    networks: [gr-net]
    mem_limit: 320m
    cpus: 0.5
    pids_limit: 100
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 3s
      retries: 5

networks:
  gr-net:
    driver: bridge
```

## Proposed Dockerfile changes

**API (`apps/backend/api/Dockerfile`)** — add non-root user, chown, smaller
attack surface:

```dockerfile
FROM oven/bun:1.3.10-alpine AS deps
# ... unchanged ...

FROM oven/bun:1.3.10-alpine
RUN apk add --no-cache curl tini
WORKDIR /app
COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=deps --chown=bun:bun /app/packages/domain/node_modules ./packages/domain/node_modules
COPY --from=deps --chown=bun:bun /app/apps/backend/api/node_modules ./apps/backend/api/node_modules
COPY --chown=bun:bun package.json bun.lock ./
COPY --chown=bun:bun packages/domain ./packages/domain
COPY --chown=bun:bun apps/backend/api ./apps/backend/api
WORKDIR /app/apps/backend/api
ENV NODE_ENV=production PORT=3001
USER bun
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3001/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bun", "src/index.ts"]
```

**Analytics (`apps/backend/analytics/Dockerfile`)** — multi-stage, non-root
user, retain tini:

```dockerfile
# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY apps/backend/analytics/requirements.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 app \
    && useradd  --system --uid 10001 --gid 10001 --home-dir /app --shell /usr/sbin/nologin app
COPY --from=deps /install /usr/local
WORKDIR /app
COPY --chown=app:app apps/backend/analytics ./
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8000/health || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Open questions

1. Confirm migrate-on-boot still works as the `bun` user (bootstrap writes
   nothing on disk, but worth a staging smoke test).
2. Caddy `read_only: true` may need extra `tmpfs` paths if `auto_https`
   triggers config writes — verify in staging.
3. Migrate `env_file` → compose `secrets:` now or later? Defer to host
   teammate.
4. `pids_limit` numbers are estimates; tune after rollout.

## Sources

- [Docker Engine security](https://docs.docker.com/engine/security/) — capabilities, `no-new-privileges`.
- [Compose secrets reference](https://docs.docker.com/compose/how-tos/use-secrets/) — file-source works outside Swarm.
- [json-file logging driver](https://docs.docker.com/engine/logging/drivers/json-file/) — defaults.
- [Bun Docker guide](https://bun.com/docs/guides/ecosystem/docker) + [runtime](https://bun.com/docs/runtime).
- [FastAPI deployment / workers](https://fastapi.tiangolo.com/deployment/server-workers/); [tiangolo image deprecation](https://github.com/tiangolo/uvicorn-gunicorn-fastapi-docker).
- [Postgres official image](https://hub.docker.com/_/postgres).
- [Renovate Docker](https://docs.renovatebot.com/docker/) (`docker:pinDigests`).
- [Uvicorn graceful shutdown #2257](https://github.com/Kludex/uvicorn/discussions/2257).
- [NIST SP 800-190](https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-190.pdf); [OWASP Docker Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html).
- Drizzle pool sizing — [drizzle-orm#947](https://github.com/drizzle-team/drizzle-orm/discussions/947).
