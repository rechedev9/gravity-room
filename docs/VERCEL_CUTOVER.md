# Vercel cutover runbook

This document is the exact manual procedure to take Gravity Room live on Vercel as one same-origin project.
The migrated architecture is one Vercel project where the Vite/React PWA ships as static output and the ElysiaJS API runs as a Node serverless function at the root catch-all `api/index.ts`.
Read [`../.env.example`](../.env.example) for the full env template and [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the topology.
Every step below is a manual, out-of-repo action unless it says otherwise.

## Required environment variables

The table below is the canonical list pulled from the API code (`apps/backend/api/src/lib/env-validation.ts`) and `.env.example`, with the value or source for each Vercel environment.
Set each variable in the Vercel project under Settings then Environment Variables, scoping it to Production and Preview as noted.

- `DATABASE_URL` is the Neon POOLED PgBouncer connection string (host contains `-pooler`), set per-environment so Preview points at a Neon branch and Production points at the primary branch.
- `DIRECT_DATABASE_URL` is the Neon DIRECT (non-pooled) connection string for the same branch, used only by the build-time `db:deploy` migration step. It is mandatory for Production; the deploy fails before building or changing the database when it is unset. Only local/CI runs may fall back to `DATABASE_URL`.
- `JWT_SECRET` is a long random string of at least 64 characters, generated once per environment (Production and Preview should differ).
- `GOOGLE_CLIENT_ID` is the web Google OAuth client ID.
- `GOOGLE_CLIENT_IDS` is the comma-separated list of Android, iOS, and web Google OAuth client IDs accepted by the mobile auth endpoints.
- `UPSTASH_REDIS_REST_URL` is the Upstash database REST URL, and it is mandatory in Production (the API throws at cold start without it).
- `UPSTASH_REDIS_REST_TOKEN` is the Upstash database REST token, and it is mandatory in Production alongside the URL.
- `INTERNAL_SECRET` is required in production for manual `/api/internal/*` calls. Generate at least 32 random bytes (for example, `openssl rand -hex 32`); it must differ from `CRON_SECRET`.
- `CRON_SECRET` is REQUIRED in production and must be a different value with at least 32 random bytes. Vercel sends it as `Authorization: Bearer <CRON_SECRET>` on scheduled cron invocations.
- `CORS_ORIGIN` is left EMPTY because the SPA and API share an origin, so no cross-origin is allowed in Production.
- `TRUSTED_PROXY` is auto-trusted on Vercel (the request logger treats the platform `VERCEL` env as a trusted proxy), so you normally leave it unset; set it to `true` only for non-Vercel self-hosting behind a reverse proxy.
- `SENTRY_DSN` is optional and, when set, enables `@sentry/node` error and performance tracing.
- `SENTRY_TRACES_SAMPLE_RATE` is optional and defaults to `0.1` when unset.
- `LOG_LEVEL` is optional and defaults to `info` (one of debug, info, warn, error).
- `ANALYTICS_BATCH_SIZE` is optional, must be an integer from `1` to `100`, and defaults to `50` users per analytics compute tick.
- `JWT_ACCESS_EXPIRY` is optional and defaults to `15m`.
- `ADMIN_USER_IDS` is optional and holds comma-separated admin user UUIDs for program-definition approval.
- `RESEND_API_KEY` and `EMAIL_FROM` are optional and, when both set, enable transactional email (verification, password reset); email/password sign-in fails closed in production without them. Never set local-only `LOG_AUTH_ACTION_LINKS=true` in Vercel.
- `APPLE_CLIENT_ID`, `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`, and `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET`/`MICROSOFT_TENANT_ID` are optional and enable the corresponding social sign-in methods.
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are optional and enable new-user alerts.
- `VITE_API_URL` is a build-time web variable that must be empty for same-origin, and the build script (`scripts/vercel-build.sh`) already exports `VITE_API_URL=""` so you do not need to set it in the dashboard.
- `VITE_GOOGLE_CLIENT_ID` is a build-time web variable (the web Google OAuth client ID, same value as `GOOGLE_CLIENT_ID`) that the SPA reads at build time; set it in the dashboard scoped to Production and Preview or web Google sign-in stays broken.
- `VITE_SENTRY_DSN` and `VITE_PLAUSIBLE_DOMAIN` are optional build-time web variables for browser error tracing and analytics.

Do NOT set any of the removed variables `REDIS_URL`, `METRICS_TOKEN`, `DB_POOL_SIZE`, or `COMPUTE_INTERVAL_HOURS`, because they no longer exist in the codebase.

## (a) Provision Neon Postgres

Create a new Neon project in the Neon console and select the region closest to your Vercel functions region.
On the project dashboard open the Connection Details panel and copy the POOLED connection string whose host contains `-pooler`, which becomes `DATABASE_URL`.
Toggle the panel to the DIRECT connection string for the same database and copy it, which becomes `DIRECT_DATABASE_URL`.
Create a Neon branch named something like `preview` from the primary branch so previews never touch production data.
Capture that preview branch's own pooled and direct connection strings for the Preview-scoped `DATABASE_URL` and `DIRECT_DATABASE_URL`.

## (b) Provision Upstash Redis

Create a new Upstash Redis database in the Upstash console in a region close to your Vercel functions.
From the database details page copy the REST URL into `UPSTASH_REDIS_REST_URL` and the REST token into `UPSTASH_REDIS_REST_TOKEN`.
You may create a second Upstash database for Preview to isolate preview state, or reuse the same one if isolation is not required.

## (c) Create the Vercel project and set environment variables

Import the gravity-room repository into Vercel as a new project, or link it with the Vercel CLI from the repo root.
The repo already pins `framework: null`, `installCommand`, `buildCommand`, `outputDirectory`, function config, rewrites, and cron declarations in `vercel.json`, so you do not configure the build in the dashboard.
Add every variable from the Required environment variables table above, scoping each to both Production and Preview.
For Production scope `DATABASE_URL` and `DIRECT_DATABASE_URL` to the Neon primary branch strings, and for Preview scope them to the Neon `preview` branch strings.
Use distinct `JWT_SECRET`, `INTERNAL_SECRET`, and `CRON_SECRET` values for Production and Preview.
Leave `CORS_ORIGIN` empty in both environments and leave `TRUSTED_PROXY` unset (Vercel auto-trusts the platform proxy).

## (d) Set CRON_SECRET so Vercel cron auth works

Generate at least 32 random bytes (`openssl rand -hex 32`) and set the result as `CRON_SECRET`; generate a separate value for `INTERNAL_SECRET`.
When `CRON_SECRET` is present Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` to every cron request, and the internal routes accept it.
Without `CRON_SECRET` the two scheduled daily crons (`/api/internal/analytics/compute` and `/api/internal/maintenance`, the latter running token cleanup plus the soft-deleted-user purge) will receive 401 and silently fail.
The internal-route guard fails closed, so if neither `CRON_SECRET` nor `INTERNAL_SECRET` is set every internal request is rejected.

## (e) Gate and run the first production deploy

Before enabling Vercel production deployment, complete the external controls in step (h). The repository cannot configure GitHub rulesets or Vercel project access settings: `main` must reject direct/force pushes and require the `Validate` check before merge. This is the promotion gate that prevents Vercel from seeing an unvalidated production commit.

Trigger a Production deploy from the Vercel dashboard or let the protected merge to `main` trigger the Git integration. `scripts/vercel-build.sh` validates the production environment and Vercel routing, bundles the API, builds the SPA, and completes its Chromium prerender **before** applying production DDL. Only after those artifacts pass does it run `pnpm --filter api db:deploy` against the required `DIRECT_DATABASE_URL`. The deploy script holds a PostgreSQL advisory lock across migrations and idempotent reference seeds, so concurrent production builds serialize.

Vercel does not expose a transactional hook spanning database migration, artifact upload, and production promotion. A platform failure after `db:deploy` can therefore leave the expanded schema ahead of the previous live app. Every production schema change must use expand/contract compatibility: deploy additive/backward-compatible DDL first, deploy code that can use both shapes, and remove old structures only in a later independently validated deploy. Review destructive generated SQL explicitly and take the provider-appropriate backup/restore precaution before approval.

Preview and local builds skip the production database deploy. After production promotion, run `PRODUCTION_URL=https://gravityroom.app pnpm run security:production-routes`, then confirm cheap public liveness with `GET /api/health`. Probe dependencies separately with authenticated `GET /api/internal/readiness` and verify healthy `db` and `redis` blocks. `.github/workflows/production-smoke.yml` repeats the route/header check after successful Vercel Production deployment events, on demand, and daily.

## (f) Register the Vercel domain with Google OAuth

Open the Google Cloud Console, go to APIs and Services then Credentials, and edit the OAuth 2.0 web client used by `GOOGLE_CLIENT_ID`.
Add the production Vercel domain (for example `https://your-app.vercel.app` or your custom domain) to Authorized JavaScript origins.
Repeat the redirect-URI registration in each provider console you enabled (Apple, GitHub, Microsoft) for the `https://<domain>/api/auth/<provider>/callback` paths.
Save the changes and allow a few minutes for propagation, because the corresponding sign-in stays broken until the new origin/redirect is authorized.

## (g) Repoint mobile and rebuild Expo

Edit the mobile env so `EXPO_PUBLIC_API_URL` is the real production Vercel domain instead of the placeholder.
Rebuild and resubmit the Expo app (for example with an EAS build) so the new API base URL is baked into the binary.
Mobile already passes refresh tokens in the request body, so no cookie or CORS change is needed on the client.

## (h) Configure the external production promotion gate

The CI workflow exposes one aggregate required check named `Validate`; it depends on build/type/lint/test jobs, DB-backed API security tests, immutable-action secret scanning, deployment-config checks, and the production dependency policy.

This protection cannot be encoded in repository files. In GitHub Settings → Rules → Rulesets (or the branch-protection rule), protect `main` as follows:

1. Require a pull request and require branches to be up to date before merging.
2. Require the single `Validate` status check.
3. Block direct pushes and force pushes, including for administrators unless using a documented break-glass procedure.
4. Remove stale Railway/VPS/old-workflow checks.

In Vercel Settings → Git, verify that only the protected `main` branch is the Production Branch and restrict manual production deployments to trusted maintainers. Do not configure an unprotected branch as production. After changing either GitHub or Vercel settings, merge a harmless PR and confirm Vercel does not begin a production build until the required PR check has passed.

## (i) Verification checklist

Confirm a full sign-in and token-refresh round-trip by signing in with Google on the web app, letting an access token expire (or forcing a 401), and confirming the first-party refresh cookie drives a silent `/api/auth/refresh` back to a working session.
Run `PRODUCTION_URL=https://gravityroom.app pnpm run security:production-routes` (or dispatch `Production route smoke`). It requires HTTP 200 plus HTML for supported deep links and `Referrer-Policy: no-referrer` on `/reset-password` and `/verify-email`. Also reload an authenticated program detail URL and confirm the session refreshes without a hard sign-out.
Confirm `GET /api/health` returns public liveness without dependency diagnostics. Confirm deep readiness is guarded by calling `GET /api/internal/readiness` without authorization and observing 401, then with `Authorization: Bearer <INTERNAL_SECRET>` and observing healthy `db`/`redis` blocks. Confirm another internal route such as `GET /api/internal/cleanup-tokens` is guarded the same way.
Confirm the scheduled crons authenticate by checking the Vercel cron logs show 200 responses for `analytics/compute` and `maintenance` after their first scheduled runs.
Confirm the pull-based metrics endpoint is gone by requesting `GET /metrics` and observing a 404, since prom-client and the scrape endpoint were deleted in favor of Sentry plus pino logs.
Confirm analytics compute works end to end by invoking `/api/internal/analytics/compute` with the secret and reading the upserted insights back via `GET /api/insights`.
Confirm the body-size guard by sending a request body over 1MB to an API route and observing a 413 response.
