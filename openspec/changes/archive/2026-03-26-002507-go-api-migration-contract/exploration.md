---
summary: Complete HTTP contract of the TypeScript/ElysiaJS API, captured as the oracle for the Go migration.
read_when: Starting Go API migration work, or validating any endpoint implementation against the canonical TS behavior.
---

# Explore: go-api-migration-contract

**Change ID:** go-api-migration-contract
**Date captured:** 2026-03-26
**Source branch:** go-api (bef5a51)

---

## Current State

The current API is a TypeScript monolith built on **ElysiaJS** running on **Bun**, serving both a REST API (prefixed `/api`) and the pre-built React SPA. The entire codebase is ~13 000 lines across routes, services, middleware, and lib. This document captures every behavioral detail that a Go replacement must reproduce identically.

---

## Relevant Files

| File                                  | Lines | Role                                                                     |
| ------------------------------------- | ----- | ------------------------------------------------------------------------ |
| `src/create-app.ts`                   | 194   | App factory: CORS, middleware chain, route mounting, health/metrics/SPA  |
| `src/bootstrap.ts`                    | 225   | Entry point: env parsing, migrations, seeds, server start, token cleanup |
| `src/index.ts`                        | 1     | Re-exports bootstrap                                                     |
| `src/routes/auth.ts`                  | 418   | Auth endpoints                                                           |
| `src/routes/programs.ts`              | 365   | Program instance CRUD                                                    |
| `src/routes/results.ts`               | 160   | Workout result record/delete/undo                                        |
| `src/routes/catalog.ts`               | 131   | Public catalog endpoints + preview                                       |
| `src/routes/exercises.ts`             | 247   | Exercise list/create/muscle-groups                                       |
| `src/routes/program-definitions.ts`   | 275   | User-owned program definitions                                           |
| `src/routes/stats.ts`                 | 25    | Online user count                                                        |
| `src/middleware/auth-guard.ts`        | 90    | JWT plugin + resolveUserId                                               |
| `src/middleware/error-handler.ts`     | 61    | ApiError class + error codes                                             |
| `src/middleware/rate-limit.ts`        | 101   | Sliding-window rate limiter                                              |
| `src/middleware/redis-rate-limit.ts`  | 50    | Redis Lua-backed rate limiter                                            |
| `src/middleware/request-logger.ts`    | 38    | Pino request logging middleware                                          |
| `src/plugins/metrics.ts`              | 55    | Prometheus instrumentation plugin                                        |
| `src/plugins/swagger.ts`              | 42    | OpenAPI/Swagger (dev only)                                               |
| `src/services/auth.ts`                | 210   | Auth business logic                                                      |
| `src/services/programs.ts`            | 691   | Program instance business logic                                          |
| `src/services/results.ts`             | 369   | Result record/delete/undo logic                                          |
| `src/services/catalog.ts`             | 336   | Catalog list/get/preview                                                 |
| `src/services/exercises.ts`           | 299   | Exercise CRUD                                                            |
| `src/services/program-definitions.ts` | 563   | Program definition CRUD + state machine                                  |
| `src/db/schema.ts`                    | 341   | Drizzle ORM schema (all tables)                                          |
| `src/db/index.ts`                     | 80    | PostgreSQL connection singleton                                          |
| `src/lib/metrics.ts`                  | 42    | Prometheus counters/histograms                                           |
| `src/lib/redis.ts`                    | 30    | ioredis singleton                                                        |
| `src/lib/logger.ts`                   | 30    | Pino logger singleton                                                    |
| `src/lib/presence.ts`                 | 23    | Redis sorted-set presence tracking                                       |
| `src/lib/program-cache.ts`            | 80    | Redis cache for program instances                                        |
| `src/lib/catalog-cache.ts`            | 135   | Redis cache for catalog data                                             |
| `src/lib/google-auth.ts`              | 175   | Google JWKS/RS256 token verification                                     |
| `src/lib/sentry.ts`                   | 18    | Sentry error tracking                                                    |

---

## Architecture Overview

```
Client
  │
  ├─ CORS (credentials: true, configurable origins)
  ├─ Swagger plugin (dev only, /swagger)
  ├─ Metrics plugin (Prometheus instrumentation)
  ├─ Security headers (onAfterHandle)
  ├─ Request logger (Pino, child per request)
  ├─ Global error handler (onError)
  │
  ├─ /api prefix
  │   ├─ /auth          → authRoutes
  │   ├─ /programs      → programRoutes
  │   ├─ /programs/:id  → resultRoutes (nested)
  │   ├─ /catalog       → catalogRoutes
  │   ├─ /exercises     → exerciseRoutes
  │   ├─ /muscle-groups → exerciseRoutes (public)
  │   ├─ /program-definitions → programDefinitionRoutes
  │   └─ /stats/online  → statsRoutes
  │
  ├─ /health            → inline handler (no /api prefix)
  ├─ /metrics           → inline handler (no /api prefix)
  └─ /* → SPA static files (web/dist)
```

**Key constraint:** All API routes live under `/api`. Health and metrics live at the root level. SPA catch-all (`/*`) serves `index.html` for client-side routing.

---

## Detailed Findings

### 1. Server Configuration

- **Runtime:** Bun (not Node.js). HTTP server: ElysiaJS.
- **Listen:** `PORT` env var, default `3001`. `maxRequestBodySize: 1_048_576` (1 MB).
- **Shutdown grace:** 10 000 ms timeout, handles SIGTERM and SIGINT.
- **Startup sequence:** sentry init → migrations → seeds → app creation → listen → token cleanup job.

---

### 2. CORS Configuration

```
cors({
  origin: CORS_ORIGINS,   // from CORS_ORIGIN env var, comma-separated
  credentials: true,
})
```

- `Access-Control-Allow-Credentials: true` on all responses.
- Origins: single string or array from `CORS_ORIGIN` env var.
- Dev default (no env var): `http://localhost:3000`.
- Production: `CORS_ORIGIN` is required; startup throws if missing.
- ElysiaJS CORS plugin does not explicitly enumerate `methods` or `headers`, so it uses its defaults (all methods, standard headers + custom).
- **No** explicit `allowedHeaders` override — the plugin mirrors the request's `Access-Control-Request-Headers`.

---

### 3. Security Headers

Set via `onAfterHandle` on every response:

| Header                      | Value                                                                      |
| --------------------------- | -------------------------------------------------------------------------- |
| `x-content-type-options`    | `nosniff`                                                                  |
| `x-frame-options`           | `DENY`                                                                     |
| `referrer-policy`           | `strict-origin-when-cross-origin`                                          |
| `content-security-policy`   | See below                                                                  |
| `strict-transport-security` | `max-age=31536000; includeSubDomains` (production only)                    |
| `permissions-policy`        | `camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()` |

**CSP value (exact):**

```
default-src 'self'; script-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; img-src 'self' data: blob: https://lh3.googleusercontent.com; connect-src 'self' https://accounts.google.com https://www.googleapis.com https://*.ingest.sentry.io; font-src 'self' https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; frame-src https://accounts.google.com; frame-ancestors 'none'
```

Note: HSTS header is only added when `NODE_ENV === 'production'`.

---

### 4. Request Logger Middleware

Every request gets:

- `reqId`: taken from `x-request-id` header if it matches `/^[\w-]{8,64}$/`; otherwise a new `randomUUID()`.
- `reqLogger`: a Pino child logger with fields `{ reqId, method, url, ip }`.
- `startMs`: `Date.now()` at request start.
- `ip`: from socket address unless `TRUSTED_PROXY=true`, in which case uses `x-forwarded-for` header (first value, split on `,`).

On response: `x-request-id` header set to `reqId`. Log entry includes `{ status, latencyMs }`.

Pino redacts `authorization` and `cookie` headers as `[Redacted]`.

---

### 5. Error Response Format

All errors return JSON. The exact shape is:

```json
{ "error": "<human-readable message>", "code": "<machine-readable code>" }
```

**Status code mapping:**

| Condition                       | HTTP Status        | code field         |
| ------------------------------- | ------------------ | ------------------ |
| `ApiError` instance             | `error.statusCode` | `error.code`       |
| Route not found                 | 404                | `NOT_FOUND`        |
| Elysia validation failure       | 400                | `VALIDATION_ERROR` |
| Elysia parse failure (bad JSON) | 400                | `PARSE_ERROR`      |
| Any unhandled exception         | 500                | `INTERNAL_ERROR`   |

**All known ApiError codes:**

| Code                     | Typical status |
| ------------------------ | -------------- |
| `UNAUTHORIZED`           | 401            |
| `AUTH_INVALID`           | 401            |
| `AUTH_JWKS_UNAVAILABLE`  | 503            |
| `AUTH_GOOGLE_INVALID`    | 401            |
| `AUTH_NO_REFRESH_TOKEN`  | 401            |
| `AUTH_INVALID_REFRESH`   | 401            |
| `AUTH_REFRESH_EXPIRED`   | 401            |
| `TOKEN_INVALID`          | 401            |
| `USER_NOT_FOUND`         | 404            |
| `ACCOUNT_DELETED`        | 403            |
| `DB_WRITE_ERROR`         | 500            |
| `CONFIGURATION_ERROR`    | 500            |
| `NOT_FOUND`              | 404            |
| `FORBIDDEN`              | 403            |
| `VALIDATION_ERROR`       | 400 or 422     |
| `PARSE_ERROR`            | 400            |
| `LIMIT_EXCEEDED`         | 409            |
| `INVALID_TRANSITION`     | 403            |
| `ACTIVE_INSTANCES_EXIST` | 409            |
| `HYDRATION_FAILED`       | 500            |
| `METADATA_TOO_LARGE`     | 400            |
| `INVALID_AVATAR`         | 400            |
| `AVATAR_TOO_LARGE`       | 400            |
| `INVALID_SLUG`           | 422            |
| `DUPLICATE`              | 409            |
| `INTERNAL_ERROR`         | 500            |
| `RATE_LIMITED`           | 429            |
| `GATEWAY_TIMEOUT`        | —              |
| `AMBIGUOUS_SOURCE`       | 422            |
| `MISSING_PROGRAM_SOURCE` | 422            |
| `INVALID_PROGRAM`        | 400            |
| `INVALID_CURSOR`         | 400            |
| `INSTANCE_NOT_FOUND`     | 404            |
| `RESULT_NOT_FOUND`       | 404            |
| `PROGRAM_NOT_FOUND`      | 404            |
| `INVALID_DATA`           | 400            |
| `INVALID_AVATAR`         | 400            |

**ApiError supports optional extra headers.** Rate limit errors always include:

```
Retry-After: <windowMs / 1000>
```

---

### 6. Rate Limiting

**Implementation:** sliding window (Redis sorted-set Lua script when Redis is available; in-memory `Map<string, number[]>` otherwise).

**Key format:** `rl:<endpoint>:<ip-or-userId>`

**Defaults:** `windowMs=60000` (1 min), `maxRequests=20`

**Per-endpoint overrides:**

| Endpoint key                        | windowMs         | maxRequests  |
| ----------------------------------- | ---------------- | ------------ |
| `/auth/google`                      | 60 000           | 10           |
| `/auth/refresh` (prod)              | 60 000           | 20 (default) |
| `/auth/refresh` (dev)               | 60 000           | 500          |
| `/auth/signout`                     | 60 000           | 20 (default) |
| `GET /auth/me`                      | 60 000           | 100          |
| `/auth/me/patch`                    | 60 000           | 20           |
| `/auth/me/delete`                   | 60 000           | 5            |
| `GET /programs`                     | 60 000           | 100          |
| `POST /programs`                    | 60 000           | 20 (default) |
| `GET /programs/:id`                 | 60 000           | 100          |
| `PATCH /programs`                   | 60 000           | 20 (default) |
| `PATCH /programs/metadata`          | 60 000           | 20 (default) |
| `DELETE /programs`                  | 60 000           | 20 (default) |
| `GET /programs/:id/export`          | 60 000           | 20           |
| `POST /programs/import`             | 60 000           | 20 (default) |
| `POST /programs/results`            | 60 000           | 60           |
| `POST /programs/undo`               | 60 000           | 20 (default) |
| `GET /catalog`                      | 60 000           | 100          |
| `GET /catalog/:id`                  | 60 000           | 100          |
| `POST /catalog/preview`             | 3 600 000 (1 hr) | 30           |
| `GET /exercises`                    | 60 000           | 100          |
| `POST /exercises`                   | 60 000           | 20 (default) |
| `GET /muscle-groups`                | 60 000           | 100          |
| `GET /program-definitions`          | 60 000           | 100          |
| `POST /program-definitions`         | 3 600 000        | 5            |
| `POST /program-definitions/fork`    | 3 600 000        | 10           |
| `GET /program-definitions/:id`      | 60 000           | 100          |
| `PUT /program-definitions`          | 3 600 000        | 20           |
| `DELETE /program-definitions`       | 3 600 000        | 20           |
| `PATCH /program-definitions/status` | 3 600 000        | 20           |

**Rate limit key:** varies by endpoint — some use `userId`, some use raw `ip` or `x-forwarded-for`, some use composite `userId:ip`.

- Auth routes: keyed on raw `ip` (from `requestLogger.ip`)
- Program/result routes: keyed on `userId`
- GET /exercises: `userId:ip` if authenticated, else `ip`
- GET /catalog, GET /muscle-groups: keyed on `x-forwarded-for ?? 'anonymous'`

**On limit exceeded:** HTTP 429 with header `Retry-After: <windowSeconds>`, body `{ error: "Too many requests", code: "RATE_LIMITED" }`.

**Redis Lua script behavior:** atomically removes stale entries with ZREMRANGEBYSCORE, checks count with ZCARD, adds new timestamp entry with ZADD, sets PEXPIRE. Fail-open: if Redis is unavailable, the check returns `true` (allowed).

---

### 7. Auth Contract

#### JWT (Access Token)

- **Algorithm:** HS256 (ElysiaJS `@elysiajs/jwt` default)
- **Secret:** `JWT_SECRET` env var. Required to be 64+ chars in production. Dev default: `dev-secret-change-me`.
- **Payload claims:** `{ sub: userId, email?: string, exp: "<duration>" }`
  - `sub`: user UUID
  - `email`: only included in sign-in tokens, not in refresh tokens
  - `exp`: `JWT_ACCESS_EXPIRY` env var, default `15m`
- **Transmitted:** `Authorization: Bearer <token>` request header
- **Verification:** ElysiaJS JWT plugin handles HS256 verify. `verify()` returns `false` on invalid/expired.

#### Refresh Token (Cookie)

- **Token format:** raw UUID v4 (`crypto.randomUUID()`)
- **Storage:** SHA-256 hex hash stored in `refresh_tokens` table
- **Cookie name:** `refresh_token`
- **Cookie attributes:**
  ```
  httpOnly: true
  secure: true (production only; false in dev)
  sameSite: strict
  maxAge: 604800 (7 days in seconds = 7 * 24 * 60 * 60)
  path: /api/auth
  ```
- **Expiry:** 7 days (`REFRESH_TOKEN_DAYS = 7`)
- **Rotation:** on every `/auth/refresh`, old token is revoked and a new one issued. `previousTokenHash` tracks the chain for theft detection.
- **Theft detection:** if an already-rotated token is presented, the system finds the successor token via `previousTokenHash`, then revokes ALL sessions for that user.

#### Google OAuth Flow

1. Client receives Google ID token (RS256) from Google Identity Services.
2. `POST /api/auth/google` with `{ credential: "<google-id-token>" }`.
3. Server verifies RS256 signature against Google JWKS (cached 1 hour). URL: `https://www.googleapis.com/oauth2/v3/certs`.
4. Validates: issuer must be `accounts.google.com` or `https://accounts.google.com`; audience must match `GOOGLE_CLIENT_ID`; not expired.
5. Upserts user in DB (INSERT ... ON CONFLICT DO UPDATE on `google_id`).
6. Issues access token + refresh token cookie.
7. On new users: fires Telegram notification (fire-and-forget, does NOT block response).

---

### 8. Complete Endpoint Reference

All API routes have the `/api` prefix. The Go API must reproduce this prefix.

#### Auth Routes (`/api/auth`)

---

##### `POST /api/auth/google`

- **Auth:** none
- **Rate limit:** 10/min keyed on `ip`
- **Request body:** `{ "credential": "<non-empty string>" }`
- **Response 200:**
  ```json
  {
    "user": {
      "id": "<uuid>",
      "email": "<string>",
      "name": "<string|null>",
      "avatarUrl": "<string|null>"
    },
    "accessToken": "<jwt>"
  }
  ```
- **Side effect:** Sets `refresh_token` cookie. For new users, fires Telegram notification.
- **Status codes:** 200 (ok), 400 (missing/invalid body), 401 (bad Google token), 429 (rate limited)
- **Error codes:** `AUTH_GOOGLE_INVALID`, `ACCOUNT_DELETED`, `DB_WRITE_ERROR`

---

##### `POST /api/auth/dev` (non-production only)

- **Auth:** none
- **Behavior:** Returns 404 in production (`NODE_ENV === 'production'`).
- **Request body:** `{ "email": "<valid email format>" }`
- **Response 201:**
  ```json
  {
    "user": { "id": "...", "email": "...", "name": null, "avatarUrl": null },
    "accessToken": "<jwt>"
  }
  ```
- **Note:** Reuses existing user by email to avoid unique constraint violations on repeated calls.

---

##### `POST /api/auth/refresh`

- **Auth:** none (reads `refresh_token` cookie)
- **Rate limit:** 20/min (prod) or 500/min (dev) keyed on `ip`
- **Request body:** empty / any (cookie-based)
- **Response 200:** `{ "accessToken": "<jwt>" }`
- **Side effect:** Rotates `refresh_token` cookie (old revoked, new issued).
- **Status codes:** 200, 401, 429
- **Error codes:** `AUTH_NO_REFRESH_TOKEN`, `AUTH_INVALID_REFRESH`, `AUTH_REFRESH_EXPIRED`

---

##### `POST /api/auth/signout`

- **Auth:** none (reads `refresh_token` cookie)
- **Rate limit:** 20/min keyed on `ip`
- **Response 204:** empty body
- **Side effect:** Revokes refresh token from DB; clears cookie.
- **Status codes:** 204, 429

---

##### `GET /api/auth/me`

- **Auth:** `Authorization: Bearer <token>` (manually extracted — does NOT use the standard `resolveUserId` helper; uses its own extraction logic)
- **Rate limit:** 100/min keyed on `userId` (sub from JWT)
- **Response 200:**
  ```json
  {
    "id": "<uuid>",
    "email": "<string>",
    "name": "<string|null>",
    "avatarUrl": "<string|null>"
  }
  ```
- **Status codes:** 200, 401, 404
- **Error codes:** `UNAUTHORIZED`, `TOKEN_INVALID`, `USER_NOT_FOUND`

---

##### `PATCH /api/auth/me`

- **Auth:** `Authorization: Bearer <token>` (via `resolveUserId`)
- **Rate limit:** 20/min keyed on `ip`
- **Request body:**
  ```json
  {
    "name"?: "<1-100 chars>",
    "avatarUrl"?: "<data-url string | null>"
  }
  ```
- **Avatar validation:** must match `^data:image/(jpeg|png|webp);base64,...$`. Max 200 000 bytes. Base64 roundtrip validated. Send `null` to remove avatar.
- **Response 200:** Same shape as GET /auth/me
- **Status codes:** 200, 400, 401
- **Error codes:** `INVALID_AVATAR`, `AVATAR_TOO_LARGE`, `UNAUTHORIZED`

---

##### `DELETE /api/auth/me`

- **Auth:** `Authorization: Bearer <token>` (via `resolveUserId`)
- **Rate limit:** 5/min keyed on `ip`
- **Response 204:** empty body
- **Side effect:** Sets `users.deleted_at = now()`. Revokes all refresh tokens. Clears cookie.
- **Status codes:** 204, 401
- **Note:** Soft delete — data purged after 30 days by `purge-deleted-users.ts` script.

---

#### Program Routes (`/api/programs`)

All program routes require `Authorization: Bearer <token>`.

---

##### `GET /api/programs`

- **Rate limit:** 100/min keyed on `userId`
- **Query params:**
  - `limit`: optional number, 1-100, default 20
  - `cursor`: optional string (composite cursor from previous response)
- **Response 200:**
  ```json
  {
    "data": [
      {
        "id": "<uuid>",
        "programId": "<string>",
        "name": "<string>",
        "status": "active|completed|archived",
        "createdAt": "<ISO 8601>",
        "updatedAt": "<ISO 8601>"
      }
    ],
    "nextCursor": "<string|null>"
  }
  ```
- **Pagination:** cursor-based. Ordered by `createdAt DESC, id ASC`.
- **Cursor format:** `<createdAt.toISOString()>_<uuid>` (ISO timestamp + underscore + UUID). Example: `2024-01-15T10:30:00.000Z_550e8400-e29b-41d4-a716-446655440000`.
- **Cursor parsing:** splits on the LAST underscore (`lastIndexOf('_')`). Everything before = ISO timestamp; everything after = UUID.
- **Status codes:** 200, 400 (invalid cursor), 401

---

##### `POST /api/programs`

- **Rate limit:** 20/min keyed on `userId`
- **Request body:**
  ```json
  {
    "programId"?: "<non-empty string>",
    "definitionId"?: "<non-empty string>",
    "name": "<1-100 chars>",
    "config": { "<key up to 30 chars>": <number 0-10000 or string up to 100 chars> }
  }
  ```
- **Constraint:** exactly one of `programId` or `definitionId` must be non-empty. Both → 422 `AMBIGUOUS_SOURCE`. Neither → 422 `MISSING_PROGRAM_SOURCE`.
- **Response 201:** Full `ProgramInstanceResponse` (see shape below)
- **Status codes:** 201, 400, 401, 403, 404, 422, 429

**ProgramInstanceResponse shape:**

```json
{
  "id": "<uuid>",
  "programId": "<string>",
  "name": "<string>",
  "config": { "<key>": <number|string> },
  "metadata": <object|null>,
  "status": "active|completed|archived",
  "results": {
    "<workoutIndex>": {
      "<slotId>": {
        "result": "success|fail",
        "amrapReps"?: <number>,
        "rpe"?: <number>,
        "setLogs"?: [{ "reps": <number>, "weight"?: <number>, "rpe"?: <number> }]
      }
    }
  },
  "undoHistory": [
    {
      "i": <number>,
      "slotId": "<string>",
      "prev"?: "success|fail",
      "prevRpe"?: <number>,
      "prevAmrapReps"?: <number>,
      "prevSetLogs"?: [{ "reps": <number>, "weight"?: <number>, "rpe"?: <number> }]
    }
  ],
  "resultTimestamps": { "<workoutIndex>": "<ISO 8601>" },
  "completedDates": { "<workoutIndex>": "<ISO 8601>" },
  "definitionId": "<uuid|null>",
  "customDefinition": <object|null>,
  "createdAt": "<ISO 8601>",
  "updatedAt": "<ISO 8601>"
}
```

**Critical serialization details for `results` and `undoHistory`:**

- `amrapReps`, `rpe`, `setLogs` in results: **omitted** (not null) if the DB column is NULL. Uses spread conditional: `...(val !== null ? { key: val } : {})`.
- `prev`, `prevRpe`, `prevAmrapReps`, `prevSetLogs` in undoHistory entries: **omitted** if null.
- `resultTimestamps`: maps `workoutIndex` (as string key) to the **earliest** `createdAt` ISO string for that workout.
- `completedDates`: maps `workoutIndex` (as string key) to the first non-null `completedAt` ISO string.

---

##### `GET /api/programs/:id`

- **Rate limit:** 100/min keyed on `userId`
- **Path param:** `id` = program instance UUID
- **Response 200:** Full `ProgramInstanceResponse` (cached in Redis for 5 min)
- **Status codes:** 200, 401, 404
- **Cache:** Redis key `program:<userId>:<instanceId>`, TTL 300s. Invalidated on any write to that instance.
- **Singleflight:** concurrent GETs for the same instance share one DB fetch.

---

##### `PATCH /api/programs/:id`

- **Rate limit:** 20/min keyed on `userId`
- **Request body:**
  ```json
  {
    "name"?: "<1-100 chars>",
    "status"?: "active|completed|archived",
    "config"?: { "<key up to 30 chars>": <number 0-10000 or string up to 100 chars> }
  }
  ```
- **Response 200:** Full `ProgramInstanceResponse`
- **Side effect:** Invalidates Redis cache for this instance.
- **Status codes:** 200, 401, 404, 429

---

##### `PATCH /api/programs/:id/metadata`

- **Rate limit:** 20/min keyed on `userId`
- **Request body:**
  ```json
  {
    "metadata": { "<key up to 50 chars>": <string up to 500 | number | boolean | null> }
  }
  ```
- **Merge semantics:** JSONB `||` operator (shallow merge, not deep). Uses `COALESCE(metadata, '{}'::jsonb) || $1::jsonb`.
- **Size limit:** 10 000 bytes (checked on the serialized JSON of the incoming `metadata` patch, not the total).
- **Response 200:** Full `ProgramInstanceResponse`
- **Side effect:** Invalidates Redis cache.
- **Status codes:** 200, 400 (`METADATA_TOO_LARGE`), 401, 404, 429

---

##### `DELETE /api/programs/:id`

- **Rate limit:** 20/min keyed on `userId`
- **Response 204:** empty body
- **Side effect:** CASCADE deletes `workout_results` and `undo_entries`. Invalidates Redis cache.
- **Status codes:** 204, 401, 404, 429

---

##### `GET /api/programs/:id/export`

- **Rate limit:** 20/min keyed on `userId`
- **Response 200:**
  ```json
  {
    "version": 1,
    "exportDate": "<ISO 8601>",
    "programId": "<string>",
    "name": "<string>",
    "config": { ... },
    "results": { ... },
    "undoHistory": [ ... ]
  }
  ```
- **Status codes:** 200, 401, 404

---

##### `POST /api/programs/import`

- **Rate limit:** 20/min keyed on `userId`
- **Request body:**
  ```json
  {
    "version": 1,
    "exportDate": "<ISO 8601>",
    "programId": "<non-empty string>",
    "name": "<1-100 chars>",
    "config": { ... },
    "results": {
      "<workoutIndex>": {
        "<slotId>": {
          "result"?: "success|fail",
          "amrapReps"?: <integer >= 0>,
          "rpe"?: <integer 6-10>
        }
      }
    },
    "undoHistory": [
      {
        "i": <integer >= 0>,
        "slotId": "<non-empty string>",
        "prev"?: "success|fail",
        "prevRpe"?: <integer 1-10>,
        "prevAmrapReps"?: <integer >= 0>
      }
    ]
  }
  ```
- **Constraints:** `undoHistory` max 500 items. `results.*.*.rpe` range 6-10 in body schema. `workoutIndex` bounds validated against program definition. `slotId` validated against definition's valid slot IDs. `amrapReps` max 99.
- **Response 201:** Full `ProgramInstanceResponse`
- **Status codes:** 201, 400, 401, 429

---

#### Result Routes (`/api/programs/:id/results`)

All require `Authorization: Bearer <token>`.

---

##### `POST /api/programs/:id/results`

- **Rate limit:** 60/min keyed on `userId`
- **Request body:**
  ```json
  {
    "workoutIndex": <integer >= 0>,
    "slotId": "<non-empty string>",
    "result": "success|fail",
    "amrapReps"?: <integer >= 0>,
    "rpe"?: <integer 1-10>,
    "setLogs"?: [
      { "reps": <integer 0-999>, "weight"?: <number >= 0>, "rpe"?: <integer 1-10> }
    ]
  }
  ```
- **Constraints:** `setLogs` max 20 items. `amrapReps` max 99. `rpe` 1-10.
- **Behavior:** Upsert (INSERT ... ON CONFLICT DO UPDATE on `instanceId + workoutIndex + slotId`). Pushes undo entry. Trims undo stack to 50 entries. Syncs `completed_at` on all rows for that workout index.
- **Response 201:**
  ```json
  {
    "workoutIndex": <number>,
    "slotId": "<string>",
    "result": "success|fail",
    "amrapReps"?: <number>,
    "rpe"?: <number>,
    "setLogs"?: [...]
  }
  ```
  (fields omitted, not null, when DB column is NULL)
- **Status codes:** 201, 400, 401, 404, 429

---

##### `DELETE /api/programs/:id/results/:workoutIndex/:slotId`

- **Path params:** `workoutIndex` (numeric), `slotId` (string)
- **Rate limit:** implicit via no explicit call — note: no `rateLimit()` call in this handler. No rate limiting.
- **Behavior:** Reads existing result, pushes undo entry capturing it, then deletes. Syncs `completed_at`.
- **Response 204:** empty body
- **Status codes:** 204, 401, 404

---

##### `POST /api/programs/:id/undo`

- **Rate limit:** 20/min keyed on `userId`
- **Request body:** empty / any
- **Behavior:** Pops highest-id undo entry (LIFO). If `prevResult === null`, deletes current result. Otherwise, upserts previous result state. Syncs `completed_at`.
- **Response 200:**
  ```json
  { "undone": null }
  ```
  or
  ```json
  {
    "undone": {
      "i": <number>,
      "slotId": "<string>",
      "prev"?: "success|fail",
      "prevSetLogs"?: [...]
    }
  }
  ```
  Note: `prev` and `prevSetLogs` are omitted (not null) when absent. `prevRpe` and `prevAmrapReps` are NOT included in the undo response (only `prev` and `prevSetLogs`).
- **Status codes:** 200, 401, 404, 429

---

#### Catalog Routes (`/api/catalog`)

---

##### `GET /api/catalog`

- **Auth:** none
- **Rate limit:** 100/min keyed on `x-forwarded-for ?? 'anonymous'`
- **Response 200:** Array of catalog entries:
  ```json
  [
    {
      "id": "<string>",
      "name": "<string>",
      "description": "<string>",
      "author": "<string>",
      "category": "<string>",
      "level": "beginner|intermediate|advanced",
      "source": "<string>",
      "totalWorkouts": <number>,
      "workoutsPerWeek": <number>,
      "cycleLength": <number>
    }
  ]
  ```
- **Cache:** `Cache-Control: public, max-age=300, stale-while-revalidate=60`. Also Redis-cached at key `catalog:list`, TTL 300s.
- **Ordering:** alphabetical by name (`ORDER BY name ASC`).

---

##### `GET /api/catalog/:programId`

- **Auth:** none
- **Rate limit:** 100/min keyed on `x-forwarded-for ?? 'anonymous'`
- **Response 200:** Full hydrated `ProgramDefinition` object (complex nested structure from `@gzclp/shared/types/program`)
- **Cache:** `Cache-Control: public, max-age=300`. Also Redis-cached at key `catalog:detail:<programId>`, TTL 300s.
- **Status codes:** 200, 404 (`PROGRAM_NOT_FOUND`), 500 (`HYDRATION_FAILED`)

---

##### `POST /api/catalog/preview`

- **Auth:** required (`Authorization: Bearer <token>`)
- **Rate limit:** 30 per hour, keyed on `userId`
- **Request body:**
  ```json
  {
    "definition": <any>,
    "config"?: <any>
  }
  ```
- **Behavior:** Validates definition against `ProgramDefinitionSchema` (Zod), then runs `computeGenericProgram` and returns first 10 workout rows.
- **Response 200:** Array of up to 10 `GenericWorkoutRow` objects
- **Status codes:** 200, 401, 422, 429

---

#### Exercise Routes (`/api/exercises`, `/api/muscle-groups`)

---

##### `GET /api/exercises`

- **Auth:** optional (different behavior)
- **Rate limit:** 100/min keyed on `userId:ip` (auth'd) or `ip` (anon)
- **Query params:**
  - `q`: optional text search (ILIKE `%q%` against name)
  - `muscleGroupId`: optional comma-separated IDs (max 20 values)
  - `equipment`: optional comma-separated
  - `force`: optional comma-separated
  - `level`: optional comma-separated
  - `mechanic`: optional comma-separated
  - `category`: optional comma-separated
  - `isCompound`: optional `"true"` or `"false"` string
  - `limit`: optional number, 1-1000, default 100
  - `offset`: optional number >= 0, default 0
- **Behavior:**
  - Unauthenticated: returns only preset exercises (`is_preset = true`)
  - Authenticated: returns preset + user's own (`is_preset = true OR created_by = userId`)
  - `Cache-Control: public, max-age=300` only for unauthenticated responses
- **Response 200:**
  ```json
  {
    "data": [
      {
        "id": "<string, up to 100 chars>",
        "name": "<string>",
        "muscleGroupId": "<string>",
        "equipment": "<string|null>",
        "isCompound": <boolean>,
        "isPreset": <boolean>,
        "createdBy": "<uuid|null>",
        "force": "<string|null>",
        "level": "<string|null>",
        "mechanic": "<string|null>",
        "category": "<string|null>",
        "secondaryMuscles": ["<string>"]|null
      }
    ],
    "total": <number>,
    "offset": <number>,
    "limit": <number>
  }
  ```
- **Ordering:** `ORDER BY name ASC`
- **Cache:** Redis-cached, TTL 300s, keyed by userId + filter hash.

---

##### `GET /api/muscle-groups`

- **Auth:** none
- **Rate limit:** 100/min keyed on `x-forwarded-for ?? 'anonymous'`
- **Response 200:**
  ```json
  [{ "id": "<string>", "name": "<string>" }]
  ```
- **Cache:** `Cache-Control: public, max-age=600`. Also Redis-cached.

---

##### `POST /api/exercises`

- **Auth:** required
- **Rate limit:** 20/min keyed on `userId`
- **Request body:**
  ```json
  {
    "name": "<1-100 chars>",
    "muscleGroupId": "<1-50 chars>",
    "equipment"?: "<up to 50 chars>",
    "isCompound"?: <boolean>
  }
  ```
- **ID generation:** `name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 50)`
- **Response 201:** Full `ExerciseEntry` (same shape as items in GET /exercises response)
- **Status codes:** 201, 400 (invalid muscleGroupId), 401, 409 (`DUPLICATE`), 422 (`INVALID_SLUG`), 429

---

#### Program Definition Routes (`/api/program-definitions`)

All require `Authorization: Bearer <token>`.

---

##### `POST /api/program-definitions`

- **Rate limit:** 5 per hour keyed on `userId`
- **Request body:** `{ "definition": <any> }`
- **Validation:** `ProgramDefinitionSchema` (Zod). Source must be `"custom"`.
- **Constraint:** max 10 active definitions per user (checked by counting non-deleted rows).
- **Response 201:**
  ```json
  {
    "id": "<uuid>",
    "userId": "<uuid>",
    "definition": <object>,
    "status": "draft|pending_review|approved|rejected",
    "createdAt": "<ISO 8601>",
    "updatedAt": "<ISO 8601>",
    "deletedAt": "<ISO 8601>|null"
  }
  ```
- **Status codes:** 201, 401, 409 (`LIMIT_EXCEEDED`), 422, 429

---

##### `GET /api/program-definitions`

- **Rate limit:** 100/min keyed on `userId`
- **Query params:**
  - `limit`: optional, 1-100, default 20
  - `offset`: optional >= 0, default 0
- **Response 200:**
  ```json
  {
    "data": [ <ProgramDefinitionResponse>, ... ],
    "total": <number>
  }
  ```
- **Ordering:** `ORDER BY updated_at DESC`
- **Filters out:** soft-deleted (`deleted_at IS NULL`)

---

##### `POST /api/program-definitions/fork`

- **Rate limit:** 10 per hour keyed on `userId`
- **Request body:**
  ```json
  {
    "sourceId": "<non-empty string>",
    "sourceType": "template|definition"
  }
  ```
- **Behavior:** Creates a new draft definition. Appends `" (copia)"` to the name. Assigns a new UUID as definition `id`.
- **Response 201:** `ProgramDefinitionResponse`
- **Status codes:** 201, 401, 403, 404, 409, 422, 429

---

##### `GET /api/program-definitions/:id`

- **Rate limit:** 100/min keyed on `userId`
- **Response 200:** `ProgramDefinitionResponse`
- **Status codes:** 200, 401, 404

---

##### `PUT /api/program-definitions/:id`

- **Rate limit:** 20 per hour keyed on `userId`
- **Request body:** `{ "definition": <any> }`
- **Behavior:** Validates definition. If status was `pending_review` or `approved`, resets to `draft`.
- **Response 200:** `ProgramDefinitionResponse`
- **Status codes:** 200, 401, 404, 422

---

##### `DELETE /api/program-definitions/:id`

- **Rate limit:** 20 per hour keyed on `userId`
- **Response 204:** empty body
- **Constraint:** Cannot delete if there are active program instances referencing this definition (409 `ACTIVE_INSTANCES_EXIST`).
- **Status codes:** 204, 401, 404, 409

---

##### `PATCH /api/program-definitions/:id/status`

- **Rate limit:** 20 per hour keyed on `userId`
- **Request body:** `{ "status": "draft|pending_review|approved|rejected" }`
- **State machine (transitions allowed):**
  - Owner: `draft → pending_review`, `pending_review → draft`
  - Admin: `pending_review → approved`, `pending_review → rejected`
  - Admin check: `ADMIN_USER_IDS` env var (comma-separated UUIDs)
- **Side effect on `approved`:** invalidates `catalog:list` and `catalog:detail:<programId>` Redis keys.
- **Response 200:** `ProgramDefinitionResponse`
- **Status codes:** 200, 401, 403, 404

---

#### Stats Routes

---

##### `GET /api/stats/online`

- **Auth:** none
- **Response 200:**
  ```json
  { "count": <number|null> }
  ```
  `null` when Redis is unavailable or errors.
- **Implementation:** Redis sorted set `users:online`. Score = `Date.now()` (ms). Members active in last 60 seconds counted via `ZREMRANGEBYSCORE` then `ZCARD`.

---

#### System Routes (no `/api` prefix)

---

##### `GET /health`

- **Auth:** none
- **Response 200 (healthy):**
  ```json
  {
    "status": "ok",
    "timestamp": "<ISO 8601>",
    "uptime": <integer seconds>,
    "db": { "status": "ok", "latencyMs": <number> },
    "redis": { "status": "ok", "latencyMs": <number> }
         or { "status": "disabled" }
         or { "status": "error", "error": "Unavailable" }
  }
  ```
- **Response 503 (db error):**
  ```json
  {
    "status": "degraded",
    "timestamp": "<ISO 8601>",
    "uptime": <integer seconds>,
    "db": { "status": "error", "error": "Unavailable" },
    "redis": ...
  }
  ```
- **Note:** Only DB status determines overall status (`degraded`). Redis being `disabled` or `error` does not degrade overall.
- **`uptime`:** `Math.floor(process.uptime())` — integer seconds since process start.

---

##### `GET /metrics`

- **Auth:** optional bearer token. If `METRICS_TOKEN` env var is set, requires `Authorization: Bearer <METRICS_TOKEN>`. If not set, endpoint is public.
- **Response 200:** Prometheus text format (content-type set to `registry.contentType` from prom-client).
- **Response 401:** `{ "error": "Invalid metrics token", "code": "UNAUTHORIZED" }` when token required but wrong.

---

#### SPA Serving

- `GET /` → serves `web/dist/index.html`
- `GET /.well-known/security.txt` → serves `web/dist/.well-known/security.txt` with `content-type: text/plain; charset=utf-8`
- `GET /*` → serves `web/dist/index.html` (SPA client-side routing fallback)
- Static files in `web/dist/` are served directly from the filesystem (via `@elysiajs/static` with `alwaysStatic: true`).

---

### 9. JSON Serialization

- **Case:** camelCase throughout (both requests and responses). No snake_case in JSON.
- **Date format:** ISO 8601 with milliseconds and Z suffix (`new Date().toISOString()` = `"2024-01-15T10:30:00.000Z"`).
- **Null vs omitted:** both patterns are used in the codebase:
  - User profile fields (`name`, `avatarUrl`): included as `null` when absent.
  - Result fields (`amrapReps`, `rpe`, `setLogs`): **omitted** (not null) when the DB column is NULL.
  - Undo entry fields (`prev`, `prevRpe`, `prevAmrapReps`, `prevSetLogs`): **omitted** (not null) when absent.
  - `definitionId`, `customDefinition`, `metadata` in ProgramInstanceResponse: included as `null` when absent.
  - `deletedAt` in ProgramDefinitionResponse: included as `null` when absent.
  - `nextCursor` in paginated lists: included as `null` (not omitted) when no next page.
- **Number precision:** standard JavaScript number (float64). No special handling.
- **`config` in programs:** stored as JSONB, returned as-is (object with string keys, number or string values).
- **`metadata` in programs:** stored as JSONB, returned as-is (any JSON object).
- **`definition` in program-definitions:** stored as JSONB, returned as-is.

---

### 10. Cursor Pagination (Programs)

- **Only `GET /api/programs` uses cursor pagination.**
- **Cursor format:** `<ISO-timestamp>_<UUID>` where the separator is a single underscore.
- **Parsing:** `lastIndexOf('_')` splits timestamp from UUID. Timestamp before last underscore; UUID after.
- **Example cursor:** `2024-01-15T10:30:00.000Z_550e8400-e29b-41d4-a716-446655440000`
- **SQL semantics:** `WHERE (created_at < :ts) OR (created_at = :ts AND id > :id)` — this provides stable pagination even with ties on `created_at`.
- **Default page size:** 20. Max: 100.
- **`nextCursor`:** `null` when no more pages; string cursor when more pages exist.

**Program Definitions pagination** uses simple **offset-based** pagination (`offset` + `limit` query params). Response shape: `{ data: [...], total: <count> }`.

**Exercises pagination** uses offset-based pagination (`offset` + `limit`). Response shape: `{ data: [...], total: <count>, offset: <number>, limit: <number> }`.

---

### 11. Prometheus Metrics

**Metrics endpoint:** `GET /metrics` (no `/api` prefix).

**Metric names and labels:**

| Metric                          | Type      | Labels                                                     |
| ------------------------------- | --------- | ---------------------------------------------------------- |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code`                           |
| `http_requests_total`           | Counter   | `method`, `route`, `status_code`                           |
| `rate_limit_hits_total`         | Counter   | `endpoint`                                                 |
| `http_errors_total`             | Counter   | `status_class` (`4xx`/`5xx`), `error_code`                 |
| `db_queries_total`              | Counter   | `query_type` (`select`/`insert`/`update`/`delete`/`other`) |
| Default prom-client metrics     | Various   | —                                                          |

**Histogram buckets (seconds):** `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]`

**Route normalization for labels:**

- UUIDs replaced with `:id` (regex: `/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi`)
- Numeric path segments replaced with `/:n` (regex: `/\/\d+/g`)

---

### 12. Redis Key Space

| Key pattern                     | TTL                                      | Purpose                                   |
| ------------------------------- | ---------------------------------------- | ----------------------------------------- | ------------------- |
| `program:<userId>:<instanceId>` | 300s                                     | Program instance response cache           |
| `catalog:list`                  | 300s                                     | Catalog list cache                        |
| `catalog:detail:<programId>`    | 300s                                     | Catalog detail cache                      |
| `rl:<endpoint>:<key>`           | `windowMs` (PEXPIRE)                     | Rate limiter sliding window (sorted sets) |
| `users:online`                  | No fixed TTL (ZREMRANGEBYSCORE to prune) | Presence sorted set                       |
| `exercises:<userId              | preset>:<filterHash>`                    | (managed by exercise-cache)               | Exercise list cache |
| `muscle-groups`                 | (managed by muscle-groups-cache)         | Muscle group list cache                   |

---

### 13. Database Schema Summary

**Tables:**

| Table                 | PK                     | Notes                                                                                                       |
| --------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `users`               | uuid (gen_random_uuid) | Google OAuth. `deleted_at` soft-delete.                                                                     |
| `refresh_tokens`      | uuid                   | SHA-256 hashed tokens. `previous_token_hash` chain for theft detection.                                     |
| `program_instances`   | uuid                   | Has `definition_id` FK + `custom_definition` JSONB snapshot. `config` JSONB, `metadata` JSONB.              |
| `workout_results`     | bigserial              | Unique on `(instance_id, workout_index, slot_id)`. `slot_id` varchar(50). `rpe` smallint. `set_logs` JSONB. |
| `undo_entries`        | bigserial              | LIFO via id ordering. Max 50 per instance (trimmed). `slot_id` varchar(50).                                 |
| `program_definitions` | uuid                   | User-owned. Status enum. `definition` JSONB.                                                                |
| `program_templates`   | varchar(50)            | Catalog. `definition` JSONB. `is_active` boolean.                                                           |
| `exercises`           | varchar(100)           | `is_preset`, `created_by` FK (set null on user delete).                                                     |
| `muscle_groups`       | varchar(50)            | Reference data.                                                                                             |

**Enums:**

- `instance_status`: `active`, `completed`, `archived`
- `result_type`: `success`, `fail`
- `program_definition_status`: `draft`, `pending_review`, `approved`, `rejected`

**Key DB behaviors:**

- Upsert for workout results: `INSERT ... ON CONFLICT (instance_id, workout_index, slot_id) DO UPDATE`
- Auto-complete active instances when creating a new one (UPDATE WHERE status='active')
- `completed_at` synced on all rows for a workout index when all slots filled
- Undo stack trimmed to 50 entries per instance (deletes entries with `id <= overflow_id`)
- Metadata merge: `COALESCE(metadata, '{}') || $1::jsonb` (shallow merge at DB level)

---

### 14. Middleware Execution Order

In the Elysia request lifecycle:

1. `cors` plugin (before all handlers)
2. `swaggerPlugin` (dev only)
3. `metricsPlugin` — `onRequest` records start time; `onAfterHandle` records histogram/counter
4. `onAfterHandle` for security headers (runs after route handler)
5. `requestLogger` — `derive` runs synchronously per request (before handler); `onAfterHandle` logs completion
6. `onError` global handler
7. Route handler

Route-level order per protected route:

1. `requestLogger` (provides `reqId`, `reqLogger`, `ip`, `startMs`)
2. `jwtPlugin` (provides `jwt.sign()` / `jwt.verify()`)
3. `resolveUserId` (extracts userId or throws 401)
4. `rateLimit()` called at start of handler

---

### 15. Environment Variables

| Variable             | Required   | Default                 | Purpose                                                               |
| -------------------- | ---------- | ----------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`       | Yes        | —                       | PostgreSQL connection URL                                             |
| `JWT_SECRET`         | Yes (prod) | `dev-secret-change-me`  | HS256 JWT signing secret (64+ chars in prod)                          |
| `GOOGLE_CLIENT_ID`   | Yes        | —                       | Google OAuth client ID for token verification                         |
| `CORS_ORIGIN`        | Yes (prod) | `http://localhost:3000` | Comma-separated allowed origins                                       |
| `PORT`               | No         | `3001`                  | HTTP listen port                                                      |
| `NODE_ENV`           | No         | —                       | `production` enables strict checks, HSTS, disables dev endpoints      |
| `LOG_LEVEL`          | No         | `info`                  | Pino log level                                                        |
| `REDIS_URL`          | No         | —                       | ioredis connection URL; enables distributed rate limiting and caching |
| `METRICS_TOKEN`      | No         | —                       | Bearer token to protect GET /metrics                                  |
| `TRUSTED_PROXY`      | No         | —                       | `"true"` to trust X-Forwarded-For for real client IP                  |
| `ADMIN_USER_IDS`     | No         | —                       | Comma-separated UUIDs of admin users                                  |
| `SENTRY_DSN`         | No         | —                       | Sentry error tracking DSN                                             |
| `TELEGRAM_BOT_TOKEN` | No         | —                       | Telegram bot token for new-user notifications                         |
| `TELEGRAM_CHAT_ID`   | No         | —                       | Telegram chat/channel ID for notifications                            |
| `JWT_ACCESS_EXPIRY`  | No         | `15m`                   | JWT access token expiry (ElysiaJS `@elysiajs/jwt` format)             |
| `DB_POOL_SIZE`       | No         | `50`                    | PostgreSQL connection pool max size                                   |
| `DB_SSL`             | No         | —                       | `"false"` to disable SSL; production default is `"require"`           |

---

### 16. Token Cleanup Job

Runs at startup and every 6 hours:

- `DELETE FROM refresh_tokens WHERE expires_at < now()`

---

### 17. Request/Response Headers

**Request headers consumed by the API:**

| Header            | Usage                                                       |
| ----------------- | ----------------------------------------------------------- |
| `Authorization`   | Bearer token for protected routes                           |
| `Cookie`          | `refresh_token` for auth/refresh and auth/signout           |
| `x-request-id`    | If valid (`/^[\w-]{8,64}$/`), propagated as response header |
| `x-forwarded-for` | Client IP when `TRUSTED_PROXY=true`                         |
| `user-agent`      | Device classification for new-user Telegram notification    |
| `content-type`    | Validated for JSON body parsing                             |

**Response headers added by the API:**

| Header                                                           | When                                      |
| ---------------------------------------------------------------- | ----------------------------------------- |
| `x-request-id`                                                   | Always (request ID echo)                  |
| `x-content-type-options: nosniff`                                | Always                                    |
| `x-frame-options: DENY`                                          | Always                                    |
| `referrer-policy: strict-origin-when-cross-origin`               | Always                                    |
| `content-security-policy: ...`                                   | Always                                    |
| `strict-transport-security: max-age=31536000; includeSubDomains` | Production only                           |
| `permissions-policy: ...`                                        | Always                                    |
| `Cache-Control: public, max-age=300, stale-while-revalidate=60`  | GET /api/catalog                          |
| `Cache-Control: public, max-age=300`                             | GET /api/catalog/:id                      |
| `Cache-Control: public, max-age=300`                             | GET /api/exercises (unauthenticated only) |
| `Cache-Control: public, max-age=600`                             | GET /api/muscle-groups                    |
| `Retry-After: <seconds>`                                         | 429 responses                             |
| `content-type: text/plain; charset=utf-8`                        | GET /.well-known/security.txt             |

---

### 18. Presence Tracking

- Triggered on every authenticated request (via `resolveUserId`).
- Fire-and-forget: errors are logged but don't affect the response.
- Redis sorted set `users:online`, score = `Date.now()` (milliseconds).
- Each update: ZADD (upsert score) + ZREMRANGEBYSCORE (prune stale entries older than 60 seconds) in a MULTI/EXEC pipeline.
- `GET /api/stats/online` counts members with score > `now - 60000` after pruning.

---

### 19. Singleflight Pattern

Used in `GET /api/programs/:id` and catalog operations to prevent thundering herd on cache misses:

- Concurrent requests for the same key share one DB fetch.
- After cache miss confirmed, only one goroutine executes; others wait.
- Result is cached after the single fetch completes.

---

## Risks & Considerations

1. **JWT library differences.** The TS implementation uses `@elysiajs/jwt` (HS256 by default). The Go replacement must use the same algorithm (HS256), same secret, and produce compatible tokens. Access tokens issued by TS must be verifiable by Go during migration.

2. **Cursor format is non-standard.** The cursor `<ISO>_<UUID>` is parsed by `lastIndexOf('_')` — not a simple base64/opaque cursor. Go must replicate this exact format and parsing. If a UUID appears in the timestamp part (it can't — ISO 8601 doesn't contain `_`), parsing would break. This is safe in practice but the exact format must be reproduced.

3. **Null vs omitted fields.** The result/undo serialization uses spread conditionals (`...(val !== null ? { key: val } : {})`) to omit fields rather than null them. Go JSON marshaling defaults to `null` for zero values or `omitempty` for the zero value of the type. The Go implementation must use custom marshaling to reproduce the omit-not-null semantics.

4. **Date serialization.** Go's `time.Time.MarshalJSON()` produces `"2006-01-02T15:04:05.000Z"` format (RFC 3339 with milliseconds). Verify this matches `new Date().toISOString()` output (they should be equivalent, but test edge cases around millisecond precision and timezone representation).

5. **JSONB fields returned as-is.** `config`, `metadata`, `definition`, `customDefinition`, `setLogs` are stored as PostgreSQL JSONB and returned without any transformation. The Go driver must scan these as raw JSON and pass them through without re-encoding (to avoid field ordering changes, etc.).

6. **Cookie `path: /api/auth`.** The refresh token cookie is scoped to `/api/auth`. This means the browser only sends it on requests to paths under `/api/auth/`. The Go server must set the same `Path` attribute. Any endpoint not under `/api/auth/` will not receive the cookie from the browser.

7. **Rate limiter key semantics.** Different endpoints key on different identities (ip, userId, userId:ip). The exact key must match the TS implementation for continuity when the data store is shared (Redis). Key format: `rl:<endpoint-string>:<identity>`.

8. **Presence fire-and-forget.** In Go, this means spawning a goroutine. Errors must be logged but must not block the response.

9. **Avatar base64 validation.** The TS validates that `Buffer.from(b64, 'base64').toString('base64') === b64` (roundtrip). This rejects non-canonical base64 (e.g., with line breaks or incorrect padding). Go's `base64.StdEncoding.DecodeString` + re-encode must match this behavior.

10. **`amrapReps` max 99 (not 100).** The body schema allows `>= 0` but the service layer enforces `<= 99`. Both checks must be in place.

11. **Undo stack max 50.** Enforced by trimming: deletes all entries with `id <= (the id of the entry at position 50 from the top)`. The exact SQL is: select the entry at `OFFSET 50 LIMIT 1` ordered by `id DESC`, then `DELETE WHERE id <= that_id`. Go must replicate this trim logic.

12. **`findOrCreateGoogleUser` TOCTOU avoidance.** The upsert uses `INSERT ... ON CONFLICT (google_id) DO UPDATE SET name, email, updated_at`. The `isNewUser` detection uses `|createdAt - updatedAt| < 2000ms`. Go must replicate this heuristic.

13. **Soft-delete semantics.** `findUserById` and `findUserByEmail` filter `WHERE deleted_at IS NULL`. Soft-deleted users cannot authenticate even with valid short-lived JWTs (they hit `findUserById` in `/auth/me`). However, access tokens issued before deletion will continue to work for up to 15 minutes on endpoints that don't call `findUserById` (e.g., most program/result endpoints only verify the JWT signature, not the user's soft-delete status).

14. **Token cleanup every 6h.** Go must replicate this background job to prevent unbounded growth of the `refresh_tokens` table.

15. **`maxRequestBodySize: 1_048_576` (1 MB).** The Go HTTP server must enforce this limit (returns 413 or similar if exceeded).

---

## Key Patterns to Preserve

1. **All API routes under `/api` prefix.** Health and metrics at root.

2. **Error shape is always `{ "error": "<string>", "code": "<string>" }`** — never a different structure.

3. **Refresh cookie attributes exactly:** `httpOnly=true`, `secure=<env>`, `sameSite=strict`, `maxAge=604800`, `path=/api/auth`.

4. **Result/undo fields use omit-not-null pattern** (not `null` values) for optional numeric and array fields.

5. **Cursor format:** `<ISO>_<UUID>`, parsed at `lastIndexOf('_')`.

6. **Cache invalidation on every write.** Any mutation to a program instance must invalidate its Redis cache key.

7. **Rate limiter is fail-open.** If Redis is unavailable, all requests are allowed through.

8. **Program cache is fail-open.** If Redis errors, falls back to DB.

9. **`x-request-id` echoed on every response.** Generated if not provided or if format invalid.

10. **Security headers on every response**, including CSP — exact string must match (affects browser behavior for hosted SPA).

11. **`Content-Type` on metrics endpoint** is set from `registry.contentType` (prom-client format string), not hardcoded.

12. **Swagger disabled in production.** `/swagger` and `/swagger/json` routes should not exist in production.

13. **CORS `credentials: true`** — required for browser to send cookies on cross-origin requests.

14. **`DELETE /api/programs/:id/results/:workoutIndex/:slotId` has NO rate limiting** — the handler does not call `rateLimit()`. All other write endpoints do.
