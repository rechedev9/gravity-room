---
summary: 'Open bugs and security findings from the April 2026 security review'
read_when:
  - Triaging what to fix next
  - Starting work on auth, analytics, or rate limiting
  - Reviewing security posture before a release
---

# Open Issues

Security and bug findings from the April 2026 security review. Check off each item when resolved.

## High

- [ ] **Soft-deleted users can still refresh sessions**  
  The refresh flow validates against `refresh_tokens` but never checks `users.deleted_at`. A deleted user whose refresh token hasn't expired can obtain new access tokens indefinitely.  
  Files: `apps/api/src/routes/auth.ts`, `apps/api/src/services/auth.ts`

- [ ] **"Delete after 30 days" purge is never scheduled**  
  `purge-deleted-users.ts` exists and is correct, but nothing triggers it — no cron job, no workflow step. Soft-deleted users accumulate forever.  
  Files: `apps/api/src/scripts/purge-deleted-users.ts`, `.github/workflows/maintenance.yml`

- [ ] **Analytics broken against current DB schema**  
  `queries.py` still references columns removed in an earlier migration (`program_instances.results`, `result_timestamps`), and its upsert targets a constraint named `user_insights_unique` that doesn't exist (the actual constraint has a different name in `0033_add_user_insights.sql`). Analytics computation will fail at runtime.  
  Files: `apps/analytics/queries.py`, `apps/api/src/db/schema.ts`, `apps/api/drizzle/0033_add_user_insights.sql`

## Medium

- [ ] **Analytics `/compute` endpoint is unauthenticated**  
  Any caller who can reach the analytics service can trigger a full recompute. Should require a shared secret or be network-isolated.  
  File: `apps/analytics/main.py`

- [ ] **Analytics user scan is a full-table scan**  
  `SELECT DISTINCT user_id … FROM program_instances WHERE status IN (…)` has no covering index on `(status, user_id)`, so it scans the entire table on every compute run.  
  File: `apps/analytics/queries.py`

- [ ] **Rate limits trust raw `X-Forwarded-For`**  
  Public routes read the client IP directly from the `X-Forwarded-For` header, which is trivially spoofable. Safer IP-extraction logic already exists in `apps/api/src/middleware/request-logger.ts` but isn't reused by the rate limiters.  
  Files: `apps/api/src/routes/exercises.ts`, `apps/api/src/routes/catalog.ts`

## Lower

- [ ] **Exercise text search degrades at scale**  
  The `%term%` ILIKE pattern forces a sequential scan even though `pg_trgm` is available. At large exercise counts this will be slow. Consider a GIN trigram index or switching to full-text search.  
  File: `apps/api/src/services/exercises.ts`

## No action needed

- **SQL injection** — all queries are parameterized via Drizzle ORM; ILIKE input is escaped before interpolation. No findings. ✓
