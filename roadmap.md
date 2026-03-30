# Gravity Room — Roadmap

> Last updated: 2026-03-30.

## Status: Post-Migration Hardening

Go API migration complete (all 5 phases). Current focus: test coverage,
security audit, CI/CD optimization, and DX improvements.

---

## Phase 6 — Test Coverage (In Progress)

Handler coverage improved from 12% → 43.5%. Service at 7%.

- [x] **Handler validation tests** — auth, programs, results validation paths (46 tests total)
- [x] **Handler integration tests** — ProgramHandler full flows via function-field mocking (27 tests)
- [ ] **Service integration tests** — `service/programs.go` (896 LOC) main flows
- [x] **Add `coverage` target to Makefile** — `go test -coverprofile` + `go tool cover -html`

## Phase 7 — Security Audit (Pending)

Rate limiting only enforced on `auth.google`. Other sensitive endpoints unprotected.

- [ ] **Audit rate limit coverage** — profile updates, program creation, custom definition uploads
- [ ] **Apply rate limiting** to all write endpoints identified in audit

## Phase 8 — CI/CD Optimization (Pending)

- [ ] **Docker build layer caching** — enable BuildKit cache export/import in `ci.yml`
- [ ] **Fix CI health check addresses** — replace hardcoded `127.0.0.1:3002` with container DNS names
- [ ] **Bun dependency caching** — cache `node_modules` or Bun global cache in web build job

## Phase 9 — Observability (Pending)

- [ ] **Frontend error capture via Sentry** — replace `console.error` calls in `auth-context.tsx`, `profile-page.tsx`, `use-program.ts`, `setup-form.tsx` with Sentry reporting

## Phase 10 — DX (Pending)

- [ ] **`docker-compose.dev.yml`** — local dev setup without external networks (`infra_proxy`, `data_backend`)

---

## Completed

### Dead Code Cleanup ✓

Removed leftover artifacts from the old TypeScript API after Phase 5.

- [x] **Trash `scripts/export-definitions.ts`** — dead one-time utility with 19 broken imports to removed `apps/api/`
- [x] **Fix `.env` stale comments** — header `apps/api` → `Required`, CORS port `3000` → `5173`, `Pino` → `slog`

### Go API Migration (Phases 1–5) ✓

All 30 HTTP endpoints ported with full parity. Observability (Sentry, Redis),
CI/CD hardening, cutover preparation, and legacy cleanup done. The Go API is
the sole API. See [git history](https://github.com/rechedev9/gravity-room) for
full migration details.

---

## Decided / Won't Do

| Item                   | Decision  | Reason                                                                                            |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| GraphQL                | Won't do  | REST is sufficient for this app's complexity                                                      |
| WebSocket              | Won't do  | Polling for online stats is acceptable                                                            |
| ORM (GORM/ent)         | Won't do  | Raw SQL via pgx is intentional — matches TS approach                                              |
| Shared package for Go  | Won't do  | Go types are self-contained; no cross-language sharing needed                                     |
| React `act()` warnings | Won't fix | bun:test + happy-dom limitation — `act()` env detection broken; warnings are cosmetic, tests pass |

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
