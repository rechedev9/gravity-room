# Gravity Room Infra — Bottom-Up Hardening & Scaling Design

**Date:** 2026-05-11
**Status:** Approved by user 2026-05-11 — implementation plan to follow in [`06-implementation-plan.md`](./06-implementation-plan.md)
**Successor relationship:** Complements (does not supersede)
[`2026-05-10-vps-migration-design.md`](../2026-05-10-vps-migration-design.md).
That spec locked the **shape** (Hetzner CCX13 single-VPS, no Cloudflare,
hard cutover from Railway). This spec defines the **hardening and scale
path** on that shape.

**Authoring:** synthesised by `team-lead` from five research streams executed
in parallel on 2026-05-11. Source files in this same folder:

- [`01-host-os.md`](./01-host-os.md) — host OS, network, SSH, Docker daemon
- [`02-edge-caddy.md`](./02-edge-caddy.md) — Caddy v2 edge + security headers
- [`03-containers-runtime.md`](./03-containers-runtime.md) — Compose/Dockerfile hardening
- [`04-data-pg-redis.md`](./04-data-pg-redis.md) — Postgres 18 + Valkey 9, WAL-G backups
- [`05-cicd-observability.md`](./05-cicd-observability.md) — supply chain, deploy, observability

Every claim in this master doc cites an upstream research file by section.
Every research file cites primary upstream sources.

---

## 1. Goals / non-goals

### Goals

1. **Cybersecurity baseline** suitable for a small SaaS handling auth + PII
   (refresh tokens, emails, lifting history): no public root SSH, no public
   port 22 long-term, no long-lived deploy secret, signed images, no-root
   containers, real PITR backups, supply-chain attestations.
2. **Performance**: HTTP/3 + zstd/brotli precompression + edge rate limiting
   - Postgres 18 AIO + Valkey 9 (vs Redis 7) yielding lower p99 TTFB and
     higher request ceiling on the same box.
3. **Scalability path documented**: stay single-VPS, but the architecture
   does not actively block horizontal scale-out (e.g., Caddy ratelimit
   already storage-backed; backups already off-host).
4. **Cost ceiling ≤ €15/mo total** held — confirmed by §8.

### Non-goals

- High availability across regions or DCs. Single VPS, single AZ. SPOF
  accepted per 2026-05-10 spec.
- Multi-tenant isolation. Single product, single tenant.
- Compliance certifications (SOC 2, ISO 27001, HIPAA). Out of scope.
- Replacing Sentry/Plausible/Telegram with new SaaS — already paid for, free
  tier, working.
- Migrating off Hetzner.

---

## 2. Layered architecture (bottom-up)

```
                ┌─────────────────────────────────────────────────┐
   layer 8      │  Observability: Grafana Cloud Free (metrics +   │
                │  logs via Alloy), Sentry (errors+traces),       │
                │  UptimeRobot (probes), Telegram (alerts)        │
                └─────────────────────────────────────────────────┘
                ┌─────────────────────────────────────────────────┐
   layer 7      │  CI/CD + supply chain:                          │
                │  GH Actions → cosign sign → ghcr.io →           │
                │  Tailscale SSH (ephemeral) → cosign verify →    │
                │  docker compose pull/up                         │
                │  Provenance: attest-build-provenance + SBOM     │
                │  Scanners: Trivy v0.35.0 + osv-scanner v2.3.5   │
                └─────────────────────────────────────────────────┘
                ┌─────────────────────────────────────────────────┐
   layer 6      │  Apps:                                          │
                │   - api (Bun 1.3 + Elysia, USER bun, read-only) │
                │   - analytics (FastAPI + uvicorn, non-root)     │
                │  Data: Postgres 18 (tuned, role-split), Valkey 9│
                │  Backups: WAL-G → Hetzner Object Storage (fsn1) │
                └─────────────────────────────────────────────────┘
                ┌─────────────────────────────────────────────────┐
   layer 5      │  Edge: Caddy 2.11.2-alpine (xcaddy build) on    │
                │  80/443. Rate limit + JSON logs + COOP/CORP/CSP │
                │  + precompressed static (zstd/br/gzip)          │
                └─────────────────────────────────────────────────┘
                ┌─────────────────────────────────────────────────┐
   layer 4      │  Container runtime: Docker Engine 29.4 with     │
                │  live-restore, json-file rotation 10m×3,        │
                │  userns-remap (planned), cap_drop ALL +         │
                │  NET_BIND_SERVICE only on caddy, no-new-privs   │
                └─────────────────────────────────────────────────┘
                ┌─────────────────────────────────────────────────┐
   layer 3      │  OS: Ubuntu 24.04 LTS. SSH hardening drop-in,   │
                │  fail2ban, unattended-upgrades+autoreboot,      │
                │  kernel sysctl hardening, AppArmor, auditd      │
                └─────────────────────────────────────────────────┘
                ┌─────────────────────────────────────────────────┐
   layer 2      │  Network: nftables (NOT ufw — bypassed by       │
                │  Docker NAT). Public: 80/443 + Tailscale.       │
                │  Postgres/Redis/api/analytics on docker bridge  │
                │  gr-net, no host-published ports.               │
                └─────────────────────────────────────────────────┘
                ┌─────────────────────────────────────────────────┐
   layer 1      │  Hardware: Hetzner Cloud CCX13 (fsn1).          │
                │  Hetzner Volume 10 GB at /mnt/pg-vol.           │
                │  Hetzner DDoS shield (free upstream).           │
                └─────────────────────────────────────────────────┘
```

---

## 3. Per-layer decisions

Every entry below cross-references the research file that justifies it.

### L1 — Hardware

- **CCX13 stays** ([`01-host-os.md` §Sizing](./01-host-os.md)). Vertical
  scale to CX32 or CPX21 if RAM/CPU pressure shows — both still under €15/mo.
- **/mnt/pg-vol** stays on its own Hetzner Volume; daily volume snapshots
  remain (locked in by 2026-05-10 spec) **in addition to** WAL-G off-host
  backups (this spec).
- **LUKS on /mnt/pg-vol**: not adopted. Threat model is physical disk
  recycling at Hetzner; cost/benefit unfavourable for hobby scale.
  Re-evaluate at first compliance ask. ([`01-host-os.md` §Open questions](./01-host-os.md)).

### L2 — Network

- **nftables, not UFW** ([`01-host-os.md` P0-4](./01-host-os.md)). Docker
  iptables NAT bypasses UFW chains — Docker docs warn explicitly.
- Public ports: **80/tcp, 443/tcp, 443/udp (HTTP/3 QUIC)** plus SSH (initially
  on port 22 with fail2ban; later closed entirely once Tailscale is in).
- **Tailscale tag-restricted ephemeral nodes** for CI deploys. ACL:
  `tag:ci → tag:prod-vps:22` only ([`05-cicd-observability.md` P0-2](./05-cicd-observability.md)).
- All internal services on docker bridge `gr-net`, no published ports
  except caddy.
- Hetzner upstream DDoS protection is sufficient at this scale.

### L3 — OS (Ubuntu 24.04 LTS, support to May 2029)

- 26.04 deferred to Q4 2026 (too fresh) ([`01-host-os.md` §Verified versions](./01-host-os.md)).
- SSH hardening drop-in (`/etc/ssh/sshd_config.d/99-hardening.conf`):
  `PermitRootLogin no`, `PasswordAuthentication no`, `MaxAuthTries 3`,
  `AllowUsers deploy`, X11/agent/TCP forwarding off, ClientAlive tuned.
- **unattended-upgrades** with auto-reboot 04:00, `-security` pocket only.
- Kernel sysctl set: tcp*syncookies, rp_filter, kptr/dmesg restrict,
  fs.protected*\*, no_redirects, log_martians.
- **fail2ban with sshd jail** (not CrowdSec — we have a fleet of one).
- AppArmor: verify `docker-default` profile is loaded; no custom profiles.
- Auditd: minimal watch on `/etc/ssh/sshd_config`, `/etc/sudoers`,
  `/etc/docker/daemon.json`, `/opt/gravity-room/.env`.
- journald `SystemMaxUse=500M`; swap 1–2 GB.

### L4 — Container runtime (Docker Engine 29.4)

`/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3", "compress": "true" },
  "live-restore": true,
  "userns-remap": "default"
}
```

- `live-restore` keeps services serving traffic during Docker daemon
  upgrades.
- json-file rotation prevents Caddy access logs from filling root disk
  ([`01-host-os.md` P0-3](./01-host-os.md)).
- **userns-remap requires a planned migration window** — existing
  images/volumes need re-chown; not a hot patch
  ([`01-host-os.md` P1-8](./01-host-os.md)).

### L5 — Edge (Caddy)

- **Pin `caddy:2.11.2-alpine`** built via xcaddy with `caddy-ratelimit`
  module. Two CVEs patched in 2.11.2 (forward_auth, vars_regexp)
  ([`02-edge-caddy.md` P0-1](./02-edge-caddy.md)).
- **xcaddy build runs in CI** (GH Actions → `ghcr.io/<owner>/caddy-gr:2.11.2`).
  Decision against in-place `docker compose build` on the VPS:
  audit-friendly, matches the existing `api`/`analytics` pipeline.
  ([`02-edge-caddy.md` §Open questions, resolved here](./02-edge-caddy.md))
- **Security headers** ([`02-edge-caddy.md` P0-3, P0-4](./02-edge-caddy.md)):
  - `Cross-Origin-Opener-Policy: same-origin-allow-popups` (NOT
    `same-origin` — would break Google OAuth popup).
  - `Cross-Origin-Resource-Policy: same-site`.
  - Expanded `Permissions-Policy` deny-list.
  - Existing CSP, HSTS, Referrer-Policy retained.
- **Rate limiting** at the edge for `/api/auth/*` (10/min), `/api/programs/import`
  (5/10min), `/api/*` (600/min) per client IP. Storage in-memory while
  single-Caddy; can be repointed at Valkey if scaled out.
- **`trusted_proxies static` (empty)** — explicit "Caddy is first hop;
  trust no upstream" declaration.
- **Precompressed static assets** (`.br`, `.zst` sidecars produced in CI;
  served via `file_server { precompressed zstd br gzip }`). Drops VPS CPU
  and improves p99 TTFB on cold connections. Brotli added to the web
  build container.
- **JSON access logs to stdout** with sampling; auth/cookie auto-redacted.
- HTML `Cache-Control: no-store` for authenticated SPA shell (BFCache
  hygiene).

### L6 — Apps & data

#### api & analytics containers ([`03-containers-runtime.md`](./03-containers-runtime.md))

Compose-level defaults via YAML anchor:

```yaml
x-security: &default-security
  security_opt: ['no-new-privileges:true']
  cap_drop: [ALL]
```

Per-service:

- `caddy`: `cap_add: [NET_BIND_SERVICE]`, `read_only: true` + `tmpfs:
[/tmp, /config]` (staging verify required for ACME write paths).
- `api`: `user: "1000:1000"` (`bun` uid). `read_only: true` + `tmpfs: [/tmp]`.
  `mem_limit: 768m`, `cpus: 1.5`, `pids_limit: 200`.
- `analytics`: `user: "10001:10001"` (created in Dockerfile). Multi-stage
  Dockerfile, retain tini. `mem_limit: 512m`, `cpus: 1.0`.
- `postgres`: 18-alpine → consider `18-bookworm` (P2). `mem_limit: 1g`,
  `cpus: 1.5`.
- `valkey/valkey:9-alpine` replaces `redis:7-alpine`. `requirepass` set.

**API DB pool `DB_POOL_SIZE: 50` → 15.** With API + analytics + migrations
the 50 pool exhausts Postgres `max_connections=100` under failure
([`03-containers-runtime.md` P1-5](./03-containers-runtime.md)).

All images pinned by `name:tag@sha256:<digest>` (Renovate `docker:pinDigests`).

#### Dockerfile changes ([`03-containers-runtime.md` §Proposed Dockerfile changes](./03-containers-runtime.md))

- **api**: chown to `bun`, `USER bun` at end.
- **analytics**: convert to multi-stage; create `app` user uid 10001;
  `USER app`.

#### Postgres 18 ([`04-data-pg-redis.md`](./04-data-pg-redis.md))

- Migrations OUT of API boot. New compose `migrate` service via `profiles:`,
  run as `docker compose run --rm migrate` before `up -d`.
  ([`04-data-pg-redis.md` P0-2](./04-data-pg-redis.md)). API `depends_on`
  the migration only via the deploy script ordering, not Compose conditions.
- `postgresql.conf` delta: shared_buffers 1GB, effective_cache_size 3GB,
  work_mem 16MB, `max_connections=50`, `wal_level=replica`, `archive_mode=on`,
  `archive_command='wal-g wal-push %p'`, `archive_timeout=60s`,
  `random_page_cost=1.1`, `jit=off`, `io_method=worker`,
  `statement_timeout=60s` (global ceiling — role-level is tighter).
- **Role separation**: `gravity_app` (LOGIN, no SUPER), `gravity_migrate`
  (LOGIN, CREATEDB), `gravity_backup` (LOGIN, REPLICATION). Superuser
  rotated and OFF the app `.env`.
- Per-table autovacuum overrides on `workout_results` and `undo_entries`.
- `pg_hba.conf`: `scram-sha-256` only, deny non-bridge non-peer.
- TLS between containers: NOT adopted (single-host docker bridge is private;
  cost > benefit) ([`04-data-pg-redis.md` P2-4](./04-data-pg-redis.md)).

#### Valkey 9 ([`04-data-pg-redis.md` P0-4](./04-data-pg-redis.md))

- Replaces `redis:7-alpine`. Wire-protocol compatible, BSD-3 (retires the
  AGPLv3/SSPL/RSALv2 question for Redis 8+), ~30% faster on multi-core.
- `requirepass` from env. Current `--appendonly no` + tmpfs is correct
  for rate-limit + presence (ephemeral by design).
- If we ever add a JWT denylist, run a **second** Valkey instance with
  AOF on + own bind-mount + own password. Do NOT multiplex durable +
  ephemeral.

#### Backups: WAL-G 3.0.8 → Hetzner Object Storage (fsn1) ([`04-data-pg-redis.md` P0-1](./04-data-pg-redis.md))

- pgBackRest declared unmaintained April 2026; **do not adopt**.
- Daily full + WAL archive every 60s + libsodium AES-256 + zstd. 30-day
  retention, ≥ 4 full backups kept.
- **WAL-G runs as a sidecar container** mounting `/var/lib/postgresql`
  shared with the postgres service ([`04-data-pg-redis.md` §Open Q1, resolved here](./04-data-pg-redis.md)).
  Cleaner than baking into the postgres image; avoids host-level cron.
- **Encryption key custody**: `WALG_LIBSODIUM_KEY_PATH` chmod 600 on host;
  off-host copy in user's password manager (Bitwarden/1Password) and a
  second copy in a dedicated GitHub Actions secret used only by the
  restore workflow ([`04-data-pg-redis.md` §Open Q3, resolved here](./04-data-pg-redis.md)).
- **Quarterly restore drills** to a throwaway staging container — a backup
  you haven't restored isn't a backup.

### L7 — CI/CD + supply chain ([`05-cicd-observability.md`](./05-cicd-observability.md))

- **SHA-pin every `uses:`** with trailing `# vX.Y.Z` comment. Managed by
  Dependabot `github-actions`. Triggered by the March 2026 `trivy-action`
  incident (76/77 tags force-pushed to malicious commits).
- **Tailscale SSH + GHA OAuth ephemeral** replaces `VPS_SSH_KEY`. VPS
  closes 22 to the public internet.
- **Sigstore cosign keyless signing** in build job; **verification gate on
  the VPS** (`cosign verify --certificate-identity-regexp ...`) BEFORE
  `docker compose pull` proceeds.
- **SLSA build provenance** via `actions/attest-build-provenance@v2`.
- **CycloneDX SBOM** via `anchore/sbom-action@v0`.
- **Vulnerability scanning**: Trivy v0.35.0 (post-incident SHA-pinned) +
  osv-scanner v2.3.5 (supports `bun.lock`). Fail on `HIGH,CRITICAL`,
  `ignore-unfixed: true`.

  > **Cross-stream conflict, resolved here**: [`03-containers-runtime.md`
  > P2-6](./03-containers-runtime.md) recommends avoiding Trivy entirely
  > and using Docker Scout + Grype. [`05-cicd-observability.md`
  > P0-5](./05-cicd-observability.md) keeps Trivy but at v0.35.0
  > post-incident with SHA pin and Dependabot watch. **Adopt the
  > cicd-obs recommendation** — Trivy v0.35.0 with SHA pin + osv-scanner
  > as second opinion. Reasoning: Docker Scout requires Docker Hub
  > subscription for full features; Grype + osv-scanner overlap is
  > redundant; the specific incident is fixable by pinning the known-good
  > SHA. Document the decision so a future maintainer knows why both
  > options were considered.

- **CodeQL** matrix (`javascript-typescript` + `python`, `build-mode: none`).
- **Dependabot** for `github-actions`, `npm`, `pip`, `docker`. Use 2026
  `cooldown` + `groups` options to batch.
- **Rollback pointer** on the VPS: `.image_tag.prev` written before each
  deploy. One-line `./rollback.sh` to swap.
- **Pre-deploy `check-env.ts` gate**: keep (already correct).
- **Deploy by digest** (`@sha256:<digest>`) post P0 — sidesteps GHCR's
  lack of tag immutability.

### L8 — Observability ([`05-cicd-observability.md`](./05-cicd-observability.md))

| Component                                                                     | Hosting                 | €/mo      |
| ----------------------------------------------------------------------------- | ----------------------- | --------- |
| Metrics (API `/metrics` + node + cAdvisor) via `grafana-alloy` → remote-write | Grafana Cloud Free      | 0         |
| Logs (Docker JSON via Alloy `loki.write`)                                     | Grafana Cloud Free      | 0         |
| Errors + perf traces                                                          | Sentry (existing)       | 0         |
| Uptime probes (web, /health, /metrics-token)                                  | UptimeRobot Free        | 0         |
| Alerts                                                                        | Telegram bot (existing) | 0         |
| Product analytics                                                             | Plausible (existing)    | unchanged |

**Recommendation against OpenTelemetry**: Sentry already covers errors +
perf traces. Adding OTel doubles the runtime cost for marginal gain.

---

## 4. Phased rollout

P0/P1 numbering preserved across research files. The schedule below
sequences them to avoid breaking changes while landing the security wins
fastest.

### Phase 0 — Documentation & decisions (this PR)

- Land this design doc + the 5 research files. Get user sign-off.
- Create implementation plan (next skill: `writing-plans`).

### Phase 1 — Same-day-safe P0s (no service interruption)

Order matters. Each step is independently revertible.

1. **Host SSH hardening + unattended-upgrades + sysctl + fail2ban**
   ([`01-host-os.md` P0-1, P0-2, P1-5, P1-6](./01-host-os.md)). One SSH
   session, idempotent script. Verify before logout.
2. **Docker daemon.json: live-restore + log rotation**
   ([`01-host-os.md` P0-3](./01-host-os.md)). `systemctl reload docker`.
   live-restore keeps containers running during the reload.
3. **nftables baseline** (port 22, 80/tcp, 443/tcp+udp). Test from a
   second SSH session before flushing the old chain.
4. **Caddy 2.11.2-alpine pin** ([`02-edge-caddy.md` P0-1](./02-edge-caddy.md))
   — single line in compose, no behaviour change.

### Phase 2 — Image rebuild & deploy pipeline

5. **Non-root + cap_drop + no-new-privileges + read-only + resource limits**
   in `docker-compose.yml` + Dockerfile updates
   ([`03-containers-runtime.md` P0-1..P0-3, P1-1..P1-4](./03-containers-runtime.md)).
6. **DB_POOL_SIZE → 15** in API code + env example
   ([`03-containers-runtime.md` P1-5](./03-containers-runtime.md)).
7. **Caddy xcaddy custom image** with `caddy-ratelimit` published to GHCR.
   Apply expanded security headers, rate-limit zones, precompressed
   serving once the web build emits `.br/.zst`
   ([`02-edge-caddy.md` P0-2..P0-4, P1-5, P1-7](./02-edge-caddy.md)).
8. **GH Actions: SHA-pin every `uses:`, add cosign sign in build, add
   verify gate in deploy** ([`05-cicd-observability.md` P0-1, P0-3](./05-cicd-observability.md)).
9. **attest-build-provenance + sbom-action + Trivy v0.35.0 + osv-scanner**
   ([`05-cicd-observability.md` P0-4, P0-5](./05-cicd-observability.md)).
10. **Rollback pointer step in deploy.yml**
    ([`05-cicd-observability.md` P0-6](./05-cicd-observability.md)).

### Phase 3 — Data layer

11. **Move migrations out of API boot** into compose `migrate` service
    ([`04-data-pg-redis.md` P0-2](./04-data-pg-redis.md)). Pre-deploy
    step runs `docker compose run --rm migrate` before `up -d`.
12. **`postgresql.conf` delta + role separation + `pg_hba.conf`**
    ([`04-data-pg-redis.md` P1-1, P1-2](./04-data-pg-redis.md)).
13. **Valkey 9 migration** ([`04-data-pg-redis.md` P0-3, P0-4](./04-data-pg-redis.md)).
    Drain window during low traffic; Redis state is ephemeral by design.
14. **WAL-G sidecar + Hetzner Object Storage bucket + key custody +
    quarterly drill in calendar**
    ([`04-data-pg-redis.md` P0-1, P0-6](./04-data-pg-redis.md)).
15. **First restore drill** to a throwaway container — block phase exit
    on it.

### Phase 4 — Network surface elimination

16. **Tailscale SSH + ephemeral GHA runner; remove `VPS_SSH_KEY` secret;
    close port 22 to public internet on nftables**
    ([`05-cicd-observability.md` P0-2](./05-cicd-observability.md)).
17. **userns-remap "default"** ([`01-host-os.md` P1-8](./01-host-os.md)).
    Planned downtime window. One-shot chown of /var/lib/docker.

### Phase 5 — Observability

18. **`grafana-alloy` on VPS** scraping `/metrics`, node, cAdvisor →
    Grafana Cloud Free metrics + logs
    ([`05-cicd-observability.md` P1-2, P1-3](./05-cicd-observability.md)).
19. **UptimeRobot Free + Telegram webhook**
    ([`05-cicd-observability.md` P1-1](./05-cicd-observability.md)).
20. **Dependabot + CodeQL**
    ([`05-cicd-observability.md` P1-4, P1-5](./05-cicd-observability.md)).

### Phase 6 — Deferred / opportunistic (P2)

- Postgres → `postgres:18-bookworm` ([`03-containers-runtime.md` P2-3](./03-containers-runtime.md)).
- CSP `strict-dynamic` + nonce ([`02-edge-caddy.md` P2-10](./02-edge-caddy.md)).
- caddy-coraza WAF when rate-limit telemetry shows targeted attacks.
- `pg_stat_statements` + metrics exporter
  ([`04-data-pg-redis.md` P2-2](./04-data-pg-redis.md)).
- ssh-audit pass, auditd ruleset, journald tightening
  ([`01-host-os.md` P1-7, P2-10, P2-11](./01-host-os.md)).

---

## 5. Cost ceiling validation

| Line item                                              | €/mo       |
| ------------------------------------------------------ | ---------- |
| Hetzner CCX13 + IPv4                                   | 13.50      |
| Hetzner Volume 10 GB + snapshots                       | 0.90       |
| Hetzner Object Storage (WAL-G destination, ~5 GB used) | ~0.50      |
| Tailscale Personal                                     | 0.00       |
| Grafana Cloud Free                                     | 0.00       |
| UptimeRobot Free                                       | 0.00       |
| Sentry / Plausible / Telegram (already in stack)       | 0.00       |
| **Total**                                              | **~14.90** |

Within ceiling. Headroom = ~€0.10/mo (effectively zero). First action
that would bust the cap: upgrading Grafana Cloud beyond Free, or adding
a second VPS.

---

## 6. Scale-out roadmap (when to abandon single-VPS)

From [`04-data-pg-redis.md` §HA "stop here"](./04-data-pg-redis.md), promoted
to a system-wide policy:

> **No HA until weekly active users × revenue/user > €200/mo.** Below that
> threshold: vertical scale on Hetzner, tested backups, 30-min rebuild
> runbook is the right answer.

Triggers to revisit:

- **Postgres CPU sustained > 70%** on CX32 → consider `CCX23` (4 dedicated
  vCPU / 16 GB) for ~€20/mo, breaking the €15 cap (revisit cap then).
- **Postgres write WAL > volume IOPS budget** → migrate to dedicated DB
  host (separate VPS), keep app on existing VPS.
- **Customer SLA contracted** → multi-AZ replica + Patroni or a managed
  Postgres (Hetzner has none today; would mean leaving Hetzner).
- **Backup restore RTO measurably hurts revenue** → introduce hot standby
  (logical replication on a second VPS in `nbg1`).
- **Edge becomes single point of failure for revenue** → add a second
  Caddy node + Hetzner Load Balancer (€5.50/mo) and switch caddy-ratelimit
  storage to Valkey (already wire-compatible).

The architecture in §3 explicitly does NOT block any of these moves:
backups are off-host, rate-limit state is externalisable, secrets are
not entangled with the box, deploys are by signed digest.

---

## 7. Risks accepted

Inherited from 2026-05-10 spec — still accepted:

- Single VPS in single DC. Regional outage = total outage.
- Hetzner Volume snapshots stay in same region (now layered with off-region
  via WAL-G + Object Storage in fsn1 — same region as VPS; cross-region
  defer until compliance ask).

New, explicit:

- **userns-remap rollout requires downtime** — accepted, scheduled for a
  low-traffic window.
- **Tailscale dependency** — if Tailscale control plane is down, no
  deploys. Mitigation: keep the long-lived SSH key disabled but on file
  for break-glass; document the recovery in the runbook.
- **WAL-G key loss = backup loss** — three copies (VPS, password manager,
  GH secret for restore workflow). Document recovery owner.
- **`anthropics/claude-code-action@v1`** stays on mutable tag until upstream
  ships a SHA-stable release. Trade-off: convenience of Claude updates vs
  supply chain risk for a tooling-only workflow (no prod access).

---

## 8. Decisions — accepted 2026-05-11

1. **OS pin: Ubuntu 24.04 LTS** through Q4 2026. Re-evaluate at 26.04.1.
2. **Tailscale SSH adopted.** Public port 22 will be closed in Phase 4.
3. **userns-remap downtime window**: to be scheduled by user at Phase 4
   start (low-traffic window, ~15 min).
4. **WAL-G key custody**: user owns all three copies (VPS chmod 600,
   personal password manager, GH secret `WALG_LIBSODIUM_KEY` used only by
   the restore workflow).
5. **`anthropics/claude-code-action@v1`**: SHA-pin with Dependabot review
   cadence.
6. **Rollback policy**: manual. Auto-rollback rejected to avoid masking
   root causes.

---

## 9. Cross-stream conflicts (resolved)

| Conflict                                                           | Resolution                                                | Where |
| ------------------------------------------------------------------ | --------------------------------------------------------- | ----- |
| Trivy: containers says "avoid", cicd-obs says "v0.35.0 SHA-pinned" | Adopt cicd-obs view: Trivy v0.35.0 + osv-scanner          | §3 L7 |
| WAL-G placement: data-pg-redis Q1 unresolved                       | Sidecar container sharing /var/lib/postgresql             | §3 L6 |
| Backup key custody                                                 | VPS chmod 600 + password manager + GH restore-only secret | §3 L6 |
| xcaddy build location: CI vs in-place                              | CI build → GHCR (auditable, matches existing pipeline)    | §3 L5 |
| Brotli toolchain                                                   | Add `brotli` to web build container                       | §3 L5 |
| Distributed rate-limit storage                                     | Defer; in-memory until 2nd Caddy node                     | §3 L5 |
| fail2ban vs CrowdSec                                               | fail2ban (fleet of one)                                   | §3 L3 |
| LUKS on /mnt/pg-vol                                                | Not adopted                                               | §3 L1 |
| ESM/secrets vs env_file                                            | Keep env_file with chmod 600 + auditd watch               | §3 L4 |
| Postgres alpine vs bookworm                                        | P2, not P0                                                | §3 L6 |

---

## 10. References

Primary research files (this folder):

- [`01-host-os.md`](./01-host-os.md)
- [`02-edge-caddy.md`](./02-edge-caddy.md)
- [`03-containers-runtime.md`](./03-containers-runtime.md)
- [`04-data-pg-redis.md`](./04-data-pg-redis.md)
- [`05-cicd-observability.md`](./05-cicd-observability.md)

Preceding spec:

- [`../2026-05-10-vps-migration-design.md`](../2026-05-10-vps-migration-design.md)

Every upstream URL is in the Sources section of the corresponding research
file. Total distinct primary sources cited: ~80 (docker.com, postgresql.org,
caddyserver.com, ubuntu.com, kernel.org, sigstore.dev, valkey.io,
github.com/actions, tailscale.com, grafana.com, hetzner.com, MDN,
NIST SP 800-190, OWASP).
