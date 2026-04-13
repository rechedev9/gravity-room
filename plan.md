# Plan: Migración de Go API a ElysiaJS

**Branch:** `feat/elysia-migration`
**Fecha:** 2026-04-13
**Estado:** Pendiente

---

## Contexto

El backend actual (`apps/go-api/`) usa Go + chi + pgx + goose. Anteriormente existió un backend ElysiaJS (`apps/api/`) que fue eliminado en el commit `8f3f03b`. La versión ElysiaJS en su estado final (commit `29655e9`) ya cubría el 100% de la funcionalidad actual: todos los endpoints, Redis (cache + singleflight + presence + rate limiting), Sentry, Telegram, Prometheus, Google JWKS, Drizzle ORM, seeds, y tests unitarios.

**Estrategia:** Restaurar el código ElysiaJS del historial git como base, actualizar lo que el Go API añadió después (migraciones 0032-0034, insights endpoint, OpenAPI spec manual), y reemplazar `apps/go-api/` completamente.

---

## Fase 0 — Preparación (sin cambios funcionales)

### 0.1 Restaurar `apps/api/` desde el historial git

- [x] `git checkout 29655e9 -- apps/api/` para recuperar todo el directorio
- [x] Verificar que los archivos se restauran correctamente
- [x] `bun install` para resolver dependencias del workspace

### 0.2 Inventario de deltas Go vs ElysiaJS

El Go API añadió funcionalidad post-migración que el ElysiaJS no tiene:

- [x] Migración `00032_add_check_constraints.sql` — CHECK constraints en `amrap_reps` (0-99) y `rpe` (1-10)
- [x] Migración `00033_widen_exercises_id.sql` — `exercises.id` de varchar(50) a varchar(100)
- [x] Migración `00034_user_insights.sql` — tabla `user_insights`
- [x] Endpoint `GET /api/insights` — lee insights pre-computados por el servicio Python
- [x] OpenAPI spec manual (`internal/swagger/openapi.json`) — ElysiaJS ya tiene `@elysiajs/swagger` auto-generado
- [x] Endpoint `GET /api/stats/online` — **ya existe** en el ElysiaJS (commit `29655e9`)
- [x] Program templates nuevos en JSON — Go usa JSON files, ElysiaJS usaba TypeScript definitions

---

## Fase 1 — Tracer Bullet (health + auth end-to-end)

### 1.1 Actualizar dependencias

- [x] Actualizar `apps/api/package.json`: bump elysia, drizzle-orm, ioredis, pino, etc. a últimas versiones
- [x] `bun install` y verificar que compila sin errores

### 1.2 Reconciliar schema de Drizzle con la DB actual

- [x] Ejecutar `drizzle-kit introspect` contra la DB de producción/dev para obtener el schema real
- [x] Comparar con `apps/api/src/db/schema.ts` del historial
- [x] Añadir columnas/tablas faltantes al schema Drizzle:
  - `user_insights` table
  - CHECK constraints en `workout_results` y `undo_entries`
  - `exercises.id` como varchar(100)
  - Cualquier otro delta
- [x] **NO generar nuevas migraciones Drizzle** — la DB ya tiene el schema correcto vía goose. Drizzle solo necesita reflejar el estado actual para queries

### 1.3 Añadir migraciones Drizzle faltantes

- [x] Crear migration `0032_widen_exercises_id.sql` (idempotente)
- [x] Crear migration `0033_add_user_insights.sql` (idempotente)
- [x] CHECK constraints ya cubiertos por Drizzle migration `0031_add_check_constraints.sql`
- [x] `bootstrap.ts` ya maneja coexistencia con goose (hotfixes idempotentes + Drizzle migrator)

### 1.4 Verificar tracer bullet

- [x] Levantar Postgres + Redis con `docker-compose.dev.yml` (solo infra, sin API)
- [x] Ejecutar `bun run --filter api dev` localmente
- [x] Verificar `GET /health` responde correctamente
- [x] Verificar `POST /api/auth/dev` funciona (login de desarrollo)
- [x] Verificar `GET /api/auth/me` retorna el usuario

---

## Fase 2 — Completar endpoints faltantes

### 2.1 Añadir endpoint de Insights

- [x] Crear `apps/api/src/routes/insights.ts`
- [x] Crear `apps/api/src/services/insights.ts` — query simple a `user_insights`
- [x] Registrar ruta en `create-app.ts` bajo `/api`
- [x] Tests unitarios

### 2.2 Sincronizar program templates

- [x] Comparar templates del Go API (`apps/go-api/internal/seed/data/programs/*.json`) con los TypeScript del ElysiaJS
- [x] Los JSON del Go API son la fuente de verdad (pueden tener patches post-migración)
- [x] Los 20 slugs coinciden perfectamente. TS modules se mantienen (formato original, misma data)

### 2.3 Verificar todos los endpoints

- [x] Auth: google login, refresh, signout, me, update profile, delete account
- [x] Programs: create, list, get, update, update metadata, delete, export, import
- [x] Results: record, delete, undo
- [x] Catalog: list, get definition, preview
- [x] Exercises: list, create, muscle groups
- [x] Definitions: create, list, get, update, delete, status, fork
- [x] Stats: online count
- [x] Insights: list

---

## Fase 3 — Compatibilidad de contrato API

### 3.1 Verificar formato de respuestas

- [ ] Timestamps: el Go API usa `FormatTime()` → `"2006-01-02T15:04:05.000Z"` (3 fractional digits, UTC). Verificar que ElysiaJS produce el mismo formato
- [ ] Error responses: `{ error: string, code: string }` — ya compatible
- [ ] Nullable fields: `name`, `avatarUrl` en UserResponse — verificar null vs undefined
- [ ] Cursor pagination format: `<isoTimestamp>_<uuid>` — verificar compatibilidad exacta

### 3.2 Verificar contra Zod schemas del frontend

- [ ] El frontend valida todas las respuestas con Zod (`apps/web/src/lib/shared/schemas/`)
- [ ] Ejecutar tests del frontend que hacen parsing de respuestas API
- [ ] Si hay drift, ajustar las respuestas del ElysiaJS para pasar los schemas

### 3.3 Rate limiting parity

- [ ] Verificar que todas las rate limits del Go API están reflejadas en ElysiaJS
- [ ] Tabla de referencia en `apps/go-api/internal/handler/ratelimits.go`

---

## Fase 4 — Tests

### 4.1 Restaurar y actualizar tests existentes

- [ ] Los 31 test files del ElysiaJS histórico ya están restaurados en Fase 0
- [ ] Verificar que compilan y pasan con las dependencias actualizadas
- [ ] Actualizar mocks/fixtures si el schema cambió

### 4.2 Tests de regresión para funcionalidad nueva

- [ ] Test para insights endpoint
- [ ] Test para CHECK constraints (amrap_reps, rpe boundaries)
- [ ] Test para varchar(100) exercise IDs

### 4.3 Verificar parity con Go tests

- [ ] Revisar test coverage del Go API (`apps/go-api/internal/handler/*_test.go`, `internal/service/*_test.go`)
- [ ] Asegurar que los edge cases cubiertos por Go tests están cubiertos en ElysiaJS

---

## Fase 5 — Infraestructura y deployment

### 5.1 Nuevo `Dockerfile.api`

- [ ] Reemplazar el Dockerfile multi-stage Go con uno basado en Bun:

  ```dockerfile
  FROM oven/bun:latest AS web-build
  # ... build web ...

  FROM oven/bun:latest
  # ... copy api + web dist ...
  CMD ["bun", "src/index.ts"]
  ```

- [ ] Imagen final mucho más simple (no necesita alpine + go build)

### 5.2 Actualizar `docker-compose.dev.yml`

- [ ] Cambiar servicio `api` para usar el nuevo Dockerfile
- [ ] Actualizar healthcheck (ya no necesita `wget`, puede usar Bun/curl)
- [ ] Verificar que levanta correctamente con `docker compose -f docker-compose.dev.yml up --build`

### 5.3 Actualizar `docker-compose.yml` (producción)

- [ ] Mismo cambio que dev
- [ ] Verificar que el build de producción funciona

### 5.4 Actualizar CI/CD

- [ ] `.github/workflows/ci.yml` — eliminar dependency en `_go-integration.yml`
- [ ] `.github/workflows/go-ci.yml` — eliminar o archivar
- [ ] `.github/workflows/_go-integration.yml` — eliminar o archivar
- [ ] Añadir step de test para `apps/api/` en CI pipeline

### 5.5 Actualizar `lefthook.yml`

- [ ] Eliminar hooks `go-vet`, `go-lint`, `go-build`, `go-test`
- [ ] Añadir hooks equivalentes para `apps/api/`:
  - `api-typecheck`: `bun run --filter api typecheck`
  - `api-test`: `bun run --filter api test`

### 5.6 Actualizar root `package.json`

- [ ] Añadir scripts para el API:
  - `dev:api`: `bun run --filter api dev`
  - `test:api`: `bun run --filter api test`
  - `typecheck:api`: `bun run --filter api typecheck`
- [ ] Actualizar `ci` script para incluir API typecheck + test

---

## Fase 6 — Limpieza

### 6.1 Eliminar `apps/go-api/`

- [ ] `trash apps/go-api/` (recuperable)
- [ ] Verificar que nada más referencia `go-api`:
  - `docker-compose*.yml`
  - `.github/workflows/`
  - `lefthook.yml`
  - `CLAUDE.md`
  - `README.md`

### 6.2 Actualizar documentación

- [ ] `CLAUDE.md` — actualizar sección Architecture para reflejar ElysiaJS en vez de Go
- [ ] `CLAUDE.md` — actualizar Build/Test commands (eliminar Go commands)
- [ ] `CLAUDE.md` — actualizar Infrastructure section
- [ ] `README.md` — si existe, actualizar stack description

### 6.3 Actualizar OpenAPI spec generación

- [ ] ElysiaJS con `@elysiajs/swagger` auto-genera la spec
- [ ] Verificar que `apps/web/` script `api:types` (openapi-zod-client) sigue funcionando con la spec auto-generada
- [ ] Si no, ajustar o mantener spec manual como fallback

---

## Fase 7 — Verificación final

### 7.1 Gate completo

- [ ] `bun run ci` pasa (typecheck + lint + format + test + build)
- [ ] `cd apps/api && bun test` — todos los tests pasan
- [ ] `docker compose -f docker-compose.dev.yml up --build` — stack completo levanta
- [ ] Health checks pasan para API, Web, y Analytics

### 7.2 Smoke test manual

- [ ] Login con Google OAuth (o dev login)
- [ ] Crear programa desde catálogo
- [ ] Registrar resultado
- [ ] Undo resultado
- [ ] Ver estadísticas/insights
- [ ] Crear programa custom
- [ ] Exportar/importar programa

### 7.3 E2E tests

- [ ] `bun run e2e` pasa sin regresiones

---

## Orden de ejecución

```
Fase 0 → Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 6 → Fase 7
  ↑         ↑         ↑
  |         |         └── Puede empezar en paralelo con Fase 3
  |         └── Verificación parcial antes de continuar
  └── Commit checkpoint
```

Cada fase termina con un commit checkpoint. Si algo falla en verificación, se arregla antes de avanzar.

---

## Riesgos

| Riesgo                                              | Impacto                                     | Mitigación                                                      |
| --------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| Drizzle migrations chocan con goose state           | DB corrupta                                 | No generar nuevas Drizzle migrations; introspect + schema-only  |
| Formato de timestamps difiere                       | Frontend Zod parsing falla                  | Test explícito de formato antes de avanzar                      |
| ElysiaJS deps desactualizadas tras meses sin uso    | Build failures                              | Bump todo a latest en Fase 1                                    |
| Seeds TypeScript vs JSON divergen                   | Templates incorrectos en catálogo           | JSON del Go API es source of truth; migrar seeds a JSON         |
| Rate limit Lua script Redis incompatible            | Rate limiting no funciona                   | Ya existía en ElysiaJS; verificar que el script Lua es idéntico |
| `@elysiajs/swagger` auto-gen spec difiere de manual | openapi-zod-client genera tipos incorrectos | Comparar specs y ajustar                                        |

---

## Archivos clave por fase

| Fase | Archivos principales                                                                           |
| ---- | ---------------------------------------------------------------------------------------------- |
| 0    | `apps/api/*` (restaurar)                                                                       |
| 1    | `apps/api/package.json`, `apps/api/src/db/schema.ts`, `apps/api/src/bootstrap.ts`              |
| 2    | `apps/api/src/routes/insights.ts`, `apps/api/src/services/insights.ts`, seeds                  |
| 3    | `apps/api/src/routes/*.ts` (verificar respuestas), `apps/web/src/lib/shared/schemas/`          |
| 4    | `apps/api/src/**/*.test.ts`                                                                    |
| 5    | `Dockerfile.api`, `docker-compose*.yml`, `.github/workflows/*`, `lefthook.yml`, `package.json` |
| 6    | `apps/go-api/` (eliminar), `CLAUDE.md`, `README.md`                                            |
| 7    | Verificación end-to-end                                                                        |
