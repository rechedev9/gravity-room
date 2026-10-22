---
name: vps-deploy
description: Diagnose a failed Gravity Room production deploy to the VPS and watch a deploy land, from GitHub Actions, the VPS containers and the public health checks.
---

# VPS deploy: diagnosis and monitoring

A push to `main` runs `.github/workflows/deploy.yml`: `CI backend` and the web checks, then
the `deploy` action of the private `rechedev9/vps-deploy` repo, read with the `VPS_DEPLOY_ACTION_KEY`
deploy key. The action builds `gravity-room-api` and `gravity-room-web` on the runner, sends them to the VPS over SSH and runs `docker compose up --wait` in
`/opt/gravity-room-app`. If `http://127.0.0.1:3001/api/health` fails within 60 s, it puts the
previous images back. `/opt/gravity-room-app/REVISION` names the commit that runs.

## Layout on the VPS

| Path                                  | Role                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `/opt/gravity-room-app/compose.yaml`  | `api` (host network, port 3001) and `web` (127.0.0.1:8114). VPS-only file.      |
| `/opt/gravity-room-deploy/.env`       | Production env, read by the `api` container.                                    |
| `/opt/gravity-room-deploy/Caddyfile`  | Shared edge Caddy: `/api/*` to 3001, the rest to 8114, security headers.        |
| `/opt/gravity-room-deploy/` compose   | Postgres (127.0.0.1:5433), Redis (the api reads it over TCP via `REDIS_URL`), the Caddy. |
| `/etc/cron.d/gravity-room`            | Analytics and maintenance crons (127.0.0.1:3001) and the nightly `backup.sh`.  |

The `api` container runs `migrate-deploy` before the server, so a failing migration fails the
deploy and the rollback keeps the old images. A rollback does not undo an applied migration.

## Checks

```bash
gh run list -R rechedev9/gravity-room --workflow deploy.yml --limit 3
gh run view <run-id> -R rechedev9/gravity-room --log-failed
ssh root@37.27.20.69 'cat /opt/gravity-room-app/REVISION; cd /opt/gravity-room-app && docker compose ps && docker compose logs --tail 50 api'
curl -s https://gravityroom.app/api/health                 # liveness only: {status, timestamp}
# Deep probe (db + redis blocks), needs INTERNAL_SECRET or CRON_SECRET:
curl -s https://gravityroom.app/api/internal/readiness -H "Authorization: Bearer $INTERNAL_SECRET"
# End-to-end check after a deploy:
gh workflow run production-smoke.yml -R rechedev9/gravity-room
```
