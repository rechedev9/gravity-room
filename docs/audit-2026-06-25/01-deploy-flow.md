# Workstream 1 - Deploy flow (GitHub → VPS) review + optimizations

Owner: main agent. Goal: review the GitHub → VPS deploy end to end and apply optimizations that stop
the recurring deploy pain.

## 🔴 P0 incident found + resolved: production was DOWN

While reviewing the deploy history I found **production had been offline since the 2026-06-24 deploy**
(`gravityroom.app` + `api.gravityroom.app` refused on :80/:443).

Root cause (two compounding issues):

1. **Caddy :443 recreate race (deploy.yml).** The deploy ran
   `docker compose up -d --no-deps --force-recreate caddy`, which always recreates caddy. The old
   container had not released `:443` when the new one tried to bind →
   `failed to bind host port 0.0.0.0:443/tcp: address already in use`. The 2026-06-24 deploy died
   there and left `gravity-room-caddy-1` stuck in **Created** (never started) → no reverse proxy →
   whole site down. (api/analytics/postgres/redis were all Up + healthy the entire time.)
2. **Tailscale Serve had grabbed :443.** A `tailscale serve` (tailnet-only) proxying
   `https://openchamber.taila10698.ts.net → http://127.0.0.1:3000` made `tailscaled` listen on `:443`.
   Once the 06-24 deploy released caddy's bind, tailscaled held `:443`, so caddy could never rebind it
   even on a manual restart.

Resolution (with the owner's choice of fix):

- Moved Tailscale Serve from `:443` to `:8443` (`tailscale serve reset` →
  `tailscale serve --bg --https=8443 http://127.0.0.1:3000`). Tailnet access preserved at
  `https://openchamber.taila10698.ts.net:8443`. This freed `:443`.
- Recreated caddy: it now publishes `0.0.0.0:80` + `0.0.0.0:443` (v4 + v6) cleanly.
- Verified externally: `gravityroom.app` → 200, `api.gravityroom.app/health` → `{"status":"ok"}`,
  `www` → 301. **Site restored.**

## Changes applied (prevent recurrence)

1. **`.github/workflows/deploy.yml`** - removed the `--force-recreate caddy` step. Caddyfile changes
   now apply via a hot `caddy reload` (the Caddyfile is a bind-mounted volume, so reload suffices),
   with a fallback to `docker compose up -d --no-deps caddy` only when caddy is not running. This kills
   the :443 recreate race that caused the outage.
2. **`apps/frontend/web/scripts/prerender.ts`** - the prerender (run by both CI `build-web` and the
   local pre-push `build` hook) hardcoded preview port `4173` + `--strictPort`, so it failed with
   "Port 4173 is already in use" whenever a prior run was orphaned (repeatedly blocked pushing to main
   this session). Now: picks a free ephemeral port per run, reaps the preview process tree on Windows
   (`taskkill /T`, since SIGTERM to `bunx` leaves the vite grandchild), and retries `chromium.launch`
   (3x, 60s) to ride out cold/contended launch timeouts.

## Findings (deploy.yml review)

- **Transient registry 503s fail the whole deploy.** 2026-06-23 deploy failed on
  `Build analytics image` with `503 upstream connect error ... connection timeout` from the registry.
  `build-images` has `fail-fast: true`, so a transient analytics 503 skips the deploy entirely.
  Recommendation: add a retry around the buildx step (or split build/push with retry). Not yet applied
  (needs a Docker-build to validate and is lower-severity than the outage).
- **No rollback on failed health check.** The `Health check via VPS` step exits 1 on failure but leaves
  the just-pulled images running. Consider an automatic rollback to the previous `:sha` tag on health
  failure (the last week of images is retained, so rollback is cheap).
- **Playwright Chromium is reinstalled every deploy.** `build-web` runs
  `bunx playwright install --with-deps chromium` with no cache. Caching `~/.cache/ms-playwright` keyed
  on the Playwright version would shave install time off every deploy.
- Deploy structure is otherwise solid: env pre-flight (`check-env.ts`), DB index assertion, prod
  security-header verification, image pruning, IndexNow ping.

## Open items

- [ ] Registry-503 retry on `build-images` (transient-failure resilience).
- [ ] Auto-rollback to previous `:sha` on health-check failure.
- [ ] Cache Playwright browser install in `build-web`.
- [x] Confirm the new deploy (with the caddy fix) succeeds end to end. **DONE** - deploy run
      `28193503567` (commit `3c5c471`) finished **success**; prod verified externally (web 200, API
      health ok, fresh api uptime). First green deploy after the outage; the caddy hot-reload kept the
      site up through the deploy (no :443 race).
- [ ] Minor: deploy.yml pins `actions/checkout|upload-artifact|download-artifact` at versions that
      target Node 20 (now deprecation-warned, forced onto Node 24). Bump to current major when convenient.

## Log (newest first)

- 2026-06-25: Found + resolved the P0 outage (above). Applied deploy.yml caddy hot-reload fix +
  prerender dynamic-port/tree-kill/retry fix. typecheck:web green.
- 2026-06-25: Started. Pre-push `build` hook (full prod build + Playwright prerender + headless
  Chromium) is flaky on Windows (port 4173 / Chromium launch). Cleaned orphans to unblock; root-caused
  to the hardcoded preview port - now fixed.
