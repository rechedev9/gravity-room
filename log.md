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
