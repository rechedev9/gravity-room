# Production operations runbook

Operational procedures for the single-node Hetzner VPS (`gr-prod`) running the
Gravity Room stack via Docker Compose at `/opt/gravity-room`.

The stack definition (`docker-compose.yml` + `Caddyfile`) and the operational
scripts under `scripts/` are the source of truth here and are rsynced to the box
by `.github/workflows/deploy.yml`. The cron units under `cron/` and the host-level
config (`.hc-url`, `.backup-env`) are root- or deploy-owned files that live only on
the box; this doc is how you (re)create them.

## Stack at a glance

| Service     | Image                  | Notes                                                      |
| ----------- | ---------------------- | ---------------------------------------------------------- |
| `caddy`     | `caddy:2-alpine`       | TLS, security headers, serves web SPA, reverse-proxies api |
| `api`       | gravity-room-api       | `read_only`, `cap_drop: ALL`, `no-new-privileges`          |
| `analytics` | gravity-room-analytics | `read_only`, `cap_drop: ALL`, `no-new-privileges`          |
| `postgres`  | `postgres:18-alpine`   | data on the `pg-vol` Hetzner volume (`/mnt/pg-vol`)        |
| `redis`     | `redis:7-alpine`       | ephemeral cache (tmpfs, `--save ''`), 256mb LRU            |

All container logs are capped (`json-file`, `max-size: 10m`, `max-file: 3`) so a
chatty container can never fill the root disk.

## Backups

A daily `pg_dump` (custom format) runs at 04:00 UTC via `cron/gravity-room-backup`
→ `scripts/backup.sh`, writing to `/opt/gravity-room/backups/` (root disk, a
physically separate device from the `pg-vol` data volume). Local retention is 7 days.

```bash
journalctl -t gr-backup --since today        # inspect the last run
ls -lah /opt/gravity-room/backups/           # list dumps
```

### Offsite copy (enable this)

On-box dumps do not survive loss of the VM. `backup.sh` will push each fresh dump
offsite when configured - it is a no-op until then, and a failed upload never
aborts the local dump. Use an rclone **crypt** remote so the dump (which contains
the `users` table: email + `google_id`) is encrypted client-side before it leaves
the box. Prefer Cloudflare R2 or Backblaze B2 - Hetzner Object Storage has a
~€5.99/mo minimum that breaks the documented cost ceiling.

One-time setup on the box (as `deploy`, or root then `chown deploy`):

```bash
# 1. Install rclone
curl https://rclone.org/install.sh | sudo bash

# 2. Configure two remotes interactively:
#    - a backend remote (e.g. `r2` / `b2`) pointing at your bucket
#    - a `crypt` remote (e.g. `gr-crypt`) wrapping `r2:gr-backups`
rclone config           # writes ~/.config/rclone/rclone.conf (or /opt/gravity-room/rclone.conf)

# 3. Point backup.sh at the crypt remote
printf 'RCLONE_REMOTE=gr-crypt:\n' | sudo tee /opt/gravity-room/.backup-env
sudo chown deploy:deploy /opt/gravity-room/.backup-env
sudo chmod 600 /opt/gravity-room/.backup-env

# 4. Record the rclone crypt password OFF-BOX (password manager) - losing it makes
#    the offsite copy permanently unrecoverable.

# 5. Dry run
/opt/gravity-room/scripts/backup.sh && journalctl -t gr-backup -n 20 --no-pager
```

Set a 30-day object-lifecycle (or object-lock) rule on the bucket for offsite
retention rather than re-implementing rotation in the script.

## Restore test

An untested backup is a hope, not a backup. `scripts/restore-test.sh` restores the
latest dump into a throwaway `gravity_restore_test` database (dropped on exit - it
never touches live data) and asserts the restore succeeded. A weekly cron
(`cron/gravity-room-restore-test`, Sundays 05:00 UTC) runs it automatically.

```bash
/opt/gravity-room/scripts/restore-test.sh         # run on demand
journalctl -t gr-restore-test --since today       # inspect
```

### Real restore (recovering production)

```bash
cd /opt/gravity-room
# Restore a chosen dump over the live DB (DESTRUCTIVE - only during recovery):
docker compose exec -T postgres pg_restore -U gravity -d gravity --clean --if-exists \
  --no-owner --no-acl < backups/gravity-<TIMESTAMP>.dump
```

To pull a dump back from offsite first: `rclone copy gr-crypt:gr-backups/<YYYY>/<MM>/<file> .`

## Liveness monitoring (Healthchecks.io)

`scripts/heartbeat.sh` (every 5 min via `cron/gravity-room-heartbeat`) probes
`https://api.gravityroom.app/health` through Caddy - the full TLS → Caddy → api → db
→ redis path - and pings Healthchecks.io on success, or `…/fail` on failure. A
missed ping (VPS dead) is caught by the HC grace timeout.

**It is a silent no-op until the check URL is set.** To arm it:

```bash
# 1. Create a check at https://healthchecks.io (period 5m, grace ~10m); copy its ping URL.
# 2. On the box:
printf '%s\n' 'https://hc-ping.com/<your-uuid>' | sudo tee /opt/gravity-room/.hc-url
sudo chown deploy:deploy /opt/gravity-room/.hc-url
sudo chmod 600 /opt/gravity-room/.hc-url
# 3. Verify a ping arrives:
/opt/gravity-room/scripts/heartbeat.sh && echo "pinged"
```

## Installing the cron units (root, one-time)

The deploy pipeline syncs `scripts/` (deploy-owned) but cannot place files in
`/etc/cron.d` (root-owned). Install/update them manually:

```bash
sudo cp infra/production/cron/gravity-room-* /etc/cron.d/
sudo chmod 644 /etc/cron.d/gravity-room-*
```

## Disaster recovery - accepted posture

Single-node is the deliberate trade for this stage. Documented targets:

- **RPO** (max data loss): up to 24h (last daily dump). Acceptable at current scale.
- **RTO** (time to restore): provision a new VPS, restore the latest offsite dump,
  re-point DNS - on the order of an hour, manual.
- **Mitigations in place:** daily dump on a separate device, `pg-vol` survives VM
  recreation, Hetzner delete+rebuild protection on the server and volume, weekly
  restore test, 5-min liveness heartbeat.
- **Not engineered (intentionally):** HA, replicas, multi-region. Revisit when the
  user base and RPO/RTO requirements justify the cost.

## Postgres major-version upgrade

Data lives at `/mnt/pg-vol/18` (PG18; the image stores data in a version-named
subdirectory). A major bump (e.g. PG19) is **not** a drop-in image tag change - the
new server will not start against an old-version data dir. Procedure:

1. Take a fresh dump (`scripts/backup.sh`) and verify it (`scripts/restore-test.sh`).
2. Stop the stack: `docker compose down`.
3. Move the old data dir aside: `mv /mnt/pg-vol/18 /mnt/pg-vol/18.bak`.
4. Bump the image tag to `postgres:19-alpine` in `docker-compose.yml`, deploy.
5. The fresh PG19 cluster initialises empty; restore the dump into it.
6. Verify, then remove `/mnt/pg-vol/18.bak`.

(`pg_upgrade` is an option but the dump/restore path is simpler and safe at this
data size.)
