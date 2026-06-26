# Vercel cutover runbook

This document is the exact manual procedure to take Gravity Room live on Vercel as one same-origin project.
The migrated architecture is one Vercel project where the Vite/React PWA ships as static output and the ElysiaJS API runs as a Node serverless function at the root catch-all `api/[...path].ts`.
Read [`../.env.example`](../.env.example) for the full env template and [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the topology.
Every step below is a manual, out-of-repo action unless it says otherwise.

## Required environment variables

The table below is the canonical list pulled from the API code (`apps/backend/api/src/lib/env-validation.ts`) and `.env.example`, with the value or source for each Vercel environment.
Set each variable in the Vercel project under Settings then Environment Variables, scoping it to Production and Preview as noted.

- `DATABASE_URL` is the Neon POOLED PgBouncer connection string (host contains `-pooler`), set per-environment so Preview points at a Neon branch and Production points at the primary branch.
- `DIRECT_DATABASE_URL` is the Neon DIRECT (non-pooled) connection string for the same branch, used only by the build-time `db:deploy` migration step. It falls back to `DATABASE_URL` when unset.
- `JWT_SECRET` is a long random string of at least 64 characters, generated once per environment (Production and Preview should differ).
- `GOOGLE_CLIENT_ID` is the web Google OAuth client ID.
- `GOOGLE_CLIENT_IDS` is the comma-separated list of Android, iOS, and web Google OAuth client IDs accepted by the mobile auth endpoints.
- `UPSTASH_REDIS_REST_URL` is the Upstash database REST URL, and it is mandatory in Production (the API throws at cold start without it).
- `UPSTASH_REDIS_REST_TOKEN` is the Upstash database REST token, and it is mandatory in Production alongside the URL.
- `INTERNAL_SECRET` is a long random secret you generate, required in production, used as the Bearer token for manual operator calls to `/api/internal/*`.
- `CRON_SECRET` is a long random secret you generate and is REQUIRED in production, because Vercel automatically sends it as `Authorization: Bearer <CRON_SECRET>` on every scheduled cron invocation and without it every cron run is rejected with 401.
- `CORS_ORIGIN` is left EMPTY because the SPA and API share an origin, so no cross-origin is allowed in Production.
- `TRUSTED_PROXY` is auto-trusted on Vercel (the request logger treats the platform `VERCEL` env as a trusted proxy), so you normally leave it unset; set it to `true` only for non-Vercel self-hosting behind a reverse proxy.
- `SENTRY_DSN` is optional and, when set, enables `@sentry/node` error and performance tracing.
- `SENTRY_TRACES_SAMPLE_RATE` is optional and defaults to `0.1` when unset.
- `LOG_LEVEL` is optional and defaults to `info` (one of debug, info, warn, error).
- `ANALYTICS_BATCH_SIZE` is optional and defaults to `50` users processed per analytics compute cron tick.
- `JWT_ACCESS_EXPIRY` is optional and defaults to `15m`.
- `ADMIN_USER_IDS` is optional and holds comma-separated admin user UUIDs for program-definition approval.
- `RESEND_API_KEY` and `EMAIL_FROM` are optional and, when both set, enable transactional email (verification, password reset); email/password sign-in fails closed in production without them.
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

Generate a long random value and set it as the `CRON_SECRET` environment variable on the Vercel project.
When `CRON_SECRET` is present Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` to every cron request, and the internal routes accept it.
Without `CRON_SECRET` the three scheduled crons (`/api/internal/cleanup-tokens`, `/api/internal/purge-users`, `/api/internal/analytics/compute`) will receive 401 and silently fail.
The internal-route guard fails closed, so if neither `CRON_SECRET` nor `INTERNAL_SECRET` is set every internal request is rejected.

## (e) Run the first production deploy

Trigger a Production deploy from the Vercel dashboard or run `vercel --prod` from the repo root.
The build runs `scripts/vercel-build.sh`, which on `VERCEL_ENV=production` runs `pnpm --filter api db:deploy` to apply the Drizzle migrations and the idempotent reference-data seeds against `DIRECT_DATABASE_URL`, then regenerates the sitemap and builds the SPA with `VITE_API_URL=""` (the Chromium-free `build:no-prerender` path, since Vercel's build sandbox has no browser for the Playwright prerender).
The deploy step is idempotent and safe to re-run, and it is skipped on Preview and local builds (which point at the Neon branch).
After the deploy finishes, confirm the function and static output are live and that `GET /api/health` returns `status: ok` with a healthy `db` block.

## (f) Register the Vercel domain with Google OAuth

Open the Google Cloud Console, go to APIs and Services then Credentials, and edit the OAuth 2.0 web client used by `GOOGLE_CLIENT_ID`.
Add the production Vercel domain (for example `https://your-app.vercel.app` or your custom domain) to Authorized JavaScript origins.
Repeat the redirect-URI registration in each provider console you enabled (Apple, GitHub, Microsoft) for the `https://<domain>/api/auth/<provider>/callback` paths.
Save the changes and allow a few minutes for propagation, because the corresponding sign-in stays broken until the new origin/redirect is authorized.

## (g) Repoint mobile and rebuild Expo

Edit the mobile env so `EXPO_PUBLIC_API_URL` is the real production Vercel domain instead of the placeholder.
Rebuild and resubmit the Expo app (for example with an EAS build) so the new API base URL is baked into the binary.
Mobile already passes refresh tokens in the request body, so no cookie or CORS change is needed on the client.

## (h) Update GitHub branch protection required checks

The CI workflow `.github/workflows/ci.yml` now exposes the job names `Web`, `API`, `Domain`, `API client`, `Mobile`, `Format`, `Security headers`, `Exercise-wiki citation gate`, and `OpenAPI client drift`.
In the GitHub repository settings open Branches, edit the protection rule for `main`, and set the required status checks to those job names.
Remove any stale required checks left over from the deleted Railway, VPS deploy (`deploy.yml`), and `validate.yml` workflows so a merge is not blocked on checks that no longer run.

## (i) Verification checklist

Confirm a full sign-in and token-refresh round-trip by signing in with Google on the web app, letting an access token expire (or forcing a 401), and confirming the first-party refresh cookie drives a silent `/api/auth/refresh` back to a working session.
Confirm deep-link refresh by reloading the app on a deep route (for example a program detail URL) and confirming the SPA rewrite serves `index.html` and the session refreshes without a hard sign-out.
Confirm an internal cron route is guarded by calling `GET /api/internal/cleanup-tokens` with no `Authorization` header and observing a 401, then calling it again with `Authorization: Bearer <INTERNAL_SECRET>` and observing a success body.
Confirm the scheduled crons authenticate by checking the Vercel cron logs show 200 responses for `cleanup-tokens`, `purge-users`, and `analytics/compute` after their first scheduled runs.
Confirm the pull-based metrics endpoint is gone by requesting `GET /metrics` and observing a 404, since prom-client and the scrape endpoint were deleted in favor of Sentry plus pino logs.
Confirm analytics compute works end to end by invoking `/api/internal/analytics/compute` with the secret and reading the upserted insights back via `GET /api/insights`.
Confirm the body-size guard by sending a request body over 1MB to an API route and observing a 413 response.
