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

**Pendiente:** commit Fase 3-5, luego Fase 6 (limpieza)
