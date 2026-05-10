# VPS Migration Design

**Date:** 2026-05-10
**Status:** Approved — execution starting same day
**Driver:** Cloudflare-edge incident on 2026-05-10 took the API offline (TCP timeouts to CF IPs while Railway origin was healthy). Decision: full migration to self-managed VPS with hard cutover.

## Context

API was on Railway behind Cloudflare proxy. Investigation (4-agent team, see issues.md) ruled out: app code, service worker, Railway origin. Root cause was at Cloudflare edge / network path between client and Cloudflare.

Cost was the original reason to leave VPS in commit `6876320` (2026-05-01). Hetzner Cloud CCX13 (~€13.50/mo total) keeps infra cost predictable and below the €15/mo ceiling the user set as constraint.

## Goals

- **Single-target deployment.** Only the VPS. No Railway as fallback after cutover.
- **Total monthly cost ≤ €15.**
- **No Cloudflare proxy on the request path.** Cloudflare remains as DNS-only (gray cloud).
- **Backups protect against corruption / accidental deletion.** Hetzner Volume Snapshots, daily, 7-day retention. Not offsite.
- **Deploys via GitHub Actions** → build → GHCR → SSH → `docker compose pull/up`.

## Non-Goals

- Multi-region / HA. Single-VPS SPOF accepted.
- Offsite backups (would add cost and complexity, deferred).
- Object storage (zero use today, confirmed by codebase scan).
- Observability stack beyond Sentry + Healthchecks.io free tier.

## Provider & Sizing

- **Hetzner Cloud CCX13** in Falkenstein (`fsn1`). 2 vCPU AMD EPYC (dedicated), 8 GB RAM, 80 GB NVMe root, 20 TB egress included. ~€12.49/mo + IPv4 €0.50/mo.
- **Hetzner Volume 10 GB** ext4, mounted at `/mnt/pg-vol`. Holds Postgres data dir. ~€0.40/mo + ~€0.50/mo for snapshots.
- **OS:** Ubuntu 24.04 LTS (Hetzner-provided image).
- **Total cost estimate: ~€13.50/mo.**

## Topology

```
                       Internet
                          │
                          ▼
                  ┌───────────────┐
                  │  Caddy :80/443│  ← TLS auto via Let's Encrypt
                  └───────────────┘
                          │
   ┌──────────────────────┼──────────────────────┐
   │                      │                      │
   ▼                      ▼                      ▼
api.gravityroom.app   gravityroom.app        www.gravityroom.app
reverse_proxy api:3001  ─── file_server /srv/web ───
                              │
                              │  internal Docker network "gr-net"
   ┌──────────────────────────┼──────────────────────────┐
   │                          │                          │
   ▼                          ▼                          ▼
 ┌─────┐                  ┌──────────┐              ┌──────────┐
 │ api │ ──┬──────────────│ postgres │              │ analytics│
 │(Bun)│   │              │ :5432    │              │(FastAPI) │
 └─────┘   │              └──────────┘              └──────────┘
           │              /var/lib/postgresql/data        │
           │              ↳ bind /mnt/pg-vol (Hetzner Volume + snapshots)
           ▼
        ┌───────┐
        │ redis │  ← tmpfs (cache only, no persistence)
        └───────┘
```

## Services (Docker Compose)

| Service     | Image                                            | Internal port             | Persistence                                          |
| ----------- | ------------------------------------------------ | ------------------------- | ---------------------------------------------------- |
| `caddy`     | `caddy:2-alpine`                                 | exposes :80, :443 to host | bind `./data/caddy` (TLS), bind `./data/web-dist:ro` |
| `api`       | `ghcr.io/rechedev9/gravity-room-api:<sha>`       | 3001                      | (stateless)                                          |
| `analytics` | `ghcr.io/rechedev9/gravity-room-analytics:<sha>` | 8000                      | (stateless)                                          |
| `postgres`  | `postgres:16-alpine`                             | 5432                      | bind `/mnt/pg-vol:/var/lib/postgresql/data`          |
| `redis`     | `redis:7-alpine`                                 | 6379                      | `tmpfs`                                              |

Each service has Compose-level healthchecks. `api` and `analytics` declare `depends_on: postgres: condition: service_healthy` so they wait for Postgres readiness on startup.

Only Caddy publishes ports to the host. Postgres / Redis / api / analytics are reachable only inside `gr-net`.

## Caddy / TLS

```caddyfile
{
    email rechedev@hotmail.com
}

api.gravityroom.app {
    encode zstd gzip
    reverse_proxy api:3001 {
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}

gravityroom.app, www.gravityroom.app {
    encode zstd gzip
    root * /srv/web
    try_files {path} /index.html
    file_server
    @html path *.html /
    header @html Cache-Control "no-cache"
    header /assets/* Cache-Control "public, max-age=31536000, immutable"
}
```

API receives real client IP via `X-Forwarded-For` (compatible with `TRUSTED_PROXY=true` already supported in code). SPA fallback (`try_files`) makes TanStack Router routes work. Hashed assets cached `immutable`, `index.html` `no-cache` so deploys are visible immediately.

## Persistence & Filesystem Layout

On the VPS, app root is `/opt/gravity-room/` owned by user `deploy`:

```
/opt/gravity-room/
├── docker-compose.yml      ← committed in repo, deployed via GitHub Actions
├── Caddyfile               ← committed in repo
├── .env                    ← chmod 600, NEVER in git, populated manually via SSH
└── data/
    ├── caddy/              ← TLS certs (Caddy auto-managed)
    └── web-dist/           ← SPA static files (rsync'd by deploy job)
/mnt/pg-vol/                ← Hetzner Volume mounted here, bound into postgres container
```

## Snapshots

Cron on the host (under `deploy` user):

```cron
0 4 * * *  /opt/gravity-room/scripts/snapshot.sh
```

`snapshot.sh` calls `hcloud volume create-snapshot pg-vol --description "auto-$(date +%F)"` and prunes any snapshot older than 7 days for the same volume. Cost: ~€0.012/GB/mo on data actually written.

Snapshots are NOT offsite — they live in the same Hetzner region as the volume. Documented and accepted: protects against corruption / accidental deletion, not against regional disaster.

## Secrets management

Three independent stores, no overlap:

1. **`.env` on VPS** (`/opt/gravity-room/.env`, chmod 600, owner `deploy`). Contains the 4 required (`DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_IDS`) plus opted-in optionals (`SENTRY_DSN`, `METRICS_TOKEN`, `TELEGRAM_*`, `ADMIN_USER_IDS`, `LOG_LEVEL`, `TRUSTED_PROXY=true`, `CORS_ORIGIN=https://gravityroom.app`). Populated once via SSH at provisioning. Never committed, never echoed in transcripts.
2. **GitHub repo secrets**: `VPS_HOST` (IP), `VPS_USER=deploy`, `VPS_SSH_KEY` (private key of dedicated deploy keypair). Used by GitHub Actions only.
3. **GHCR**: images are public (repo is public) → no pull auth needed. Push uses built-in `GITHUB_TOKEN`.

Deploy user `deploy` on VPS: no-root, in group `docker`, sudo limited to `systemctl restart docker`, SSH key only (no password), SSH on port 2222, `fail2ban` enabled.

## Deploy pipeline (`.github/workflows/deploy.yml`)

3 jobs:

```
build-images (matrix: api, analytics)
  └→ docker buildx build --cache-from/to gha
  └→ push ghcr.io/rechedev9/gravity-room-{api,analytics}:<sha> + :latest
build-web
  └→ bun install + bun run --filter web build
  └→ upload dist artifact
deploy
  needs: [build-images, build-web]
  └→ download dist artifact
  └→ rsync dist/ to deploy@VPS:/opt/gravity-room/data/web-dist/
  └→ ssh deploy@VPS "cd /opt/gravity-room && docker compose pull && docker compose up -d --remove-orphans"
  └→ ssh: docker compose ps + curl https://api.gravityroom.app/health → fail if !=200
```

Triggers: push to `main`, `workflow_dispatch`. Tag strategy: `<git-sha>` + `latest`. Rollback = SSH, edit compose `image:` to previous SHA, `up -d`.

## Monitoring (minimal)

- **Sentry** — env var, optional. No new infra.
- **Healthchecks.io free** — cron on VPS pings `ping.healthchecks.io/<uuid>` every 5 min only if `curl localhost/health` returns 200. If pings stop, alert via Telegram (uses existing bot from `TELEGRAM_BOT_TOKEN`).
- **Logs** — `docker compose logs` + `journalctl`. No Loki, no Grafana, no Prometheus. Add later if/when an incident shows we need it.

## Cutover plan (hard cutover, no parallel period)

### Phase 0 — Provisioning (no production impact)

1. Create VPS + Volume + Firewall + SSH key in Hetzner via `hcloud` CLI.
2. SSH-bootstrap script (idempotent): apt updates, install Docker + Compose + `hcloud` CLI + `fail2ban`, create `deploy` user, format & mount Volume to `/mnt/pg-vol`, configure SSH on port 2222 (key-only), open firewall ports 80/443/2222.
3. `git clone` repo to `/opt/gravity-room/`. `cp .env.example .env` + manual SSH paste of secrets (never via chat transcript).
4. First push of images: `workflow_dispatch` of `deploy.yml` from `main`.
5. `docker compose up -d` on VPS.
6. Test against VPS IP without DNS change: `curl --resolve api.gravityroom.app:443:<vps-ip> https://api.gravityroom.app/health`. Verify SPA loads, OAuth login works, `/api/programs` responds.

### Phase 1 — Cutover (10–15 min downtime window)

1. Lower TTL to 60s on Cloudflare for `api`, `www`, apex records. Wait ~5 min for propagation.
2. Stop Railway api service (induces visible outage from this point).
3. `pg_dump --format=custom --no-owner --no-acl` from Railway Postgres → `pg_restore` into VPS Postgres.
4. Smoke test against VPS IP using `--resolve` (login, programs, results).
5. Cutover DNS: change A records for `api`, `www`, apex in Cloudflare to VPS IP. Keep gray cloud (DNS-only).
6. Verify: `dig` from external + open `gravityroom.app` in browser + login + record a workout.

### Phase 2 — Tear-down (no parallel period)

After Phase 1 smoke test passes:

1. Stop all Railway services.
2. Delete Railway project.
3. Delete `VPS_HOST`/`VPS_USER`/etc. GitHub Secrets that no longer apply (rotate to new values for VPS).
4. Confirm monthly cost reduction in next billing cycle.

## Rollback

**During Phase 1 only** (window between DNS cutover and Railway deletion):

- Revert Cloudflare A records to Railway IP. Resolves in ~60s with TTL 60s.
- Any data written to VPS in interim is lost. Mitigated by short window.

**After Railway deletion**: forward-fix only. Documented and accepted.

## Risks accepted (documented decisions)

- **SPOF**: single VPS in single DC. If Falkenstein has a regional outage, app is down.
- **Backups not offsite**: snapshots live in same region. Protects against corruption / accidental delete, not regional disaster.
- **No Railway fallback after cutover**: hard cutover means no rollback path past Phase 2.
- **No automated migration tests** for the pg_dump/restore — relying on smoke test of golden paths post-restore.
- **Volume snapshots are full, not incremental**: cost scales with retention × data size; mitigated by 7-day cap and small data volume (<1 GB).

## Out of scope (deferred)

- Offsite backups to Backblaze B2 / Cloudflare R2 (revisit if data ≥10 GB or compliance requires).
- Loki/Promtail/Grafana log aggregation (revisit if `journalctl` becomes insufficient).
- Multi-region / HA setup (revisit if traffic justifies).
- Coolify / Dokploy PaaS layer (rejected as redundant complexity).
- Migrating DNS off Cloudflare to Hetzner DNS (cosmetic, no functional benefit).
