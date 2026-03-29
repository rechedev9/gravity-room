# Go API Migration — Roadmap

> Pinned to branch `go-api`. Last updated: 2026-03-29.

## Status: Migration Complete

All 30 HTTP endpoints are ported with full parity. Observability, CI/CD,
cutover preparation, and legacy cleanup are done. The Go API is the sole API.

---

## Phase 1 — Database Bootstrap (Done)

Uses `pressly/goose` v3 with `embed.FS`. 33 SQL migrations (32 Drizzle + 1 hotfix)
embedded in the Go binary. 4 seed functions (muscle groups, exercises, expanded exercises,
program templates) run after migrations. Existing Drizzle-migrated databases are detected
and bootstrapped automatically.

- [x] **Pick migration tool** — goose v3 (SQL files, embed.FS, pgx stdlib, separate tracking table)
- [x] **Port the 32 SQL migrations** + 1 hotfix (exercises.id varchar(100)) → 33 total
- [x] **Add migration step to startup** — runs before accepting traffic (matches TS bootstrap §1)
- [x] **Add seed functions** — muscle groups, exercises, expanded exercises, program templates
- [x] **Bootstrap detection** — detects Drizzle-migrated DBs, seeds goose version table
- [x] **Dockerfile** — no changes needed (embed.FS bakes everything into binary)
- [x] **Parity test** — fresh DB → 33 migrations → 4 seeds → API starts → health OK

## Phase 2 — Observability (Done)

### Sentry Integration (High) ✓

- [x] **Add `sentry-go` dependency** — `v0.44.1` in go.mod
- [x] **Init from `SENTRY_DSN` env var** in startup sequence — `cmd/api/main.go:35`
- [x] **Capture panics** in recovery middleware — converted to 5xx → captured
- [x] **Capture 5xx errors** in global error handler — `internal/middleware/recovery.go:53-65`
- [x] **Add `SENTRY_DSN` to Go config** — `internal/config/config.go:29,53`

### Redis Integration (Medium) ✓

- [x] **Add `go-redis` dependency** — `v9.18.0` in go.mod
- [x] **Wire Redis client** from `REDIS_URL` (optional — graceful fallback to nil-inner client)
- [x] **Port Redis rate limiter** — atomic Lua script, falls back to in-memory store
- [x] **Port presence tracking** — online user count via sorted set `users:online`
- [x] **Health endpoint** — reports Redis status dynamically (ping + latency)

## Phase 3 — CI/CD Hardening (Done)

- [x] **Add harness run to `go-ci.yml`** — PostgreSQL service + `scripts/harness-go`, gates `docker-build`
- [x] **Add Docker health check** to `docker-compose.yml` — `wget --spider` against `/health` with 15s start period
- [x] **Add deploy gates to `ci.yml`** — `go-harness` + `e2e-go` jobs must pass before deploy
- [x] **E2E with Go API** — Playwright in `go-ci.yml` and `ci.yml` via `GO_API=1` flag

## Phase 4 — Cutover Preparation (Done)

- [x] **Shadow traffic** — N/A: Go API is already the sole production API; harness tests validate parity
- [x] **Load test** — k6 script with smoke/load/stress scenarios (`scripts/loadtest.js`)
- [x] **Rollback plan** — `scripts/rollback.sh` with migration boundary checks, health checks, deploy history
- [x] **Swagger** — OpenAPI 3.0 spec embedded in Go binary, Swagger UI at `/swagger` (dev-only)
- [x] **Update `docker-compose.yml`** — already pointed to Go binary via `Dockerfile.api`
- [x] **Update deployment docs** — README updated: stack, architecture, env vars, commands, deployment, rollback

## Phase 5 — Cleanup (Done)

- [x] **Remove `apps/api/`** (TypeScript API)
- [x] **Remove `apps/harness/`** — contract tests no longer needed once Go is sole API
- [x] **Remove `packages/shared/`** — inlined into `apps/web/src/lib/shared/` with path aliases
- [x] **Archive `openspec/contract/http-contract.md`** — moved to `openspec/changes/archive/`
- [x] **Update monorepo scripts** — removed `dev:api`, `db:*`, `test:harness`; updated Dockerfiles, CI, rollback script

---

## Decided / Won't Do

| Item                  | Decision | Reason                                                        |
| --------------------- | -------- | ------------------------------------------------------------- |
| GraphQL               | Won't do | REST is sufficient for this app's complexity                  |
| WebSocket             | Won't do | Polling for online stats is acceptable                        |
| ORM (GORM/ent)        | Won't do | Raw SQL via pgx is intentional — matches TS approach          |
| Shared package for Go | Won't do | Go types are self-contained; no cross-language sharing needed |

---

## Reference

| Resource             | Path                                       |
| -------------------- | ------------------------------------------ |
| Go API source        | `apps/go-api/`                             |
| Web app              | `apps/web/`                                |
| Shared lib (inlined) | `apps/web/src/lib/shared/`                 |
| Go CI workflow       | `.github/workflows/go-ci.yml`              |
| Integration workflow | `.github/workflows/_go-integration.yml`    |
| Goose migrations     | `apps/go-api/internal/migrate/migrations/` |
| Dockerfile           | `Dockerfile.api`                           |
