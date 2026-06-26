# Gravity Room

Tracker de fuerza basado en progresión lineal GZCLP. Monorepo pnpm que se
despliega como **un único proyecto same-origin en Vercel**: la SPA Vite/React se
publica como output estático y la API ElysiaJS corre como función serverless.
Dos frontends (web, mobile) y paquetes TS compartidos completan el repo.

Este README está ordenado de abajo hacia arriba: primero la infra que sostiene
todo, después el backend que define el contrato, y por último los frontends que
lo consumen. La idea es que se entienda **dónde** vive cada cosa antes de
saber **cómo** se programa.

## Contenidos

1. [Despliegue en Vercel](#1-despliegue-en-vercel) — Cómo corre en producción
2. [Backend](#2-backend) — API, analytics y persistencia
3. [Frontend](#3-frontend) — Web SPA y app móvil
4. [Paquetes compartidos](#4-paquetes-compartidos) — `@gzclp/*`
5. [Desarrollo local](#5-desarrollo-local) — Setup y comandos
6. [Documentación adicional](#6-documentación-adicional)

---

## 1. Despliegue en Vercel

Toda la producción vive en **un único proyecto same-origin de Vercel**. La SPA
estática y la API comparten origen, así que el navegador llama a `/api` relativo
sin CORS. La decisión es deliberada: eliminar el reverse proxy, los contenedores
y el servidor que se interponían entre el usuario y el código.

### Topología

```
Internet
   │
   ▼
┌──────────────────────── Proyecto Vercel (same-origin) ─────────────────────────┐
│                                                                                │
│   https://<dominio>/            → SPA estática (apps/frontend/web/dist)          │
│   https://<dominio>/api/*       → función serverless api/[...path].ts           │
│                                     └─► createApp() (ElysiaJS) vía app.fetch     │
│                                                                                │
│   Vercel Cron ─► /api/internal/cleanup-tokens   (cada 6 h)                      │
│               ─► /api/internal/purge-users       (diario)                       │
│               ─► /api/internal/analytics/compute (horario)                      │
└────────────────────────────────────────────────────────────────────────────────┘
        │                                   │
        ▼                                   ▼
   Neon Postgres                       Upstash Redis (REST)
   (pooled + direct)                   (presencia, caché, rate limit)
```

### Configuración del proyecto

Todo vive en [`vercel.json`](vercel.json) (revisable en git, no en el dashboard):
`framework: null`, `installCommand: pnpm install --frozen-lockfile`, `buildCommand: bash
scripts/vercel-build.sh`, `outputDirectory: apps/frontend/web/dist`, la función
`api/[...path].ts` (`maxDuration: 60`), el rewrite de SPA (todo salvo `/api/*` →
`/index.html`) y las tres crons.

**Por qué same-origin y no SPA + API separadas:** al compartir origen no hace
falta CORS ni un dominio `api.` aparte, las cookies de refresh son first-party
sin configuración, y la API es HTTP-only
([`apps/backend/api/src/create-app.ts`](apps/backend/api/src/create-app.ts)) —
nunca sirve HTML; de eso se encarga el output estático de Vite.

### Pipeline de despliegue

No hay workflow de GitHub: la integración Git de Vercel despliega en cada push a
`main`. El build corre [`scripts/vercel-build.sh`](scripts/vercel-build.sh):

1. **Migraciones (solo producción).** Si `VERCEL_ENV=production`, corre
   `pnpm --filter api db:deploy` (migraciones Drizzle + seeds idempotentes)
   contra `DIRECT_DATABASE_URL`. Se omite en preview/local (apuntan a una rama
   Neon desechable).
2. **Sitemap.** Regenera `sitemap.xml` (datos puros, sin navegador).
3. **Build del SPA** con `VITE_API_URL=""` (same-origin) por la ruta
   `build:no-prerender`: el sandbox de build de Vercel no trae Chromium para el
   prerender de Playwright.

### Datos y estado

- **Neon Postgres:** `DATABASE_URL` es el endpoint _pooled_ (PgBouncer, host con
  `-pooler`) que usa la función en cada request con pool `max=1`;
  `DIRECT_DATABASE_URL` es el endpoint directo que usa solo `db:deploy` para el
  DDL.
- **Upstash Redis (REST):** rate limit, presencia y caché vía el cliente sin
  conexión `@upstash/redis`. Obligatorio en producción; en local, si no está,
  todo cae a stores en memoria con fallback gracioso.
- **Observabilidad:** `@sentry/node` (errores + trazas) y logs JSON `pino` a los
  log drains de Vercel. No hay endpoint de scrape (`/metrics` fue eliminado).

El procedimiento completo de go-live (Neon, Upstash, variables, dominios) está en
[`docs/VERCEL_CUTOVER.md`](docs/VERCEL_CUTOVER.md).

---

## 2. Backend

Una sola API y unos pipelines de analytics en proceso. El analytics dejó de ser
un servicio aparte: comparte runtime con la API y se dispara por Vercel Cron.

### API — `apps/backend/api`

**Stack:** ElysiaJS 1.4 (serverless vía `app.fetch`) + Drizzle ORM + Neon
Postgres + Upstash Redis + Zod 4.

Es el corazón del producto. Sirve toda la superficie REST que consumen los
dos frontends. Decisiones clave:

- **Serverless con la factory pura `createApp()`.** En Vercel, la función
  catch-all [`api/[...path].ts`](api/[...path].ts) monta la app y la maneja con
  `app.fetch(request)`; no hay `app.listen`. En local,
  [`src/dev-server.ts`](apps/backend/api/src/dev-server.ts) sirve la misma app
  con `@hono/node-server`, así que dev y prod son byte-for-byte la misma app.
- **Migraciones build-time, no boot-time.** Las migraciones Drizzle y los seeds
  corren en el paso de deploy
  ([`src/scripts/migrate-deploy.ts`](apps/backend/api/src/scripts/migrate-deploy.ts),
  vía `pnpm --filter api db:deploy`) contra el endpoint directo de Neon, fuera
  del camino del request. Cero DDL al arrancar.
- **Contrato OpenAPI generado por Elysia.** Expuesto en `/swagger/json` solo
  fuera de producción. Es la fuente de verdad para el cliente generado en web.
- **Auth con JWT access + refresh rotation.** Multi-método (Google, Apple,
  GitHub, Microsoft, email/contraseña), validado server-side en
  [`lib/google-auth.ts`](apps/backend/api/src/lib/google-auth.ts) y compañía.
- **Observabilidad:** logs JSON estructurados (`pino`) a los log drains de
  Vercel y `@sentry/node` opcional. Sin endpoint de scrape (`/metrics` eliminado).

**Superficie HTTP** (ver `CLAUDE.md` para la lista completa generada
automáticamente):

- `Auth` — sign-in multi-método (web/mobile), refresh, perfil, baja
- `Catalog` — definiciones de programa (templates y custom)
- `Programs` — instancias de programa del usuario (CRUD + import/export)
- `Results` — registrar y deshacer resultados de entrenamiento
- `Exercises` / `Muscle groups` — catálogo y ejercicios custom
- `Insights` — lectura de insights pre-computados por los pipelines de analytics
- `Stats` — usuarios online en tiempo real (Upstash presence)
- `Internal` — crons (`cleanup-tokens`, `purge-users`, `analytics/compute`)
- `System` — `/health`

### Analytics — `apps/backend/api/src/analytics`

Los pipelines de insights (e1RM, frecuencia, summary, volumen, forecast,
plateau, recommendation) se portaron de Python a **TypeScript en proceso**. Una
regresión logística IRLS en JS, un helper de stats y uno de ISO-week reemplazan
el stack numpy/scipy/scikit-learn.

- **Vercel Cron** llama a `POST /api/internal/analytics/compute`, que procesa un
  batch acotado de usuarios (los menos recientemente computados) por tick con
  upserts idempotentes en `user_insights`.
- **El guard interno falla cerrado:** acepta el `CRON_SECRET` que Vercel inyecta
  o un `INTERNAL_SECRET` Bearer manual; sin ninguno, todo `/api/internal/*` da 401.
- **Paridad con el viejo Python** congelada por golden-file tests
  ([`src/analytics/pipelines/pipelines.parity.test.ts`](apps/backend/api/src/analytics/pipelines/pipelines.parity.test.ts)).

### Persistencia

- **Postgres (Neon)** — 10 tablas, esquema en
  [`packages/database/src/schema.ts`](packages/database/src/schema.ts).
  Migraciones generadas en `packages/database/migrations/` y aplicadas por
  `db:deploy` en el build.
- **Upstash Redis (REST)** — rate limiting distribuido, conteo de usuarios online
  (presence), caché de respuestas hot y singleflight para evitar dogpile en
  endpoints caros. Si `UPSTASH_REDIS_REST_URL`/`_TOKEN` no están seteados, todo
  cae a stores en memoria con fallback gracioso (útil en dev y CI).

### Por qué analytics en proceso y no un servicio aparte

- Serverless no tiene un proceso de larga vida donde correr un scheduler propio;
  Vercel Cron ya da el disparo periódico que antes hacía APScheduler.
- El cómputo por usuario es acotado y barato una vez portado a TS, así que cabe
  dentro del presupuesto de una función sin bloquear requests.
- Un solo runtime (TypeScript + `@gzclp/domain`) elimina el drift entre el modelo
  de dominio del API y el del cómputo, y borra el coste operativo de mantener un
  segundo servicio Python.

---

## 3. Frontend

Dos clientes que consumen el mismo API: una SPA web instalable como PWA y una
app móvil Expo. Comparten lógica de dominio vía `@gzclp/domain` pero **no**
comparten código de UI — las plataformas tienen affordances distintas y
forzar componentes universales termina mal en ambas.

### Web — `apps/frontend/web`

**Stack:** React 19 + Vite 7 + TanStack Router + TanStack Query 5 + Tailwind 4

- Zod 4 + react-hook-form + i18next.

* **Routing file-based con TanStack Router.** Type-safety end-to-end entre
  rutas, params y loaders. Cero strings sueltos para navegación.
* **TanStack Query** para todo el estado server-side. Refetch automático,
  invalidation por mutation, optimistic updates donde tiene sentido.
* **Tailwind 4** con CSS-in-CSS (no JIT runtime). Build más rápido y menos
  cosas que romper.
* **PWA instalable** con service worker. Funciona offline para las pantallas
  de tracking más usadas.
* **Cliente generado desde OpenAPI** — [`codegen/generate-api-types.ts`](apps/frontend/web/codegen/generate-api-types.ts)
  toma `/swagger/json` del API y genera `src/lib/api/generated.ts`. El workflow
  `validate` de CI bloquea drift entre el swagger real y el cliente generado.
* **Tests E2E con Playwright** (chromium) en `e2e/`.

Estructura interna:

```
src/
├── features/    ← Pantallas y UI propia de cada feature (route-owned)
├── components/  ← Primitivos compartidos y app shell
├── contexts/    ← Auth, guest mode, toast, estado del tracker
├── hooks/
├── lib/         ← Cliente API, i18n, Sentry, utils
└── styles/
```

La regla: si una pieza de UI la usa una sola feature, vive en `features/`.
Solo lo que se reutiliza de verdad sube a `components/`. Esto evita el típico
basurero de "UI library casero" sin uso real.

### Mobile — `apps/frontend/mobile`

**Stack:** Expo 54 + React Native 0.81 + expo-sqlite + expo-auth-session

- TanStack Query.

* **expo-sqlite** para persistencia local. La app funciona offline-first y
  sincroniza con el API cuando hay red.
* **expo-auth-session** para Google OAuth (flujo nativo, no popup).
* **No consume el cliente generado del API.** Las llamadas se escriben a mano
  por ahora. Unificar esto vía un futuro `packages/api-client` está en la
  hoja de ruta — el costo de cambiar al cliente generado hoy no compensa
  porque mobile y web tienen ciclos de release distintos.

### Por qué SPA estática separada del API

- **Cache agresivo gratis.** El SPA es un bundle inmutable: Vercel sirve
  `/assets/*` con `max-age=31536000, immutable` desde su CDN.
- **El API no carga assets, no compila Vite, no sirve HTML.** Un cold start de
  la función no afecta al output estático ya servido.
- **Mismo origen, sin CORS.** Al compartir dominio el SPA llama a `/api`
  relativo y las cookies de refresh son first-party sin configuración.

---

## 4. Paquetes compartidos

### `packages/domain` — `@gzclp/domain`

Pure TypeScript + Zod 4. **Sin runtime, sin dependencias de framework.** Lo
importan web, mobile y api vía `"@gzclp/domain": "workspace:*"`.

Contiene:

- **Motor de progresión GZCLP** — reglas autoritativas para subir/bajar peso,
  detección de fail, transición entre etapas. Una sola implementación, sin
  riesgo de drift entre cliente y servidor.
- **Schemas Zod** — DTOs, validaciones de input/output, contratos de eventos.
- **Catálogo** — ejercicios base, grupos musculares, mapeos.

Por qué un paquete y no copy/paste: lo más caro en un tracker de progresión
no es la UI, es que el cliente calcule un próximo peso distinto al que el
servidor acepta. Single source of truth — fin.

### `packages/database` — `@gzclp/database`

Esquema Drizzle, migraciones SQL generadas y seeds de datos de referencia. El
API es dueño de las conexiones en runtime pero importa esquema/seeds/migraciones
desde aquí, así que la estructura de Postgres no vive escondida dentro del API.

### `packages/api-client` — `@gzclp/api-client`

Wrapper de fetch tipado (merge-headers, api-error, single-flight, helpers de
URL) compartido por los clientes.

---

## 5. Desarrollo local

### Pre-requisitos

- **Node 24** + **pnpm 11** — runtime para API (vía `tsx`), tooling de frontends, y tests (vitest)
- **PostgreSQL** local o managed (Neon en producción)
- **Upstash Redis** opcional — seteá `UPSTASH_REDIS_REST_URL`/`_TOKEN` para
  habilitar rate limit y presence; sin ellos, caen a memoria

### Setup

```bash
# Instalar dependencias del monorepo entero
pnpm install

# Copiar .env.example y completar DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID*, etc.
cp .env.example .env

# Aplicar migraciones + seeds (paso de deploy build-time; idempotente)
pnpm --filter api db:deploy

# Levantar el API local (src/dev-server.ts; prod usa api/[...path].ts)
pnpm run dev:api

# En otra terminal, levantar el SPA web
pnpm run dev:web
```

Defaults: web en `http://localhost:5173`, API en `http://localhost:3001`.

Para la app mobile, configurá `EXPO_PUBLIC_API_URL` apuntando al API y los
IDs de Google OAuth que necesita Expo:

- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

El API necesita `GOOGLE_CLIENT_IDS` con todos esos IDs (mobile + web) para
aceptar tokens de `/api/auth/mobile/google`.

### Comandos

| Tarea                          | Comando                                           |
| ------------------------------ | ------------------------------------------------- |
| Dev (web)                      | `pnpm run dev:web`                                |
| Dev (API)                      | `pnpm run dev:api`                                |
| Migraciones + seeds            | `pnpm --filter api db:deploy`                     |
| Build (web)                    | `pnpm run build:web`                              |
| Type check (todo el workspace) | `pnpm run typecheck`                              |
| Type check (API)               | `pnpm run typecheck:api`                          |
| Type check (domain)            | `pnpm run typecheck:domain`                       |
| Lint (TS)                      | `pnpm run lint`                                   |
| Format check                   | `pnpm run format:check`                           |
| Tests workspace (unit)         | `pnpm run test`                                   |
| Tests API (unit + paridad)     | `pnpm run test:api`                               |
| E2E (Playwright)               | `pnpm run e2e`                                    |
| E2E con UI                     | `pnpm run e2e:headed`                             |
| Load test (k6)                 | `k6 run scripts/loadtest.js`                      |
| Load test (smoke)              | `k6 run scripts/loadtest.js --env SCENARIO=smoke` |

### Hooks de git

[Lefthook](lefthook.yml) corre en paralelo:

- **pre-commit:** typecheck + lint + format
- **pre-push:** tests + build

El chequeo de drift entre el swagger real del API y el cliente generado vive en
CI (`ci.yml`, job `OpenAPI client drift`), porque necesita arrancar el API
contra Postgres.

No saltees los hooks con `--no-verify`. Si fallan es porque hay algo que
arreglar antes de subir.

---

## 6. Documentación adicional

| Archivo                                            | Propósito                                                   |
| -------------------------------------------------- | ----------------------------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                           | Contexto autogenerado para agentes (API + DB en vivo)       |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)     | Split por tiers, stack detallado de cada servicio           |
| [`docs/VERCEL_CUTOVER.md`](docs/VERCEL_CUTOVER.md) | Runbook de go-live en Vercel (Neon, Upstash, variables)     |
| [`docs/llm-map.md`](docs/llm-map.md)               | Tabla path → propósito para navegación rápida               |
| [`.env.example`](.env.example)                     | Referencia completa de variables de entorno                 |
| [`vercel.json`](vercel.json)                       | Config del proyecto Vercel (build, función, rewrites, cron) |
