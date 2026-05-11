# 04 — Data layer: Postgres 18 + Redis/Valkey

> Bottom-up infra design, data layer. Single Hetzner VPS, docker-compose, single-AZ.
> Date: 2026-05-11. Author: `data-pg-redis` teammate.

## Verified versions (May 2026)

| Component              | Verified version                                          | Notes                                                                                                            |
| ---------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| PostgreSQL             | **18.3** (out-of-cycle, Feb 2026); 18.0 GA Sep 2025       | Async I/O subsystem, scram-sha-256 default, page checksums on, md5 deprecated. ([PG 18 release notes][pg18-rel]) |
| `postgres:18-alpine`   | OK                                                        | Already pinned in compose.                                                                                       |
| Redis 7-alpine         | 7.x — **license is AGPLv3 / SSPL / RSALv2** since Redis 8 | Many orgs forbid AGPLv3. ([Redis vs Valkey 2026][redis-valkey])                                                  |
| **Valkey** (BSD-3)     | **9.0** GA Oct 2025; on cloud platforms in 2026           | Drop-in, faster on multi-core, Linux-Foundation governed. ([Valkey 9 announcement][valkey9])                     |
| WAL-G                  | **3.0.8** (Jan 2026)                                      | S3, libsodium AES-256, PITR, Direct-IO reader, xid64 support. ([WAL-G 3.0.8 release][walg-308])                  |
| pgBackRest             | **2.58.0 — UNMAINTAINED** (Apr 2026)                      | Maintainer stepped away after 13 yrs. **Do not adopt.** ([thebuild.com obsolescence notice][pgbr-eol])           |
| Hetzner Object Storage | S3-compatible GA                                          | EU regions: `fsn1`, `nbg1`, `hel1`. €5.20/TB/mo + €0.01/GB egress. ([Hetzner OS][hetzner-os])                    |

## Current state

```yaml
postgres:                            redis:
  image: postgres:18-alpine            image: redis:7-alpine
  volumes:                             command: [redis-server, --save, '',
    - /mnt/pg-vol:/var/lib/postgresql              --appendonly, no, --maxmemory, 256mb,
  env_file: .env                                  --maxmemory-policy, allkeys-lru]
  # no .conf override, no pg_hba       tmpfs: [/data]
  # no archive_mode, no backups        # no requirepass, no ACL, no rename-command
```

Migrations run at API boot via `apps/backend/api/src/bootstrap.ts:186` (`await runMigrations()` then `await runSeeds()`) — on failure the API container restart-loops.

Redis is **non-durable on purpose** (tmpfs + AOF off) — fine for rate-limit counters and presence. Refresh tokens live in Postgres (`schema.ts:74`), so "lose Redis = lose nothing critical" currently holds. Re-verify before adding any denylist.

## Gaps vs official best practice

1. **No backups, no WAL archiving, no PITR.** Single-disk volume on a single VPS = one failure from total data loss.
2. **No `postgresql.conf` overrides** — defaults assume a tiny dev machine (`shared_buffers=128MB`, AIO sync). We have 4–8 GB RAM.
3. **No statement / idle-in-transaction / lock timeouts.** A bad query can pin a connection forever and block autovacuum.
4. **No production logging** — no slow-query, no lock-wait, no checkpoint visibility.
5. **No autovacuum tuning for hot table `workout_results`** (write-heavy: every set logged).
6. **Migrations on boot = boot-loop risk.** A bad migration kills the API for every user, and Drizzle has no down migrations ([Drizzle][drizzle-mig]).
7. **Redis: no password, no ACL, no command renames.** Internal bridge mitigates blast radius but is one container compromise from full keyspace dump.
8. **Redis license drift** — `redis:7-alpine` is OK today, but Redis 8+ is AGPLv3/SSPL/RSALv2. Switch to Valkey now to retire the question.
9. **Role separation absent.** API connects as `gravity` superuser. No backup role, no migration role.

## Concrete recommendations

Priorities: **P0** = ship before this design closes; **P1** = next sprint; **P2** = nice-to-have / when scale demands.

### P0 — backups (the only one that prevents extinction-level events)

- **P0-1. Adopt WAL-G 3.0.8 → Hetzner Object Storage.** Daily full + continuous WAL archiving + libsodium AES-256. 30-day retention. ([WAL-G][walg-readme])
  - **Why not pgBackRest:** sole maintainer announced obsolescence in April 2026 ([thebuild.com][pgbr-eol]). WAL-G is actively maintained (3.0.8 Jan 2026), S3-native, and matches "ephemeral compute, durable object storage".
  - **Why not `pg_basebackup` cron:** no WAL archiving → RPO = 24 h, unacceptable. No incremental, no encryption out-of-box.
- **P0-2. Move migrations out of API boot.** New compose `migrate` service via `profiles: [migrate]` or pre-deploy `docker compose run --rm migrate`. API `depends_on` completion. A bad migration fails the deploy, not every live request.
- **P0-3. Set `requirepass` on Redis** (or switch to Valkey — P0-4). Defense-in-depth: a compromised analytics container should not have free read on the cache.
- **P0-4. Switch image to `valkey/valkey:9-alpine`.** Drop-in for our use (rate-limit + presence sorted sets — no JSON/vector/Stack features). BSD-3 license retires the AGPL question; Valkey 9 is ~30% faster on multi-core ([Valkey 9][valkey9]).
- **P0-5. Lock down `pg_hba.conf`** — `scram-sha-256` only, deny everything except the `gr-net` subnet and the local peer.
- **P0-6. Restore drills.** Quarterly restore-to-staging from Hetzner Object Storage. A backup you haven't restored isn't a backup.

### P1 — tuning & hardening

- **P1-1. `postgresql.conf` delta** (block below), sized for 4–8 GB RAM.
- **P1-2. Role separation:** `gravity_app` (LOGIN, no SUPERUSER) for API; `gravity_migrate` (LOGIN, CREATEDB) for the migrate service; `gravity_backup` (LOGIN, REPLICATION) for WAL-G. `postgres` rotated and kept out of app `.env`.
- **P1-3. Timeouts at the `gravity_app` role level:** `statement_timeout=30s`, `idle_in_transaction_session_timeout=60s`, `lock_timeout=5s`. Don't apply to superuser — ops queries need headroom ([Percona caveat][percona-idle]).
- **P1-4. Logging:** `log_min_duration_statement=250ms`, `log_lock_waits=on`, `log_temp_files=0`, `log_checkpoints=on`, `log_autovacuum_min_duration=1s` ([pganalyze][pganalyze-log]).
- **P1-5. Autovacuum overrides on `workout_results` and `undo_entries`** (write-heavy): `autovacuum_vacuum_scale_factor=0.02`, `autovacuum_analyze_scale_factor=0.02`.
- **P1-6. Redis AOF (`appendfsync everysec`) + bind-mount `/mnt/redis-vol:/data`** — **only** if we add anything we cannot lose (JWT denylist, login throttling). Current ephemeral config is correct for rate-limit + presence.
- **P1-7. Redis ACL file** — split `app` (`+@read +@write` on `rl:*` / `presence:*`) from `admin` (`+@all`), disable `default` ([Valkey ACL][valkey-acl]).

### P2 — observability & scale

- **P2-1. `io_method=worker`** on PG 18; try `io_uring` if host kernel ≥ 5.6 and seccomp allows it — measure first. 1.5–3× scan/vacuum gains in published benches.
- **P2-2. `pg_stat_statements`** + Prometheus exporter on a metrics-only role.
- **P2-3. Logical replication standby on a second VPS** — only when user/revenue numbers justify the extra €/mo.
- **P2-4. TLS between containers: NOT recommended.** Single-host docker bridge is private; cert management + CPU overhead exceeds the marginal gain. The Crunchy recipe ([crunchy-ssl]) targets cross-host PG. Revisit if Postgres ever leaves the host.

## Sample `postgresql.conf` delta

Mount as `./conf/postgresql.conf:/etc/postgresql/postgresql.conf:ro` and pass `command: postgres -c config_file=/etc/postgresql/postgresql.conf`.

```conf
# memory (sized for 4 GB; double for 8 GB)
shared_buffers = 1GB                       # 25% of RAM
effective_cache_size = 3GB                 # ~75% of RAM (planner hint)
work_mem = 16MB
maintenance_work_mem = 256MB
wal_buffers = 16MB
huge_pages = try

# WAL & checkpoints
wal_level = replica
max_wal_senders = 3
archive_mode = on
archive_command = 'wal-g wal-push %p'
archive_timeout = 60s                      # bound RPO to 60s
checkpoint_completion_target = 0.9
min_wal_size = 1GB
max_wal_size = 4GB

# connections / planner
max_connections = 50                       # API ~10 + analytics ~5 + headroom
random_page_cost = 1.1                     # SSD
jit = off                                  # OLTP, sub-50ms queries
io_method = worker                         # PG 18 AIO; try io_uring after kernel check

# security / timeouts (global ceilings; role-level limits are tighter)
password_encryption = scram-sha-256
ssl = off                                  # internal bridge only
statement_timeout = 60s
idle_in_transaction_session_timeout = 5min
lock_timeout = 10s

# logging
log_min_duration_statement = 250ms
log_lock_waits = on
log_temp_files = 0
log_checkpoints = on
log_autovacuum_min_duration = 1s
log_line_prefix = '%m [%p] %q%u@%d '
log_connections = on
log_disconnections = on

# autovacuum (per-table overrides via ALTER TABLE)
autovacuum_naptime = 30s
autovacuum_max_workers = 3
```

Per-table overrides (in a migration or post-deploy hook):

```sql
ALTER TABLE workout_results SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_limit = 2000
);
ALTER TABLE undo_entries SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.05
);
ALTER ROLE gravity_app SET statement_timeout = '30s';
ALTER ROLE gravity_app SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE gravity_app SET lock_timeout = '5s';
```

## Sample compose changes (Redis → Valkey + secret)

```yaml
redis:
  image: valkey/valkey:9-alpine # was: redis:7-alpine
  restart: unless-stopped
  command:
    - valkey-server
    - --save
    - ''
    - --appendonly
    - 'no'
    - --maxmemory
    - 256mb
    - --maxmemory-policy
    - allkeys-lru
    - --requirepass
    - ${REDIS_PASSWORD} # 32+ char random, in .env (chmod 600)
    - --aclfile
    - /etc/valkey/users.acl # optional in P1
  tmpfs: [/data]
  networks: [gr-net]
  healthcheck:
    test: ['CMD', 'valkey-cli', '-a', '${REDIS_PASSWORD}', 'ping']
    interval: 10s
    timeout: 3s
    retries: 5
```

And update `REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379` — the URL scheme remains `redis://` (Valkey kept wire protocol compat).

Optional `users.acl` (P1):

```
user default off
user app on >${REDIS_APP_PASSWORD} ~rl:* ~presence:* +@read +@write +@connection -@dangerous
user admin on >${REDIS_ADMIN_PASSWORD} ~* +@all
```

## Backup architecture (ASCII)

```
+---------------------------+         +---------------------------+
|  postgres:18-alpine       |         |  wal-g (sidecar pod or    |
|                           |  WAL    |  cron in postgres image)  |
|  archive_command=         |-------->|                           |
|    'wal-g wal-push %p'    |  files  |  + libsodium AES-256      |
|                           |         |  + zstd compression       |
|        |                  |         |                           |
|        |  pg_basebackup   |  daily  |        |                  |
|        v                  |  full   |        v                  |
|  /var/lib/postgresql      |-------->|   backup-push $PGDATA     |
+---------------------------+         +---------------------------+
              |                                       |
              | (write path)                          | HTTPS, S3 v4
              v                                       v
        /mnt/pg-vol                       +---------------------------+
        (Hetzner Volume,                  | Hetzner Object Storage    |
         single-AZ)                       |  fsn1.your-objectstorage  |
                                          |  bucket: gravity-pg-prod  |
                                          |  - object lock (P1)       |
                                          |  - versioning (on)        |
                                          |  - retention: 30 days     |
                                          +---------------------------+
                                                      |
                                                      | restore (PITR)
                                                      v
                                          +---------------------------+
                                          | wal-g backup-fetch LATEST |
                                          | + wal-g wal-fetch (loop)  |
                                          | → new postgres container  |
                                          | drilled quarterly         |
                                          +---------------------------+
```

`.env.production` additions:

```
WALG_S3_PREFIX=s3://gravity-pg-prod/wal-g
AWS_ENDPOINT=https://fsn1.your-objectstorage.com
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_FORCE_PATH_STYLE=true
WALG_LIBSODIUM_KEY_PATH=/etc/wal-g/libsodium.key   # chmod 600, generated with `openssl rand -hex 32`
WALG_LIBSODIUM_KEY_TRANSFORM=hex
WALG_COMPRESSION_METHOD=zstd
WALG_DELTA_MAX_STEPS=6
```

Cron in WAL-G sidecar / host:

```
# daily full at 02:30 UTC
30 2 * * *   wal-g backup-push $PGDATA
# weekly retention sweep (keep 30 days, ≥ 4 full backups)
0  3 * * 0   wal-g delete retain FULL 4 --confirm
```

## HA — "stop here" line

> **No HA until weekly active users × revenue/user > €200/mo.** Until then: vertical scale on Hetzner, tested backups, and a "rebuild in 30 min" runbook. Logical replication, Patroni, pgpool, K8s operators — all operational tax with no user-visible value at our scale.

Revisit when **any** is true: (a) 30 min of downtime = measurable revenue loss, (b) a customer has an uptime SLA, (c) backup-restore RTO exceeds business tolerance.

## Open questions

1. **WAL-G runtime placement** — (a) sidecar sharing `pgdata`, (b) custom `postgres:18 + wal-g` image, or (c) on the host. (b) is cleanest; decide with edge/container teammates.
2. **Object Storage region** — `fsn1` for most Hetzner Cloud locations. If VPS is in `hel1`, switch endpoint.
3. **Backup key custody** — lose `WALG_LIBSODIUM_KEY_PATH` and the backups are unrecoverable. Off-host copy required; decide who owns it.
4. **Redis→Valkey flush window** — keys are ephemeral by design (rate-limit + presence), so a flush during a low-traffic deploy is acceptable. Confirm no caller relies on warm cache.
5. **Separate Redis instances** — if we add JWT denylists, run a second `valkey-persistent` (AOF on, own volume, own password). Don't multiplex durable + ephemeral on one instance.

## Sources

- [PG 18 Release notes][pg18-rel] — postgresql.org official.
- [WAL-G 3.0.8 release][walg-308] / [WAL-G repo][walg-readme] — official.
- [pgBackRest obsolescence — Christophe Pettus, Apr 2026][pgbr-eol].
- [Hetzner Object Storage][hetzner-os] — official product page.
- [Valkey 9 announcement][valkey9] / [Valkey ACL docs][valkey-acl] — Linux Foundation.
- [Redis vs Valkey 2026 license analysis][redis-valkey].
- [PG tuning wiki][pg-tune-wiki] — postgresql.org wiki.
- [Drizzle migration patterns][drizzle-mig].
- [Percona — idle session timeout caveats][percona-idle].
- [pganalyze logging tuning][pganalyze-log].
- [Crunchy SSL recipe for PG in docker][crunchy-ssl] (context for the "no internal TLS" decision).

[pg18-rel]: https://www.postgresql.org/about/news/postgresql-18-released-3142/
[walg-308]: https://www.postgresql.org/about/news/wal-g-308-released-3219/
[walg-readme]: https://wal-g.readthedocs.io/PostgreSQL/
[pgbr-eol]: https://thebuild.com/blog/2026/04/27/notice-of-obsolescence/
[hetzner-os]: https://www.hetzner.com/storage/object-storage/
[valkey9]: https://valkey.io/blog/introducing-valkey-9/
[valkey-acl]: https://valkey.io/topics/acl/
[redis-valkey]: https://dev.to/synsun/redis-vs-valkey-in-2026-what-the-license-fork-actually-changed-1kni
[pg-tune-wiki]: https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server
[drizzle-mig]: https://orm.drizzle.team/docs/migrations
[percona-idle]: https://www.percona.com/blog/human-factors-behind-incidents-why-settings-like-idle_session_timeout-can-be-a-bad-idea/
[pganalyze-log]: https://pganalyze.com/docs/log-insights/setup/tuning-log-config-settings
[crunchy-ssl]: https://www.crunchydata.com/blog/ssl-certificate-authentication-postgresql-docker-containers
