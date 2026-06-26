# Gravity Room - Vercel Migration Plan

## Locked architecture

We migrate the entire product to a single same-origin Vercel project.
The Vite + React + TanStack Router PWA ships unchanged as static output and calls a same-origin `/api`.
The existing ElysiaJS API is kept verbatim by importing its already-pure `createApp()` factory into one Node-runtime catch-all function that returns `app.fetch(request)`.
Persistence moves to Neon Postgres with the unchanged postgres-js + Drizzle driver on the pooled PgBouncer endpoint, and a separate direct endpoint drives deploy-time migrations.
All per-instance state moves to Upstash Redis over REST, and the Python analytics service is deleted and ported to TypeScript inside the API package.

We deliberately reject both the Elysia-to-Hono rewrite and the Vite-to-Next.js re-platform.
The judges converged on the Elysia-on-Node path as clearing every serverless blocker at materially lower risk, and the Next.js rewrite was scored the highest-risk, lowest-payoff line item for a client-rendered offline-first PWA.
We graft the strongest idea from the unification proposals, which is porting all analytics math to TypeScript to eliminate the numpy/scipy/scikit-learn 250MB function-size problem.

## Why this shape

The product owner weights quality, simplicity, robustness, scalability, and long-term maintainability over development cost.
Keeping Elysia, Vite, postgres-js, Drizzle, and the shared `@gzclp/domain` package untouched protects the tested business logic and the single source of truth for schema and domain rules.
Collapsing to one same-origin project removes an entire class of CORS, cookie, and cross-origin-URL bugs.
Porting analytics to TypeScript collapses the stack to one language and deletes the heaviest serverless risk, the Python native-dependency bundle.

## Resolving every serverless blocker

- Bun-only runtime is resolved by targeting Vercel Node and swapping the four Bun seams: `app.listen` becomes `app.fetch`, `server.requestIP` becomes `x-forwarded-for`, `import.meta.dir` becomes `fileURLToPath(import.meta.url)`, and `@sentry/bun` becomes `@sentry/node`.
- Boot-time migrations and seeds move out of the request path into a production-gated deploy step that runs `drizzle-kit migrate` plus the goose bridge, `CREATE EXTENSION`, and idempotent seeds against the direct Neon endpoint.
- The in-memory rate limiter and per-instance state are replaced by `@upstash/ratelimit` and Upstash REST for presence and caches, with Redis made mandatory in production and the in-memory fallback removed.
- Pull-based Prometheus is deleted entirely, including `/metrics`, prom-client, `collectDefaultMetrics`, and `METRICS_TOKEN`, and replaced by push-based `@sentry/node` tracing plus pino JSON to Vercel log drains.
- The oversized postgres-js pool is fixed by pointing `DATABASE_URL` at Neon's pooled PgBouncer endpoint with pool `max=1`, keeping `prepare:false`, and preserving the four interactive transactions because postgres-js speaks the standard wire protocol and neon-http is rejected.
- The ioredis persistent TCP connection is replaced by the connectionless `@upstash/redis` REST client across `lib/redis.ts`, `presence.ts`, and the cache modules.
- The `setInterval` token cleanup, the unscheduled GDPR purge script, and the analytics APScheduler are all replaced by Vercel Cron jobs hitting internal secret-guarded routes.
- Cross-origin cookie and CORS assumptions dissolve because the same-origin project keeps the refresh cookie first-party with `SameSite=Strict` unchanged, and CORS is dropped for the web origin.
- The health endpoint becomes a cheap stateless probe with no `process.uptime()`, and pino stays in plain-JSON mode.
- The analytics `run_all()` duration limit is resolved by a bounded least-recently-computed cursor batch per cron tick, which is crash-safe, idempotent, and needs no new queue infrastructure.
- The Python 250MB function-size cap is eliminated by deleting the service and porting all seven pipelines to TypeScript with a small shared stats helper, an ISO-week helper, and a JS IRLS logistic regression.

## Analytics serverless home

Analytics has a definite home: it becomes TypeScript inside the API package, invoked by a Vercel Cron job at `/api/internal/analytics/compute`.
Each cron tick selects a bounded batch of the least-recently-computed users via `computed_at` ordering and runs a per-user idempotent compute that upserts `user_insights` with `ON CONFLICT`.
The size-limit question is resolved by removing numpy, scipy, and scikit-learn outright, and parity is bounded by golden-file tests against the current Python outputs before the Python service is deleted.

## Observability

Observability uses a push and serverless-compatible approach only.
Errors and performance traces go to `@sentry/node`, and structured pino JSON logs are captured by Vercel log drains, with no scrape endpoint anywhere.

## Web and mobile

The web client calls the API same-origin by setting `VITE_API_URL=''` after relaxing the vite.config guard to throw only on a truly undefined value.
A `vercel.json` rewrite sends all non-`/api` paths to `/index.html` for SPA deep links, ordered after the API function routing, and the workbox `/api` caching and navigate-fallback denylist are unchanged.
Mobile only needs `EXPO_PUBLIC_API_URL` repointed at the new Vercel domain, because mobile already passes refresh tokens in the request body.

## Execution order

The work items proceed from infrastructure and the database layer, through the API entrypoint and state externalization, then the analytics port and cron routes, and finally the web build, `vercel.json`, CI, and cutover configuration.
Each item is independently executable with explicit dependencies and acceptance criteria, and the Python service is deleted only after its TypeScript replacement passes golden-file parity tests.

## Work items

- W1 - Provision Neon and Upstash, define the full serverless env surface (external resources + `.env.example`/`CLAUDE.md`).
- W2 - Make the DB layer serverless-safe (`db/index.ts` pool max=1, drop prom-client; `drizzle.config.ts` uses DIRECT_DATABASE_URL).
- W3 - Move migrations and seeds into a standalone deploy step (`scripts/migrate-deploy.ts`; strip DDL from `bootstrap.ts`).
- W4 - Add the Node catch-all serverless entrypoint `api/[...path].ts` and retire the listen path.
- W5 - Replace ioredis with Upstash REST for presence and caches.
- W6 - Rebuild rate limiting on `@upstash/ratelimit`.
- W7 - Remove pull-based metrics and switch Sentry to `@sentry/node`.
- W8 - Derive client IP from `x-forwarded-for` and make `/health` stateless.
- W9 - Make CORS same-origin and confirm cookie behavior.
- W10 - Port the analytics math foundation to TypeScript (stats, ISO-week, logistic).
- W11 - Port the seven insight pipelines and Drizzle data access.
- W12 - Add Vercel Cron internal routes for cleanup, purge, and analytics.
- W13 - Delete the Python analytics service.
- W14 - Relax the web build guard and configure same-origin SPA.
- W15 - Author `vercel.json` and the production-gated build pipeline.
- W16 - Update CI, lefthook, mobile URL, and Google authorized origin.

## Verification plan

Run `bun run typecheck`, `bun run lint`, `bun run format:check`.
Run `bun run --filter api test`, including the new analytics golden-file parity tests.
Build the web with `VITE_API_URL='' bun run --filter web build` and confirm relative `/api` requests.
Apply migrations to a fresh Neon branch via the deploy script run twice to prove idempotency.
Run `vercel build` to validate `vercel.json`, function bundling, the index.html rewrite, and cron declarations, then `vercel dev` or a preview deploy.
Run the Playwright E2E against the preview baseURL with focus on the auth path (sign-in, 401 -> refresh under the first-party cookie, sign-out, deep-link refresh).
Smoke-test the internal cron routes (401 without secret, success with it; analytics compute upserts insights read back by `GET /api/insights`; body over 1MB returns 413).

## Open risks

- TS logistic regression and Student-t CDF/quantile will not be bit-for-bit identical to scikit-learn/scipy; golden-file tests bound this, and degenerate/NaN handling must be replicated carefully before deleting Python.
- Cold-start latency for the catch-all Node function will raise first-request p99 versus the warm long-lived process; mitigate with lazy module-scope singletons.
- Upstash REST adds a network hop per rate-limit check and presence write on hot endpoints; validate latency budget.
- Neon pooled endpoint with max=1 can still spike connection counts under bursty concurrency; load-test and tune.
- Deploy-time migrations gated to production plus Neon branches for previews must be CI-gated to avoid a preview pointing at prod.
- Mounting Elysia via `app.fetch` must round-trip the full `/api/...` path, body, header casing, and Set-Cookie; this is the load-bearing adapter assumption and needs the auth+refresh E2E smoke test before cutover.
- Google Sign-In breaks until the new Vercel domain is registered as an authorized JavaScript origin in Google Cloud console (out-of-repo step).
- Dropping pull-based Prometheus loses existing dashboards/alerts until Sentry performance and Vercel observability are wired up.
