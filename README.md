# Gravity Room

Tracker de fuerza basado en progresión lineal GZCLP. Monorepo Bun con cuatro
servicios desplegables (API, analytics, web, mobile) y un paquete TS compartido.

Este README está ordenado de abajo hacia arriba: primero la infra que sostiene
todo, después el backend que define el contrato, y por último los frontends que
lo consumen. La idea es que se entienda **dónde** vive cada cosa antes de
saber **cómo** se programa.

## Contenidos

1. [Despliegue en VPS](#1-despliegue-en-vps) — Cómo corre en producción
2. [Backend](#2-backend) — API, analytics y persistencia
3. [Frontend](#3-frontend) — Web SPA y app móvil
4. [Paquete compartido](#4-paquete-compartido) — `@gzclp/domain`
5. [Desarrollo local](#5-desarrollo-local) — Setup y comandos
6. [Documentación adicional](#6-documentación-adicional)

---

## 1. Despliegue en VPS

Toda la producción vive en **un solo VPS Hetzner**. Sin Cloudflare, sin
managed databases, sin Railway. La decisión es deliberada: optimizar coste
operativo y eliminar dependencias de proveedores que se interpongan en el
camino entre el usuario y el código.

### Topología

```
Internet
   │
   ▼
┌──────────────────────────── gr-prod (Hetzner CCX13, fsn1) ────────────────────────────┐
│  Ubuntu LTS · IPv4 <redacted> · ufw 22/80/443 · fail2ban                              │
│                                                                                       │
│   ┌──────────── docker compose stack — /opt/gravity-room/ ────────────┐               │
│   │                                                                   │               │
│   │   caddy:443  ──► (TLS Let's Encrypt, security headers, gzip/zstd) │               │
│   │      │                                                            │               │
│   │      ├─► gravityroom.app     → file_server /srv/web (SPA estática)│               │
│   │      ├─► www.gravityroom.app → 301 → gravityroom.app              │               │
│   │      └─► api.gravityroom.app → reverse_proxy api:3001             │               │
│   │                                                                   │               │
│   │   api (Bun/ElysiaJS)      :3001 ──► postgres, redis, analytics    │               │
│   │   analytics (FastAPI)     :8000 ──► postgres                      │               │
│   │   postgres:18-alpine            ──► /mnt/pg-vol (Volumen 10 GB)   │               │
│   │   redis:7-alpine                ──► tmpfs (LRU, 256 MB max)       │               │
│   │                                                                   │               │
│   └───────────────────────────────────────────────────────────────────┘               │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

### Servicios del compose

Definidos en [`infra/production/docker-compose.yml`](infra/production/docker-compose.yml). Cinco servicios
sobre una sola red bridge (`gr-net`):

| Servicio    | Imagen                                     | Rol                                                                    |
| ----------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `caddy`     | `caddy:2-alpine`                           | Reverse proxy + servidor estático del SPA + TLS automático             |
| `api`       | `ghcr.io/rechedev9/gravity-room-api`       | API ElysiaJS sobre Bun. Healthcheck en `/health`.                      |
| `analytics` | `ghcr.io/rechedev9/gravity-room-analytics` | FastAPI: cómputo de insights e ML. Healthcheck en `/health`.           |
| `postgres`  | `postgres:18-alpine`                       | Datos persistentes en `/mnt/pg-vol` (volumen Hetzner separado del SO). |
| `redis`     | `redis:7-alpine`                           | Rate limit, presencia, caché. `tmpfs` + LRU — no persiste a disco.     |

**Por qué Caddy y no nginx:** TLS automático con Let's Encrypt sin tocar
configuración, sintaxis declarativa más legible que nginx, y una sola fuente
para reverse proxy + servir SPA. El [`infra/production/Caddyfile`](infra/production/Caddyfile) describe las
tres vhosts (apex, www, api) y un snippet de `security_headers` compartido
(HSTS, CSP, Referrer-Policy, COOP).

**Por qué el SPA lo sirve Caddy y no el API:** el API es HTTP-only
([`apps/backend/api/src/create-app.ts`](apps/backend/api/src/create-app.ts))
y nunca devuelve assets estáticos. Esto permite cachear el SPA agresivamente
(`/assets/*` con `max-age=31536000, immutable`) sin pasar por Bun, y deja
al API libre de servir HTML — separación de responsabilidades real.

### Pipeline de despliegue

Definido en [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
Dispara en push a `main`:

1. **Build de imágenes Docker** (api + analytics) en paralelo → push a GHCR.
   Cacheado vía GHA cache (`scope` por servicio).
2. **Build del SPA** con Vite. Variables baked-in: `VITE_API_URL`,
   `VITE_GOOGLE_CLIENT_ID`. Prerender con Playwright Chromium para evitar
   soft-404 en rutas estáticas.
3. **Sync al VPS** vía rsync sobre SSH: `infra/production/docker-compose.yml`, `infra/production/Caddyfile` y
   el `dist/` del SPA a `/opt/gravity-room/data/web-dist/`.
4. **Validación de `.env`** — corre `bun run scripts/check-env.ts` contra el
   `.env` real del VPS _antes_ de levantar el stack. Esto evita el caso de
   variable nueva requerida en producción → restart loop.
5. **Deploy real**: `docker compose pull && up -d --remove-orphans`.
6. **Healthcheck** contra `api:3001/health` con reintentos. Si falla, vuelca
   logs de `api` y `postgres` y aborta.

`concurrency.group: deploy-prod` evita deploys concurrentes pisándose entre sí.

### Datos y backups

- **Postgres:** los datos viven en `/mnt/pg-vol`, un Volumen Hetzner de 10 GB
  independiente del disco del servidor. Si la VM se destruye y se recrea, el
  volumen se reattachea y los datos siguen ahí.
- **Backups:** cron diario en el VPS (`/etc/cron.d/gravity-room-backup`)
  ejecuta `pg_dump` en formato custom a `/opt/gravity-room/backups/`, con
  retención de 7 días. Logs vía `journalctl -t gr-backup`.
- **Redis:** intencionalmente efímero (`tmpfs` + `--save ''` + `--appendonly no`).
  Rate limit y presencia se reconstruyen solos; el caché tampoco necesita
  durabilidad.

### Coste

Aproximadamente **€13,50/mes**: CCX13 (€12,49) + IPv4 (€0,50) + Volumen 10 GB
(€0,40) + snapshots (~€0,12). El techo autoimpuesto es €15/mes — toda
decisión de infra futura se mide contra ese límite.

---

## 2. Backend

Dos servicios backend con responsabilidades disjuntas. Comparten Postgres
pero no se acoplan vía código — el contrato es la base de datos y un endpoint
HTTP interno.

### API — `apps/backend/api`

**Stack:** Bun + ElysiaJS 1.4 + Drizzle ORM + Postgres + Redis + Zod 4.

Es el corazón del producto. Sirve toda la superficie REST que consumen los
dos frontends. Decisiones clave:

- **Bun como runtime.** Startup ~10× más rápido que Node, y permite ejecutar
  TypeScript sin pasos de build en desarrollo. La imagen Docker es multi-stage
  ([`apps/backend/api/Dockerfile`](apps/backend/api/Dockerfile)) y copia
  `node_modules` raíz **y** de cada workspace, porque Bun 1.3 usa linker
  isolated con symlinks a `node_modules/.bun/`.
- **Drizzle + migraciones automáticas al arrancar.** El `bootstrap.ts` corre
  las migraciones pendientes antes de aceptar tráfico. Cero pasos manuales en
  cada deploy.
- **Contrato OpenAPI generado por Elysia.** Expuesto en `/swagger/json` solo
  fuera de producción. Es la fuente de verdad para el cliente generado en web.
- **Auth con JWT access + refresh rotation.** Google OAuth tanto en web como
  en mobile, validado server-side en [`lib/google-auth.ts`](apps/backend/api/src/lib/google-auth.ts).
- **Observabilidad:** logs JSON estructurados (`pino`), métricas Prometheus en
  `/metrics` (protegido por bearer token), Sentry opcional.

**Superficie HTTP** (31 endpoints en 9 tags — ver `CLAUDE.md` para la lista
completa generada automáticamente):

- `Auth` — Google OAuth (web/mobile), refresh, perfil, baja
- `Catalog` — definiciones de programa (templates y custom)
- `Programs` — instancias de programa del usuario (CRUD + import/export)
- `Results` — registrar y deshacer resultados de entrenamiento
- `Exercises` / `Muscle groups` — catálogo y ejercicios custom
- `Insights` — lectura de insights pre-computados por analytics
- `Stats` — usuarios online en tiempo real (Redis presence)
- `System` — `/health`, `/metrics`

### Analytics — `apps/backend/analytics`

**Stack:** Python 3.12 + FastAPI 0.115 + psycopg 3 + scikit-learn + APScheduler.

Servicio aparte porque las cargas son distintas: cómputo batch en background,
ML con SciPy/scikit, y un dominio (predicción y detección de plateau) que en
TypeScript sería una pelea contra la falta de librerías. Aquí Python brilla.

- **APScheduler** dispara cómputos periódicos por usuario.
- **Endpoint `POST /compute`** permite trigger manual, protegido por secreto
  interno (no se expone públicamente; va por la red del compose).
- **Resultados se escriben en `user_insights`** y el API los devuelve al
  frontend. Analytics nunca habla directo con un cliente.
- **Tests con pytest** en `apps/backend/analytics/tests/`.

### Persistencia

- **Postgres** — 10 tablas, esquema en
  [`packages/database/src/schema.ts`](packages/database/src/schema.ts).
  Migraciones generadas en `packages/database/migrations/` y aplicadas al startup.
- **Redis** — rate limiting distribuido, conteo de usuarios online (presence),
  caché de respuestas hot y singleflight para evitar dogpile en endpoints
  caros. Si `REDIS_URL` no está seteado, todo cae a stores en memoria con
  fallback gracioso (útil en dev y CI).

### Por qué este split y no un monolito

- El API necesita latencia baja en cada request HTTP; analytics necesita
  ejecutar batch de minutos. Mezclarlos en un solo proceso significa o bien
  bloquear el event loop, o bien meter una cola in-process que se cae si el
  proceso se reinicia.
- El stack de ML (scikit, scipy, numpy) no tiene equivalente en JS sin perder
  rendimiento o precisión. Forzarlo a Bun sería una decisión ideológica, no
  técnica.
- El contrato entre los dos es **la base de datos** (tabla `user_insights`)
  más un único endpoint HTTP. Acoplamiento mínimo.

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
  toma `/swagger/json` del API y genera `src/lib/api/generated.ts`. Lefthook
  bloquea push si el archivo generado y el swagger del API divergen.
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

- **Cache agresivo gratis.** El SPA es un bundle inmutable: `/assets/*` se
  sirven con `max-age=31536000` directo desde disco, sin tocar Bun.
- **El API no carga assets, no compila Vite, no sirve HTML.** Restartear el
  API no rompe la web ni viceversa.
- **Build pipeline distinto.** El SPA se buildea en GHA y se sube como
  artifact; el API se buildea como imagen Docker. Cero acoplamiento entre los
  dos procesos.

---

## 4. Paquete compartido

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

---

## 5. Desarrollo local

### Pre-requisitos

- **Bun** (última versión) — runtime para API, tooling de frontends, y tests
- **PostgreSQL** local o managed
- **Redis** opcional — sin él, rate limit y presence caen a memoria
- **Python 3.12** + pip — solo si vas a tocar el servicio de analytics

### Setup

```bash
# Instalar dependencias del monorepo entero
bun install

# Copiar .env.example y completar DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID*, etc.
cp .env.example .env

# Levantar el API (corre migraciones y seeds al arrancar)
bun run dev:api

# En otra terminal, levantar el SPA web
bun run dev:web

# (Opcional) Levantar analytics
cd apps/backend/analytics && uvicorn main:app --reload --port 8000
```

Defaults: web en `http://localhost:5173`, API en `http://localhost:3001`,
analytics en `http://localhost:8000`.

Para la app mobile, configurá `EXPO_PUBLIC_API_URL` apuntando al API y los
IDs de Google OAuth que necesita Expo:

- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

El API necesita `GOOGLE_CLIENT_IDS` con todos esos IDs (mobile + web) para
aceptar tokens de `/api/auth/mobile/google`.

### Comandos

| Tarea                              | Comando                                                  |
| ---------------------------------- | -------------------------------------------------------- |
| Dev (web)                          | `bun run dev:web`                                        |
| Dev (API)                          | `bun run dev:api`                                        |
| Dev (analytics)                    | `cd apps/backend/analytics && uvicorn main:app --reload` |
| Build (web)                        | `bun run build:web`                                      |
| Type check (web + domain + mobile) | `bun run typecheck`                                      |
| Type check (API)                   | `bun run typecheck:api`                                  |
| Type check (domain)                | `bun run typecheck:domain`                               |
| Lint (TS)                          | `bun run lint`                                           |
| Format check                       | `bun run format:check`                                   |
| Tests workspace (unit)             | `bun run test`                                           |
| Tests API (unit)                   | `bun run test:api`                                       |
| Tests analytics (pytest)           | `cd apps/backend/analytics && pytest`                    |
| E2E (Playwright)                   | `bun run e2e`                                            |
| E2E con UI                         | `bun run e2e:headed`                                     |
| Load test (k6)                     | `k6 run scripts/loadtest.js`                             |
| Load test (smoke)                  | `k6 run scripts/loadtest.js --env SCENARIO=smoke`        |

### Hooks de git

[Lefthook](lefthook.yml) corre en paralelo:

- **pre-commit:** typecheck + lint + format
- **pre-push:** tests + build + chequeo de drift entre tipos generados del
  API y el swagger real

No saltees los hooks con `--no-verify`. Si fallan es porque hay algo que
arreglar antes de subir.

---

## 6. Documentación adicional

| Archivo                                                                      | Propósito                                                  |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                                                     | Contexto autogenerado para agentes (API + DB en vivo)      |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                               | Split por tiers, stack detallado de cada servicio          |
| [`docs/llm-map.md`](docs/llm-map.md)                                         | Tabla path → propósito para navegación rápida              |
| [`.env.example`](.env.example)                                               | Referencia completa de variables de entorno                |
| [`infra/production/Caddyfile`](infra/production/Caddyfile)                   | Config del reverse proxy / static host en producción       |
| [`infra/production/docker-compose.yml`](infra/production/docker-compose.yml) | Stack completo de producción (mismo archivo en dev y prod) |
