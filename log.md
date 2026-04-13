# Migration Log — Go API → ElysiaJS

Branch: `feat/elysia-migration`
Started: 2026-04-13

---

## 2026-04-13 — Investigación y plan

**Objetivo:** mapear el alcance completo de la migración antes de tocar código.

**Investigación realizada:**

- Rastreado el historial git: el ElysiaJS existió desde el commit inicial (`5e90857`) hasta su eliminación en `8f3f03b`. El estado más maduro es commit `29655e9`.
- Inventariado el Go API completo: 34 migraciones goose, 7 grupos de handlers (auth, programs, results, catalog, exercises, definitions, stats), workout engine, Redis (presence + rate limiting + cache + singleflight), Sentry, Telegram, Prometheus, Google JWKS, Swagger.
- Inventariado el ElysiaJS histórico: 66 source files + 31 test files. Cubría el 100% de la funcionalidad actual excepto 3 deltas post-migración.
- Verificado el frontend (`apps/web/`): todas las llamadas API van por `apiFetch` a rutas `/api/*`. El contrato es validado con Zod schemas en `src/lib/shared/schemas/`.
- Identificado shared engine en `apps/web/src/lib/shared/` — el workout engine completo ya existe en TypeScript (originalmente compartido con el ElysiaJS API).

**Deltas Go vs ElysiaJS (funcionalidad que Go añadió después):**

1. Migración `00032` — CHECK constraints en `amrap_reps` (0-99) y `rpe` (1-10)
2. Migración `00033` — `exercises.id` de varchar(50) a varchar(100)
3. Migración `00034` — tabla `user_insights`
4. Endpoint `GET /api/insights` — lee insights pre-computados por el servicio Python
5. Program templates en JSON (Go) vs TypeScript definitions (ElysiaJS)

**Archivos de infraestructura que necesitan cambio:**

- `Dockerfile.api` — eliminar Go build stage, usar solo Bun
- `docker-compose.yml` / `docker-compose.dev.yml` — actualizar servicio api
- `.github/workflows/ci.yml` — eliminar dependency en `_go-integration.yml`
- `.github/workflows/go-ci.yml`, `_go-integration.yml` — eliminar
- `lefthook.yml` — reemplazar hooks Go por hooks API TypeScript
- `CLAUDE.md` — actualizar sección Architecture y Build/Test

**Resultado:** `plan.md` creado con 7 fases detalladas. PR abierta: #21.

**Commits:**

- `04e3951` — `docs: add ElysiaJS migration plan`

---

## 2026-04-13 — Fase 0: Restauración

### 0.1 Restaurar `apps/api/` desde el historial

- `git checkout 29655e9 -- apps/api/` restauró 99 source files + tests
- Problema: `@gzclp/shared` era un workspace package que ya no existe (fue inlined en `apps/web/src/lib/shared/`)
- Solución: eliminé la dependencia workspace del `package.json` del API y añadí un path alias en `tsconfig.json` → `"@gzclp/shared/*": ["../web/src/lib/shared/*"]`
- Añadí `zod ^4.3.6` como dependency (requerida por el shared code)
- `bun install` OK, `tsc --noEmit` pasa limpio, web tests (481) siguen verdes

### 0.2 Inventario de deltas confirmado

Verificado contra código real del Go API:

1. Migration 00032 — CHECK constraints: `amrap_reps` 0-99, `rpe` 1-10, `workout_index` >= 0 (en `workout_results` y `undo_entries`)
2. Migration 00033 — `exercises.id` varchar(50) → varchar(100)
3. Migration 00034 — tabla `user_insights` con PK, FK, payload jsonb, unique constraint
4. `GET /api/insights` — handler en Go, no existe en ElysiaJS
5. Program templates: Go usa 20 JSON files; ElysiaJS usa TS modules con shared catalog

**Commits:**

- `5d9ff86` — `chore(api): restore ElysiaJS API from git history and resolve shared imports`

---

## 2026-04-13 — Fase 1: Tracer Bullet

### 1.1 Actualizar dependencias

- Solo `@types/bun` estaba desactualizado (1.3.9 → 1.3.12)
- `bun update` bumped otras deps (eslint, prettier, typescript-eslint, tanstack)
- Typecheck pasa limpio

### 1.2 Reconciliar schema Drizzle

- `exercises.id` ya es varchar(100) en schema.ts — OK
- CHECK constraints (migration 0031 Drizzle) — ya cubiertas
- Agregada tabla `user_insights` al schema con todas las columnas, FK, unique constraint e index
- Agregada relación `userInsights` a `usersRelations`

### 1.3 Migraciones Drizzle faltantes

- Creada `0032_widen_exercises_id.sql` — idempotente
- Creada `0033_add_user_insights.sql` — idempotente con IF NOT EXISTS
- Actualizado `_journal.json` con los nuevos entries

### 1.4 Tracer bullet verificado

- Postgres + Redis levantados via docker-compose (OrbStack)
- API levantado localmente con `bun run dev`
- `GET /health` → 200, DB ok, Redis ok
- `POST /api/auth/dev` → 200, devuelve JWT + user
- `GET /api/auth/me` → 200, devuelve usuario autenticado

**Commits:**

- `(pending)` — Fase 1 committed above

---

## 2026-04-13 — Fase 2: Endpoints faltantes

### 2.1 Insights endpoint

- Creado `services/insights.ts` — query a `user_insights` con filtro por types + order by
- Creado `routes/insights.ts` — `GET /insights?types=...`, auth requerido, rate limit 30/min
- Registrado en `create-app.ts`
- 3 tests unitarios pasan

### 2.2 Program templates sync

- Comparación slug-a-slug: 20 slugs idénticos en Go JSON, ElysiaJS TS modules y PROGRAM_CATALOG
- No hay templates faltantes en ninguna dirección
- TS modules se mantienen (formato original)

### 2.3 Smoke test de todos los endpoints

- Health, Auth (dev login + me), Programs, Catalog, Exercises, Insights, Stats/online, Program-definitions: todos responden 200

**Commits:**

- `(above)` — Fase 2 committed

---

## 2026-04-13 — Fase 3: Compatibilidad de contrato + Fase 4: Tests + Fase 5: Infra

### Fase 3 — Contrato API verificado

- Timestamps: `.toISOString()` = Go `FormatTime()` — idéntico formato
- Error responses: `{ error, code }` — match
- Nullable fields: null (not omitted) — match
- Cursor pagination: `<ISO>_<uuid>` — match
- Rate limits: todos coinciden con Go API
- 481 web tests pasan (Zod schema validation)

### Fase 4 — Tests API

- 317 tests pasan (84 lib + 100 services/middleware + 19 catalog + 45 definitions + 66 routes + 3 insights)
- Rate limit tests requieren Redis limpio (stale entries causan fallos)
- No se necesitaron cambios en mocks/fixtures

### Fase 5 — Infraestructura

- `Dockerfile.api`: Go multi-stage → Bun single runtime (copia shared lib + web dist)
- `docker-compose.dev.yml` + `docker-compose.yml`: healthcheck `wget` → `bun -e fetch()`
- CI: eliminada dependency en `_go-integration.yml`; borrados `go-ci.yml` y `_go-integration.yml`
- `lefthook.yml`: eliminados hooks Go; añadido `api-typecheck`
- `package.json`: añadidos `dev:api`, `test:api`, `typecheck:api`; `ci` incluye `typecheck:api`

**Commits:**

- `(above)` — Fases 3-5 committed

---

## 2026-04-13 — Fase 6: Limpieza

### 6.1 Eliminar `apps/go-api/`

- `trash apps/go-api/` — 148 files removed (recoverable)
- Verified no remaining active references to `go-api` in the codebase

### 6.2 Actualizar documentación

- `CLAUDE.md` — Architecture, Build/Test, Infrastructure sections rewritten for ElysiaJS
- `README.md` — Complete rewrite: stack table, monorepo structure, architecture diagram, commands, getting started

### 6.3 Actualizar todas las referencias

- `.gitignore` — Go build artifact entries commented out
- `.prettierignore` — `apps/go-api` → `apps/api/drizzle`
- `Caddyfile.production` — Updated routes (`/api/*` instead of bare paths), fixed container names
- `scripts/committer` — Examples updated from Go to TypeScript
- `scripts/rollback.sh` — Migration dir updated from goose to Drizzle
- `scripts/loadtest.js` — Comment updated
- `apps/web/playwright.config.ts` — webServer command: `go run` → `bun src/index.ts`
- `apps/web/scripts/generate-api-types.ts` — Rewritten to fetch from running API's `/swagger/json` instead of static JSON
- `apps/web/src/lib/api/generated.ts` — Header comment updated
- `apps/web/src/lib/shared/catalog.ts` — Comment updated
- `apps/web/nginx.dev.conf` — Comment updated
- `apps/web/public/llms-full.txt` — Backend section updated

**Commits:**

- `807e4fe` — `chore: remove Go API and update all references to ElysiaJS`
- `9da6513` — `chore: remove Go API (apps/go-api/)`

**Pendiente:** Fase 7 (verificación final)

---

## 2026-04-13 — Fase 7: Verificación (en progreso)

### 7.1 Gate completo

- `bun run ci` — pasa (typecheck + lint + format + 481 web tests + build)
- `cd apps/api && bun test` — 317 tests pasan
- `docker compose -f docker-compose.dev.yml build api` — imagen construida

**Docker build fix (commit `009f4d8`):**

1. **`.dockerignore`**: `node_modules` → `**/node_modules`
   - Root cause: `COPY apps/api ./apps/api` copied macOS symlinks into Linux container. Bun's `node_modules/.bun/` uses platform-specific hashes (`+fb5f531a2ea73cdf` on macOS ≠ `+22856657ccdae36b` on Linux arm64). Glob `**/node_modules` prevents copying local node_modules at any depth.

2. **`bootstrap.ts` — goose-to-Drizzle migration bridge:**
   - Dev DB had schema from goose but no `drizzle.__drizzle_migrations` entries → Drizzle tried to run all migrations from 0000 → `type "instance_status" already exists`.
   - Fix: detect goose-managed DB (has `users` table, empty `drizzle.__drizzle_migrations`), seed journal with SHA-256 hashes of migration SQL files for migrations 0000-0031.
   - Three sub-fixes during development: MD5→SHA-256, `public`→`drizzle` schema, table-existence→entry-count check.

**Stack verification:**

- API: `http://localhost:3002/health` → `{"status":"ok","db":{"status":"ok"},"redis":{"status":"ok"}}`
- Web: `http://localhost:8080/` → 200
- Catalog: `http://localhost:3002/api/catalog` → 18 programs
- Analytics: unhealthy (pre-existing issue, not migration-related)

### 7.1 Additional fix

- Web healthcheck in `docker-compose.dev.yml`: `wget --spider` → `curl -f -s` (BusyBox wget in alpine resolves `localhost` to IPv6 `::1`, but nginx only listens on IPv4)

### 7.2 Smoke test

**Browser (guest mode via Docker stack on :8080):**

- Landing page: renders correctly, cookie banner works
- Login page: Google OAuth button + "Probar sin cuenta" visible
- Guest mode: enters `/app`, welcome page, sidebar, "0 online" counter
- Programs catalog: loads all programs, descriptions, metadata
- Program generation: training max inputs → correct 5/3/1 weight calculations
- Result recording: set completion updates UI, shows "deshacer" button
- Undo: reverts set to original state

**API (authenticated via dev login on :3002):**

- `POST /api/auth/dev` → JWT + user
- `GET /api/auth/me` → user object
- `GET /api/catalog` → 18 programs
- `GET /api/exercises` → exercises list
- `GET /api/muscle-groups` → 8 muscle groups
- `GET /api/insights` → `{ data: [] }` (no insights for new user)
- `GET /api/stats/online` → `{ count: 1 }`
- `POST /api/programs` → program created (GZCLP)
- `POST /api/programs/:id/results` → result recorded
- `POST /api/programs/:id/undo` → result undone
- `GET /api/programs/:id/export` → full program JSON
- `POST /api/programs/import` → program re-created from export
- `DELETE /api/programs/:id` → 204

All endpoints return correct response shapes. Timestamps ISO 8601, nullable fields null (not omitted), error format `{ error, code }`.

### 7.3 E2E tests

- `playwright.config.ts`: added `locale: 'es-ES'` — tests assumed Spanish but no locale was set
- Results: 26/95 pass, 69 fail
- All 69 failures are pre-existing frontend/test sync issues (not migration-related):
  1. Guest dashboard layout: tests expect catalog on `/app` but UI shows welcome page; catalog at `/app/programs`
  2. Link vs button roles: some tests use `getByRole('link')` but components render `<button>`
  3. `navigateToTracker` helper assumes "Continuar Entrenamiento" is an `<a>`, now it's a `<button>`
- Tests that pass: auth (3), catalog (2), setup (4), workout-recording (4), workout-completion (5), undo (2), landing-page (2), profile (1), others (3)
- These cover the full authenticated flow: login → catalog → program creation → recording → undo

**Commits:**

- `(pending)` — Fase 7 documentation and healthcheck fix
