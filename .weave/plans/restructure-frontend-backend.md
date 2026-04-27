---
name: restructure-frontend-backend
mode: mixed
tdd_override: false
test_runner: bun run typecheck && bun test (per-app via --filter)
test_scope_seconds: 60
---

# Reestructura: separar frontend y backend a nivel de carpetas

## Contexto

El monorepo tiene hoy `apps/{api,web,mobile,analytics}` en un único nivel.
La separación frontend/backend no es visible desde la raíz: hay que abrir
cada `package.json` para deducir el rol de cada app. El usuario pidió
hacer esa separación explícita y, de paso, cerrar deuda detectada en la
exploración:

- `Dockerfile.api` hornea el SPA dentro de la imagen API y `apps/api/src/create-app.ts`
  expone `staticPlugin` + handlers `/` y `/*` para servirlo. En producción
  Caddy nunca enruta esos paths al API (`Caddyfile.production:11-13` los manda
  a nginx). El SPA se construye dos veces y el camino API→SPA está muerto.
- `Dockerfile.api:21` referencia `apps/web/src/lib/shared`, carpeta que no
  existe en disco — error latente si se reconstruye.
- `apps/web/scripts/` (codegen TS) choca conceptualmente con `scripts/` (ops
  bash) de la raíz.
- `roadmap.md` y `log.md` viven en la raíz; `README.md` referencia un
  `docs/` que no existe.

## Decisiones

1. Topología nueva:
   ```
   apps/
     backend/
       api/
       analytics/
     frontend/
       web/
       mobile/
   packages/
     domain/
   docs/
     ARCHITECTURE.md   (nuevo)
     llm-map.md        (nuevo)
     roadmap.md        (movido)
     log.md            (movido)
   ```
2. API sólo backend. Quitar fase web-build de `Dockerfile.api`, quitar
   `staticPlugin` y handlers `/`, `/.well-known/security.txt`, `/*` en
   `apps/api/src/create-app.ts`, y la dependencia `@elysiajs/static`.
3. `Dockerfile.api` (raíz) → `apps/backend/api/Dockerfile`.
4. `apps/web/scripts/` → `apps/web/codegen/` (después: `apps/frontend/web/codegen/`).
5. `roadmap.md` y `log.md` → `docs/`. Crear `docs/ARCHITECTURE.md` y
   `docs/llm-map.md`.
6. Actualizar workspaces glob a `apps/**` (Bun lo soporta). Mantener
   `packages/*` igual.
7. Branch dedicado `refactor/restructure-fe-be`. Un PR independiente.

## Política TDD

`tdd: false` para casi todo (movimientos, configs, docs). Único punto con
lógica: borrar el `staticPlugin`/handlers en `create-app.ts`. Hay tests en
`apps/api/src/create-app.test.ts` que cubren rutas; hay que verificar que
no testean específicamente `/` ni `/*` de SPA. Si lo hacen, el commit los
ajusta junto al código (sigue siendo un cambio cohesivo, una sola unidad).

## Pasos (commits atómicos)

### Step 1 — Crear plan y rama
- tdd: false
- reason: docs + branch
- notes: Este archivo + `git checkout -b refactor/restructure-fe-be`.

### Step 2 — Workspaces glob → `apps/**`
- tdd: false
- reason: config (no logic)
- notes: Editar root `package.json` y `bun install` para regenerar `bun.lock`.
  Verificar `bun run typecheck` (todas las apps) sigue verde sin mover nada.

### Step 3 — API: eliminar camino SPA muerto
- tdd: false (verificación con tests existentes)
- reason: dead code removal — el path nunca se ejerce en prod, Caddy enruta
  todo lo no-API a nginx.
- seam: `apps/api/src/create-app.ts:177-189` (staticPlugin + 3 handlers) y
  imports en líneas 4 y 6.
- notes: Quitar también `@elysiajs/static` de `apps/api/package.json`.
  Comprobar `bun run --filter api test` y `--filter api typecheck` verdes.
  Si algún test cubría `/` o `/*` SPA, ajustarlo en el mismo commit.

### Step 4 — Mover `apps/api` → `apps/backend/api`
- tdd: false
- reason: file move
- notes: `git mv apps/api apps/backend/api`. Editar:
  - `apps/backend/api/tsconfig.json`: `extends: "../../tsconfig.base.json"`
    → `"../../../tsconfig.base.json"`.
  - `Dockerfile.api`: `COPY apps/api/...` → `COPY apps/backend/api/...`,
    `WORKDIR /app/apps/api` → `/app/apps/backend/api`. (Se moverá el
    Dockerfile en Step 9.)
  - `lefthook.yml:11`: `root: apps/api` → `root: apps/backend/api`.
  - `.prettierignore:13`: `apps/api/drizzle` → `apps/backend/api/drizzle`.
  - `scripts/rollback.sh:24,132`: `apps/api/drizzle` → `apps/backend/api/drizzle`.
  - `apps/web/playwright.config.ts:28`: `cd apps/api` → `cd apps/backend/api`.
  - `.github/workflows/validate.yml:40`: `apps/api/**` → `apps/backend/api/**`.
  - `bun install` para re-resolver workspace.
  - Verificar `bun run --filter api typecheck` y `test`.

### Step 5 — Mover `apps/analytics` → `apps/backend/analytics`
- tdd: false
- reason: file move
- notes: `git mv apps/analytics apps/backend/analytics`. Editar:
  - `docker-compose.yml:48`: `context: apps/analytics` → `apps/backend/analytics`.
  - `docker-compose.dev.yml:91`: idem.
  - `.github/workflows/validate.yml:49`: `apps/analytics/**` → `apps/backend/analytics/**`.
  - `.github/workflows/_validate-analytics.yml:11,19`: `working-directory` y
    `cache-dependency-path`.
  - `.github/workflows/auto-format.yml:46`: `cd apps/analytics`.
  - Verificar `pytest` (si está disponible localmente; si no, confiar en CI).

### Step 6 — Mover `apps/web` → `apps/frontend/web`
- tdd: false
- reason: file move
- notes: `git mv apps/web apps/frontend/web`. Editar:
  - `apps/frontend/web/tsconfig.json`: `extends "../../tsconfig.base.json"` →
    `"../../../tsconfig.base.json"`.
  - `apps/frontend/web/playwright.config.ts:31`: `resolve(__dirname, '../..')`
    → `resolve(__dirname, '../../..')`. La línea 28 ya quedó correcta tras
    Step 4.
  - `apps/frontend/web/Dockerfile`: rutas `apps/web/...` → `apps/frontend/web/...`.
  - `docker-compose.yml:34`: `dockerfile: apps/web/Dockerfile` →
    `apps/frontend/web/Dockerfile`.
  - `docker-compose.dev.yml:114,126`: idem + ruta del nginx.dev.conf mount.
  - `lefthook.yml:21`: `root: apps/web` → `root: apps/frontend/web`.
  - `.github/workflows/validate.yml:32`: `apps/web/**` → `apps/frontend/web/**`.
  - `bun install`. Verificar `bun run --filter web typecheck` y `test`.

### Step 7 — Mover `apps/mobile` → `apps/frontend/mobile`
- tdd: false
- reason: file move
- notes: `git mv apps/mobile apps/frontend/mobile`. No hay refs por path en
  CI ni Docker; sólo `.env.example:58` (comentario). `bun install`.
  Verificar `bun run --filter mobile typecheck`.

### Step 8 — Renombrar `apps/frontend/web/scripts` → `codegen`
- tdd: false
- reason: rename
- notes: `git mv apps/frontend/web/scripts apps/frontend/web/codegen`.
  Editar:
  - `apps/frontend/web/package.json:14`: `"api:types": "bun run scripts/..."`
    → `"bun run codegen/generate-api-types.ts"`.
  - `apps/frontend/web/codegen/generate-api-types.ts:50`: comentario
    `Regenerate: bun run api:types (from apps/web/)` →
    `(from apps/frontend/web/)`.
  - Verificar `bun run --filter web api:types` regenera idéntico
    `src/lib/api/generated.ts`.

### Step 9 — Mover `Dockerfile.api` → `apps/backend/api/Dockerfile`
- tdd: false
- reason: docker reorg + dead-code cleanup
- notes: `git mv Dockerfile.api apps/backend/api/Dockerfile`. Reescribir
  contenido para eliminar fase `web-build` (líneas 1-13 del original) y
  `COPY apps/web/...` (líneas 4, 18, 21, 22). Mantener sólo: imagen base
  Bun, instalar deps con `apps/backend/api/package.json`, `COPY apps/backend/api`,
  EXPOSE 3001, CMD. Editar:
  - `docker-compose.yml:5`: `dockerfile: Dockerfile.api` →
    `apps/backend/api/Dockerfile`. Quitar `args:` (líneas 6-9) — ya no hay
    fase web-build que las consuma.
  - `docker-compose.dev.yml:49,50`: idem (también el comentario).
  - `.github/workflows/validate.yml:42`: `- 'Dockerfile.api'` →
    `- 'apps/backend/api/Dockerfile'`.

### Step 10 — Mover `roadmap.md` y `log.md` a `docs/`
- tdd: false
- reason: docs reorg
- notes: `git mv roadmap.md docs/roadmap.md`, `git mv log.md docs/log.md`.
  Editar:
  - `.gitignore:71`: `roadmap.md` → `docs/roadmap.md` (mantener ignored).
    Revisar el bloque `docs/*` (líneas 63-64): hoy ignora todo `docs/`
    excepto `docs/issues.md`. Hay que añadir excepciones para `ARCHITECTURE.md`
    y `llm-map.md` (si queremos commitearlos), o reescribir el bloque para
    que `docs/` se trackee normalmente y dejar `docs/roadmap.md` y
    `docs/log.md` ignorados explícitamente. Decisión: trackear todo `docs/`
    salvo `roadmap.md` y `log.md` (estos contienen estado vivo que no
    queremos commitear).

### Step 11 — Crear `docs/ARCHITECTURE.md` y `docs/llm-map.md`
- tdd: false
- reason: new docs
- notes: ARCHITECTURE describe la nueva topología, stack por app y
  contratos transversales (`@gzclp/domain`, OpenAPI-codegen, Docker).
  llm-map.md es una tabla `path → propósito` de una página.

### Step 12 — Actualizar `README.md` raíz
- tdd: false
- reason: docs
- notes: Reescribir tree (líneas ~50-54), referencias a `Dockerfile.api`
  como "multi-stage web SPA + Bun API" (ya no aplica), comandos de dev
  (`cd apps/api` → `cd apps/backend/api`, etc.), eliminar referencias
  muertas (`docs/pickup.md`, `docs/handoff.md`, `scripts/docs-list.ts`).

### Step 13 — Soft refs (comentarios, .env, llms-full, SKILL)
- tdd: false
- reason: comments
- notes: `.env.example:53,58`, `apps/frontend/web/public/llms-full.txt:92,103,112`,
  `apps/backend/api/bunfig.toml:4`, `apps/backend/api/src/db/seeds/seeds.test.ts:7`,
  `apps/backend/api/src/scripts/purge-deleted-users.ts:7`,
  `packages/domain/src/catalog.ts:6`, `scripts/committer:6,7,25,26`,
  `.agents/skills/gravity-room/SKILL.md` (varias líneas).

### Step 14 — Verificación final
- tdd: false (verificación)
- reason: validation
- notes:
  - `bun install` (idempotente).
  - `bun run typecheck` (raíz, todos los workspaces TS).
  - `bun run lint` (web).
  - `bun test` (web + api + domain).
  - `bun run --filter web build`.
  - `docker compose -f docker-compose.dev.yml config` (parsea).
  - `docker compose config` (idem prod).
  - `git status` limpio salvo cambios commiteados.

## Riesgos y mitigaciones

- **Bun lockfile**: cada movimiento de app puede regenerar parte de
  `bun.lock`. Asumir y commitear con cada step.
- **Workflows CI**: el branch nuevo activará workflows con paths-filter
  desactualizados sólo en commits intermedios. Aceptable porque el PR final
  es atómico desde el punto de vista del usuario; cada commit individual
  deja la build local verde.
- **Docker context paths**: probar `docker compose config` después de
  cada cambio de compose.
- **`.weave/plans/*.md` históricos**: contienen rutas viejas. No se editan
  (son archivo de decisiones pasadas); el README puede mencionarlo.
- **Cambios sin commitear pre-existentes** (`.weave/plans/pre-merge-validation-and-squash-merge.md`
  modificado y dos planes nuevos sin trackear): no se incluyen en esta
  reestructura. Quedan en working tree.
