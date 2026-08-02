# Security audit — 2026-08-02

## Executive summary

**Target commit:** `eb434651dfb2cc1fbe7abebce54f2970040b1d63`  
**Audit branch:** `audit/security-20260802`  
**Worktree:** `/home/luisreche/projects/gravity-room.security-audit-20260802`  
**Scope:** API, authentication, authorization, data layer, web/PWA, Expo mobile, Vercel deployment, CI/CD, dependencies, secrets, logging, and privacy boundaries.

The audit used six independent specialist reviews plus primary-source validation. It combined static tracing, test execution, dependency analysis, secret/sink searches, and non-destructive production probes.

### Result

- **Critical:** 0
- **High:** 2
- **Medium:** 16
- **Low / hardening:** 12
- **Confirmed cross-tenant API IDOR/BOLA:** none
- **Confirmed SQL injection, request-controlled SSRF, unsafe deserialization, or stored XSS:** none

The highest-priority issues found in the target commit were:

1. A race could create a refresh token after password reset had revoked sessions, allowing old credentials to survive the reset.
2. Authenticated users had no cumulative data quotas; repeated large imports could grow Postgres indefinitely and amplify analytics work.
3. Login accepted cross-origin form posts and was vulnerable to login CSRF/session fixation.
4. Mobile account switching failed open when local data cleanup failed, exposing the previous account's offline data.
5. Password reset and verification tokens remained in URLs and could be attached to Sentry events if frontend Sentry was enabled.
6. Production returned 500 for unknown API paths and 404 for valid SPA deep links, including account recovery routes.

### Remediation branch status

The findings below describe the audited baseline. This branch implements the concrete
application, authentication, quota, client-isolation, privacy, gateway, deployment,
CI, dependency, and migration remediations, with unit and PostgreSQL-backed regression
coverage. Production-route behavior can only be verified after this branch is deployed.
PostgreSQL row-level security and the deferred refresh-token contract migration remain
open follow-up work because they require explicit owner decisions and a staged rollout.

### Post-audit deployment/database review status

Follow-up work in this audit branch adds expand-only migration and supply-chain
controls, but it does not make every database risk remediated. In particular,
PostgreSQL RLS remains disabled: tenant isolation is application-enforced and the
runtime database role can access cross-tenant rows. That residual risk remains open
pending owner decisions on tenant context, support/admin access, pooled transaction
boundaries, and role separation; this report does not claim that it is accepted or
remediated.

Migration 0044 deliberately defers the `refresh_tokens.family_id` `NOT NULL`
contract for compatibility with the previously deployed artifact. Migration 0045
deliberately leaves ambiguous historical exercise identities NULL and defers
constraint validation outside the deployment build. The required contract,
batched-validation, immutable-provenance, role, policy, and direct-SQL testing plan
is tracked in [`DATABASE_SECURITY_ROLLOUT.md`](./DATABASE_SECURITY_ROLLOUT.md).
Reports must continue to describe RLS as an open defense-in-depth gap until that
plan is approved and deployed.

## Severity model

- **High:** credible account compromise, revocation bypass, or broad availability/cost impact.
- **Medium:** meaningful confidentiality, integrity, availability, authentication, or privacy weakness with prerequisites or limited blast radius.
- **Low:** defense-in-depth, conditional configuration, same-account integrity, or operational hardening.

---

## High findings

### H-01 — Password-reset revocation can be bypassed by concurrent token issuance

**CWE:** CWE-367, CWE-613  
**Affected:**

- `apps/backend/api/src/services/auth.ts:340-348`
- `apps/backend/api/src/routes/auth.ts:279-317`
- `apps/backend/api/src/services/auth.ts:569-594`
- `apps/backend/api/src/services/auth.ts:766-774`

**Evidence**

Password login verifies the old password and returns a user row carrying `authVersion=N`. `issueTokens()` then signs an access token and inserts a refresh token without locking the user or rechecking the expected auth version. Password reset independently increments `authVersion` and deletes existing refresh tokens in a transaction.

A valid interleaving is:

1. Attacker starts login with the old password and completes password verification.
2. Victim completes password reset; `authVersion` becomes `N+1` and existing refresh tokens are deleted.
3. The in-flight login inserts its refresh token after that deletion.
4. Its initial access JWT contains stale version `N` and is rejected, but its surviving refresh token can be rotated.
5. Rotation reloads the current user and issues a valid access JWT with version `N+1`.

**Impact**

An attacker who knows the old password can preserve access across the victim's password reset by racing login issuance against reset. This violates the reset flow's explicit all-session revocation guarantee.

**Remediation**

Issue refresh tokens under a user-row lock and an expected-version check:

1. Pass the authenticated user's expected `authVersion` into token issuance.
2. In one transaction, `SELECT ... FOR UPDATE` the active user.
3. Verify `authVersion` still matches and `deletedAt IS NULL`.
4. Insert the refresh token while holding the lock.

Then reset either deletes an already-created token or causes a later issuance to fail. Add a DB-backed race test for this exact interleaving.

---

### H-02 — Unbounded per-account data growth enables authenticated storage and analytics DoS

**CWE:** CWE-400, CWE-770  
**Affected:**

- `apps/backend/api/src/routes/programs.ts:339-390`
- `apps/backend/api/src/services/programs.ts:622-695`
- `apps/backend/api/src/services/exercises.ts:332-405`
- `apps/backend/api/src/analytics/queries.ts:96-125`
- `apps/backend/api/src/routes/internal.ts:130-151`
- `apps/backend/api/src/middleware/rate-limit.ts:56-86`

**Evidence**

The effective Vercel gateway body limit is 1 MiB, but an import can still materialize and bulk-insert thousands of result and undo rows. Accounts may repeat imports and create instances or exercises indefinitely. There is no cumulative quota on instances, results, undo entries, custom exercises, JSONB bytes, or total account storage.

Analytics subsequently reads the user's complete workout history without a row/time bound and processes users sequentially. Non-auth resource write limits fail open during Redis errors.

**Impact**

A free authenticated account can cause sustained Postgres/index growth and make analytics queries increasingly expensive. Repetition can exhaust statement/function timeouts, delay analytics for later users, and increase infrastructure cost.

**Remediation**

- Enforce transactional per-user quotas for instances, results, undo rows, custom exercises, and JSONB bytes.
- Add an aggregate row limit per import, not only per-dimension limits.
- Use hourly/daily cost-weighted limits for imports.
- Bound or partition analytics history and process large histories asynchronously.
- Fail closed for high-amplification writes when the distributed limiter is unavailable.

---

## Medium findings

### M-01 — Login CSRF can force a victim into the attacker's account

**CWE:** CWE-352  
**Affected:** `apps/backend/api/src/routes/auth.ts:710-731`, `apps/backend/api/src/create-app.ts:149-157`

Elysia accepts `application/x-www-form-urlencoded` bodies for the login object. The route does not require JSON and does not validate `Origin` or Fetch Metadata. CORS prevents reading a response but does not prevent a cross-origin HTML form submission. A top-level cross-site form POST can therefore log the browser into an attacker-controlled account and install the refresh cookie. The victim may then enter training data into an account visible to the attacker.

**Fix:** require `application/json` on JSON auth routes and reject cross-site session-creating requests using `Origin` and/or `Sec-Fetch-Site`. Consider an explicit login CSRF token.

### M-02 — Microsoft sign-in can claim an unverified email for a new account

**CWE:** CWE-345  
**Affected:**

- `apps/backend/api/src/lib/microsoft-auth.ts:194-212`
- `apps/backend/api/src/services/auth.ts:199-246`
- `apps/backend/api/src/routes/auth.ts:1223-1241`

The Microsoft verifier correctly recognizes that an `email` claim may be unverified, especially for configurable `common`/`organizations` tenants or Graph userinfo fallback. Existing-account linking rejects such claims, but the new-account branch still creates a globally unique user with `emailVerified=false`, links the Microsoft identity, and immediately issues a session.

A malicious tenant administrator may therefore reserve or impersonate an as-yet-unregistered external email inside Gravity Room. This does not take over an existing verified account, but blocks the real owner and creates an authenticated internal identity under that address.

**Fix:** never assign an unverified email to an authenticated account. Keep a provisional provider identity keyed by provider `sub`, then require email verification before claiming the address or enabling the account.

### M-03 — Refresh-token reuse detection retains only one predecessor

**CWE:** CWE-613  
**Affected:**

- `packages/database/src/schema.ts:91-118`
- `apps/backend/api/src/services/auth.ts:662-670,706-755`
- `apps/backend/api/src/routes/auth.ts:339-367`

Only the active token row and its immediate `previousTokenHash` are retained. After `A → B → C`, deleting `B` removes the only row that links `A` to the family. Replaying `A` returns 401 but can no longer identify and revoke the affected user. An attacker who wins a refresh race can advance the token twice before the legitimate client's retry and evade family revocation.

**Fix:** use a stable family/session ID and retain consumed-token tombstones through the family's maximum TTL. Any replay of a consumed ancestor must revoke the family and increment `authVersion`.

### M-04 — Authentication and recovery abuse controls are IP-only

**CWE:** CWE-307  
**Affected:**

- `apps/backend/api/src/routes/auth.ts:711-715,784-803,830-840`
- `apps/backend/api/src/middleware/rate-limit.ts:56-70`
- `apps/backend/api/src/services/auth.ts:486-502,539-550`

Distributed clients can multiply login attempts against one account. For verification and password reset, each request also replaces the prior token, allowing rotating IPs to invalidate legitimate links repeatedly and email-bomb a known address.

**Fix:** combine IP/IP-prefix limits with an HMAC of normalized email/account ID, a global endpoint budget, per-recipient cooldown, and daily quotas. Keep responses generic.

### M-05 — Mobile account isolation fails open when cleanup fails

**CWE:** CWE-200  
**Affected:**

- `apps/frontend/mobile/src/app/auth-provider.tsx:58-73,91-96,139-196`
- `apps/frontend/mobile/src/lib/db/client.ts:70-78`
- `apps/frontend/mobile/src/lib/db/schema.ts:1-34`

When the owner changes, failures clearing SQLite or the outbox are ignored. The new session is still published and queued mutations are flushed. Mobile tables are not partitioned by account, so a shared device can display the previous user's programs if SQLite is locked, corrupt, full, or otherwise unavailable during logout/account switch.

**Fix:** fail closed until owner validation and cleanup succeed. Prefer `owner_user_id` on every local row or a database per account. Never reassign/clear the owner marker after failed data deletion.

### M-06 — Reset/verification tokens remain in URLs and can reach Sentry

**CWE:** CWE-598, CWE-200  
**Affected:**

- `apps/backend/api/src/lib/email.ts:74-100`
- `apps/frontend/web/src/features/auth/auth-flows.tsx:16-19,105-152,212-240`
- `apps/frontend/web/src/lib/sentry.ts:19-26`
- `vercel.json:35-38`

Action links use `?token=...`. The SPA reads but does not immediately remove the query. Reset tokens remain visible while the form is completed and indefinitely on errors. Browser history, screenshots, initial Vercel requests, and same-origin referrers can retain the value.

More importantly, Sentry Browser's default `HttpContext` integration adds `window.location.href` to captured events. The app has no frontend `beforeSend` sanitizer, so an exception on these routes can send a live reset/verification token to Sentry when `VITE_SENTRY_DSN` is enabled. The probed production bundle did not currently contain an active frontend DSN, so this is a latent configuration-triggered exposure.

**Fix:** extract the token and immediately call `history.replaceState` before asynchronous work or telemetry initialization. Add `Referrer-Policy: no-referrer` on action routes and a Sentry `beforeSend` sanitizer that removes URLs/query parameters. A server-side one-time exchange into a short-lived HttpOnly cookie is stronger.

### M-07 — Password reset performs Argon2 before validating the reset token

**CWE:** CWE-400  
**Affected:** `apps/backend/api/src/routes/auth.ts:865-874`

Every syntactically valid random token forces an Argon2 password hash before the cheap token lookup. The 10/minute cap is IP-only, making this a distributed CPU/memory and serverless-cost amplifier.

**Fix:** hash and validate the reset token first, then compute Argon2 only for an existing, unexpired token. Preserve single use with the final `DELETE ... RETURNING` transaction and add a global budget.

### M-08 — Public health checks directly amplify DB and Redis work

**CWE:** CWE-400  
**Affected:** `apps/backend/api/src/create-app.ts:233-283`

Every unauthenticated, uncached `/api/health` request runs `SELECT 1` and `redis.ping()`. Live probing confirmed this route is publicly reachable and uncached.

**Fix:** separate a cheap in-memory public liveness endpoint from a protected readiness/dependency probe. Rate-limit or edge-cache the deep check.

### M-09 — Unknown API paths crash the production function

**CWE:** CWE-755  
**Affected:** `apps/backend/api/src/middleware/request-logger.ts:157-160`, `api/index.ts:95`

Live production probes on 2026-08-02 confirmed `/api/nope`, `/api/`, `/api/swagger/json`, and `/api/metrics` return `500 FUNCTION_INVOCATION_FAILED`, not controlled 404 responses. The `app.fetch` path can reach `mapResponse` without a derived `reqLogger`, but the hook unconditionally calls `reqLogger.info()`.

**Impact:** attackers can cheaply generate function failures, alert/log noise, and potentially unsanitized error paths.

**Fix:** make the response logger tolerate missing context, add a final gateway error boundary, and test the real `app.fetch`/`api/index.ts` path for unknown routes and early exceptions.

### M-10 — Guest migration is not bound to the eventual account

**CWE:** CWE-200, CWE-639 (local boundary)  
**Affected:**

- `apps/frontend/web/src/lib/guest-storage.ts:12-21,48-63`
- `apps/frontend/web/src/lib/guest-migration.ts:42-47,109-144`
- `apps/frontend/web/src/hooks/use-guest-migration.ts:23-36`

The migration intent is a seven-day global browser marker. Any user who authenticates in that browser while it is fresh and has no active program can receive the guest data. On a shared browser, one person's training history can be imported into another person's account.

**Fix:** require explicit post-login confirmation, or bind migration intent to a one-time server nonce and intended identity.

### M-11 — Result validation fails open for inactive or unhydratable templates

**CWE:** CWE-20  
**Affected:**

- `apps/backend/api/src/services/catalog.ts:154-181`
- `apps/backend/api/src/services/results.ts:88-102,245-307`

Catalog lookup only resolves active templates. Result validation returns `undefined` rather than rejecting when a historical template is inactive or hydration fails, and the mutation proceeds. Owners of such instances can write arbitrary bounded slot IDs and indices not present in the original program.

**Fix:** resolve historical definitions independently of catalog visibility, ideally from a versioned instance snapshot. Fail closed with 409/422 when validation cannot be performed.

### M-12 — Valid SPA deep links return 404 in production

**CWE:** CWE-670 (recovery reliability)  
**Affected:** `vercel.json:7,13-21`

Live probes confirmed `/app`, `/app/programs`, `/reset-password`, and `/verify-email` return HTTP 404 while serving an SPA shell that later hydrates. Account recovery links therefore depend on a browser ignoring the status; scanners, monitors, proxies, and non-browser clients may treat them as invalid.

**Fix:** use a `cleanUrls`-compatible SPA fallback (typically rewrite to `/`) and add production-route status tests requiring 200 for all supported deep links.

### M-13 — Dependency advisories are present without a CI gate

**CWE:** CWE-1104  
**Affected:** `pnpm-lock.yaml`, `.github/workflows/ci.yml`

`pnpm audit --prod` reported **1 critical, 5 high, and 5 moderate** advisories, including vulnerable versions of `tar`, `brace-expansion`, `js-yaml`, `postcss`, and `@hono/node-server`.

Applicability matters: most critical/high paths are Expo/build tooling, and the Hono advisory affects `serve-static`, which Gravity Room does not use. No remotely reachable exploit was confirmed in the production API. They still affect developer/build supply-chain surfaces and currently have no audit gate.

**Fix:** update to patched transitive versions, remove unnecessary root runtime dependencies, and add OSV/dependency-review or a policy-driven `pnpm audit` gate with documented, expiring exceptions.

### M-14 — Production migration ordering can leave schema and artifact out of sync

**CWE:** CWE-1109 / operational integrity  
**Affected:**

- `scripts/vercel-build.sh:28-55`
- `apps/backend/api/src/scripts/migrate-deploy.ts:26-40`

Vercel runs migrations and seeds before bundling/building the artifact. A later build failure leaves the production database migrated while the previous application remains live. Production DDL also falls back to `DATABASE_URL` when direct/unpooled URLs are absent, despite documentation requiring direct DDL.

Vercel deployment from `main` is not explicitly gated on the same CI run, so production and CI can race after a push.

**Fix:** require successful CI/promotion, require a direct URL in production, serialize migrations with an advisory lock, use expand/contract changes, and perform all possible artifact validation before irreversible schema changes.

### M-15 — Privacy disclosures conflict with configured PII processors

**CWE:** privacy/compliance  
**Affected:**

- `apps/backend/api/src/routes/auth.ts:430-459` and social signup branches
- `apps/backend/api/src/lib/telegram.ts:35-53`
- `apps/frontend/web/src/lib/sentry.ts:42-47`
- `apps/frontend/web/src/lib/i18n/locales/en/translation.json:1395-1398`

When configured, new-user notifications send the user's email to Telegram. Frontend Sentry explicitly receives user ID and email. The privacy policy says no data is shared with third parties and does not disclose these processors.

**Fix:** minimize telemetry identifiers, remove email where possible, document each processor and purpose, establish retention/access controls, and align both supported locales with actual behavior.

### M-16 — Gitleaks scans unrelated remote refs and leaves the security gate permanently red

**CWE:** CWE-693 (ineffective protection)  
**Affected:** `.github/workflows/ci.yml:279-317`, `.gitleaks.toml`

The push workflow checks out full history and invokes Gitleaks without limiting its Git revision range. The resulting scan includes remote refs unrelated to `main`. Current CI fails on 11 UUID false positives reachable only from the old `origin/codex/mobile-v2` branch, while a scan of HEAD and the history reachable from `main` is clean. This has already caused otherwise-successful `main` CI runs to lose the aggregate `Validate` signal.

A permanently red secret scan trains maintainers to ignore or bypass the control and can mask a real leak. Broad path allowlists added to suppress noise would create the opposite failure mode.

**Fix:** scan history reachable from the pushed HEAD on `push`, and the explicit base-to-head range on pull requests. Narrow allowlists to specific fingerprints/rules with justification and expiry; retire the obsolete remote branch if it is no longer needed.

---

## Low and hardening findings

### L-01 — Logout does not revoke the current access JWT; account deletion lacks step-up

Normal logout revokes refresh state only. A copied access JWT remains valid for up to 15 minutes and can call destructive `DELETE /auth/me` without recent reauthentication. This is a common stateless-JWT tradeoff, but the destructive endpoint raises the impact.

**Fix:** add per-session `sid` revocation or accept all-session `authVersion` bump on logout; require recent reauthentication/step-up for account deletion.

### L-02 — Signup explicitly enumerates registered emails

`POST /auth/signup` returns 201 for new addresses and `409 EMAIL_TAKEN` for existing ones (`routes/auth.ts:659-700`, `services/auth.ts:447-465`). This aids targeted phishing and credential attacks against a health/fitness service.

**Fix:** use a generic idempotent response and notify the address owner out-of-band.

### L-03 — Internal secrets have no minimum strength or online-attempt control

`INTERNAL_SECRET` and `CRON_SECRET` only need to be non-empty. Internal routes have no throttling. A one-character production secret passes fail-fast validation.

**Fix:** require at least 32 random bytes, reject identical secrets, cap `ANALYTICS_BATCH_SIZE`, and add edge/rate protection.

### L-04 — Generic OIDC JWKS cache does not refresh on an unknown `kid`

Apple/Microsoft sign-in can reject valid tokens for up to one hour after provider key rotation. Google already implements a one-time refresh.

**Fix:** refresh once on an unknown key ID with singleflight and cooldown.

### L-05 — Arbitrary Google `kid` values trigger forced JWKS fetches

A fake JWT with an unknown key ID bypasses a valid cache and causes an external fetch. Per-IP auth limits reduce but do not remove distributed amplification.

**Fix:** singleflight refresh, one refresh per cooldown interval, and a short negative-key cache.

### L-06 — Concurrent result writes and undos corrupt undo semantics

`recordResult` reads prior state without a lock, and `undoLast` selects then deletes without `FOR UPDATE` or atomic `DELETE ... RETURNING`. Concurrent writes can snapshot the same old value; concurrent undos can consume/apply the same entry.

**Fix:** lock the parent instance for record/delete/undo and add mutation idempotency keys.

### L-07 — GET/mutation races can repopulate stale program cache entries

A slow GET can read old DB state, a mutation can invalidate Redis, and the GET can then write the stale value back for the five-minute TTL.

**Fix:** versioned/generational cache keys, tombstones, or conditional writes using `updatedAt`.

### L-08 — Expo Web persists mobile refresh tokens in `localStorage`

The Expo Web preview replaces SecureStore with `localStorage`. If that surface is ever deployed outside trusted development, XSS or third-party scripts can steal a seven-day refresh token.

**Fix:** production web builds must use the cookie-based web auth flow or fail if asked to persist a body refresh token.

### L-09 — Missing mobile API configuration falls back to production HTTP localhost

`EXPO_PUBLIC_API_URL` is HTTPS-checked only when present; a missing production value returns `http://localhost:3001`. Platform cleartext policy may turn this into availability failure, but a permissive platform/local listener could receive credentials.

**Fix:** fail production builds when the value is absent; strictly validate an HTTPS origin and disable cleartext transport natively.

### L-10 — Important CI actions and the Gitleaks image use mutable tags

The CI workflow uses major tags for checkout/setup/upload actions and a mutable Gitleaks image tag, while Claude workflows correctly pin SHAs.

**Fix:** pin actions by full commit SHA and containers by digest; automate updates. Remove unused `id-token: write` if the Claude workflow is not using OIDC federation.

### L-11 — DB-backed API security tests are not part of CI

The API's separate `test:e2e` suite is excluded from the normal API test job. Regressions in real Postgres locking, token rotation, and identity constraints can pass CI.

**Fix:** run the DB-backed suite against the existing ephemeral Postgres service for auth/DB changes.

### L-12 — Email/logging paths retain unnecessary PII and development action links

Production warning logs include email recipients, and non-production logs include full verification/reset links. A staging environment not marked exactly `production` can therefore retain usable tokens.

**Fix:** mask recipient addresses, use opaque internal IDs, and gate local action-link output behind an explicit local-only flag.

---

## Product/security decisions requiring owner confirmation

These are real trust-boundary questions, but their severity depends on intended product behavior.

### WebMCP exposure

`apps/frontend/web/src/hooks/use-webmcp.ts` automatically registers tools whenever `navigator.modelContext` exists. Tools expose workout history and allow result writes, undo, and program initialization without calling the available `requestUserInteraction` API. `logResult` also calls `markResult` before validating optional AMRAP input, so a rejected call can partially mutate state.

**Recommendation:** require explicit per-session opt-in, require user interaction for writes and sensitive reads, and validate all input before any mutation. Confirm whether the browser AI agent is intended to be fully trusted; the current code silently makes that architectural decision.

### Analytics identity and freshness

- Analytics uses `slotId` as the persisted `exerciseId`, which can split one exercise across slots or combine unrelated exercises that reuse a slot ID.
- Concurrent analytics runs have no per-user claim/lease; an older snapshot can commit after a newer one.

These primarily affect recommendation correctness and safety rather than cross-tenant security. Persist a versioned exercise identity with results and serialize/lease per-user computation.

---

## Security controls verified

The following controls were traced and found correctly implemented for the reviewed commit:

- JWT verification pins HS256 and validates issuer, audience, subject, active user, and `authVersion`.
- Access tokens are held in memory in the web client; web refresh tokens are HttpOnly, Secure in production, SameSite=Strict, and path-scoped.
- Native mobile refresh tokens use Expo SecureStore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- OAuth/OIDC flows use state; Apple/Microsoft use nonce; GitHub/Microsoft use PKCE.
- Google validates signature, issuer, audience, authorized party, time claims, and verified email.
- Existing-account social linking requires both incoming and existing emails to be verified.
- Passwords use Argon2id; legacy bcrypt verification is isolated; missing users use a dummy hash.
- Reset tokens are random, hashed at rest, single-use, and reset updates password/version plus token deletion transactionally.
- Required API resources consistently filter by `userId`; no cross-account program/result/insight/custom-exercise access was found.
- Drizzle parameterization is used throughout; the sole reviewed `sql.raw` input is an internal numeric constant.
- No request-controlled outbound URL was found; provider endpoints are fixed and Microsoft tenant is path-encoded.
- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or dynamic code execution sink was found in application code.
- JSON-LD escapes `<`; external links use opener protection; avatar uploads are raster data URLs with size and magic-byte validation.
- Authenticated/API responses are marked `no-store`; PWA auth is `NetworkOnly`; only user-independent API routes are cached.
- API body sizes and provider JSON responses are bounded; provider calls use timeouts.
- Backend errors suppress 5xx details; backend Sentry strips request headers, cookies, and body; logger redaction covers credentials.
- Production CORS does not reflect hostile origins.
- Production public-origin construction does not trust request Host headers for OAuth or email links.
- Internal route comparison is constant-time and fails closed when no secret exists.
- Production Swagger/dev auth/metrics are not exposed.
- Production source maps were not publicly retrievable.
- Vercel's `x-vercel-forwarded-for` handling is consistent with the trusted-header assumption; no IP spoof bypass was confirmed.
- Claude GitHub Actions are SHA-pinned and their action-level actor authorization blocks non-write users by default.
- No real secrets were found in the reviewed HEAD/main-reachable history.

---

## Validation performed

### Local remediation validation

- `pnpm run ci` — passed: typechecks, ESLint, Prettier, all workspace tests, production web build, and prerender.
- Web — **120 files / 961 tests passed**.
- Mobile — **19 suites / 201 tests passed**.
- Domain — **6 files / 37 tests passed**.
- Database — **7 files / 95 tests passed, 8 skipped**.
- API client — **4 files / 25 tests passed**.
- `pnpm run test:api` — **54 files passed, 1 skipped; 833 tests passed, 4 skipped**.
- PostgreSQL-backed API E2E — **3 files / 22 tests passed**, including quota boundaries, rollback, concurrency, and auth rotation.
- Dependency-policy parser/enforcement — **11 tests passed**; full `pnpm audit` reported **0 known advisories**.
- `security:headers`, `security:deployment`, and `security:ci-pins` — passed.
- Gitleaks 8.30.0 scanned the complete remediation working tree — **no leaks found**.
- `git diff --check` — passed.

The Happy DOM web suite emits non-fatal aborted YouTube iframe fetch warnings during
teardown. Production-route probes remain baseline evidence until deployment; they are
not presented as post-remediation production verification.

### Non-destructive production probes (2026-08-02)

- `GET https://gravityroom.app/api/health` — 200, deep DB/Redis probe confirmed.
- `GET https://gravityroom.app/api/nope` — 500 `FUNCTION_INVOCATION_FAILED`.
- `GET https://gravityroom.app/app` — 404 with SPA shell.
- `GET https://gravityroom.app/reset-password` — 404 with SPA shell.
- Hostile CORS origin did not receive an allow-origin response.
- Sensitive repository paths, Swagger, metrics, and source maps were not exposed.

### Limitations

- No destructive testing, credential attacks, load testing, or mutation of production data was performed.
- Deployed secret values and entropy were not inspected.
- DB-backed integration tests requiring a dedicated `DATABASE_URL_TEST` were not run by the coordinating review.
- Dependency severity is advisory severity, not proof of remote reachability; applicability is called out above.

---

## Recommended remediation order

1. Fix H-01 token issuance/reset locking and add a DB race regression test.
2. Add per-account quotas and analytics bounds for H-02.
3. Fix login CSRF, mobile fail-open isolation, and recovery-token URL sanitization.
4. Fix production unknown-API 500s and SPA deep-link status codes.
5. Harden Microsoft unverified-email handling and refresh-token family tracking.
6. Add account-aware abuse controls and make reset token lookup precede Argon2.
7. Repair CI security signal: dependency gate, DB-backed tests, Gitleaks scope, immutable action pins.
8. Reorder/gate production migrations and align privacy disclosures with telemetry processors.
