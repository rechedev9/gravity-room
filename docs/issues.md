---
summary: 'Open bugs and security findings from the April 2026 security review'
read_when:
  - Triaging what to fix next
  - Starting work on auth, analytics, or rate limiting
  - Reviewing security posture before a release
---

# Open Issues

All findings from the April 2026 security review have been resolved. See PR #39.

## High

- [x] **Soft-deleted users can still refresh sessions** — added `findUserById` check in refresh handler; returns `AUTH_ACCOUNT_DELETED` if user is gone
  - Fixed in: `apps/api/src/routes/auth.ts` (commit e97a56f)

- [x] **"Delete after 30 days" purge is never scheduled** — added purge step to `.github/workflows/maintenance.yml` via SSH into VPS
  - Fixed in: `.github/workflows/maintenance.yml` (commit 2ae8596)

- [x] **Analytics broken against current DB schema** — rewrote `fetch_workout_records` to JOIN `workout_results` (normalized table); fixed `ON CONFLICT` to use column list instead of missing named constraint
  - Fixed in: `apps/analytics/queries.py` (commit c472227)

## Medium

- [x] **Analytics `/compute` endpoint is unauthenticated** — requires `X-Internal-Secret` header; secret read from `settings.internal_secret` (pydantic-settings); `INTERNAL_SECRET` env var added to `docker-compose.yml`
  - Fixed in: `apps/analytics/main.py`, `apps/analytics/config.py`, `docker-compose.yml` (commit 3d10b03)

- [x] **Analytics user scan is a full-table scan** — added partial index `program_instances_active_user_idx` on `(user_id)` WHERE `status IN ('active', 'completed')`
  - Fixed in: `apps/api/drizzle/0036_perf_indexes.sql` (commit 7fea1c7)

- [x] **Rate limits trust raw `X-Forwarded-For`** — removed manual header extraction; routes now use `ip` injected by `requestLogger` middleware (which applies a trusted-proxy check)
  - Fixed in: `apps/api/src/routes/exercises.ts`, `apps/api/src/routes/catalog.ts` (commit 9148bd3)

## Lower

- [x] **Exercise text search degrades at scale** — `pg_trgm` GIN index (`exercises_name_trgm_idx`) already exists from migration 0015; trigram index covers ILIKE patterns, no change needed

- [x] **No SQL injection found** — all queries parameterized; ILIKE input escaped ✓
