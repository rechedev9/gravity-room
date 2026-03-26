---
summary: Complete HTTP contract of the TypeScript/ElysiaJS API — the single oracle for the Go API migration. Every endpoint, header, error code, cache key, and behavioral detail required to reproduce the TS API identically.
read_when: Implementing any Go API endpoint, validating migration parity, or reviewing behavioral differences between the TS and Go implementations.
---

# HTTP Contract — Gravity Room API

**Change ID:** go-api-migration-contract
**Pinned SHA:** `bef5a51`
**Source branch:** `go-api`
**Capture date:** 2026-03-26

> The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

---

## 1. Server Configuration

### Listen

The server MUST listen on the port specified by the `PORT` environment variable. The default MUST be `3001` when `PORT` is not set (`bootstrap.ts:43`).

The maximum request body size MUST be `1 048 576` bytes (1 MB). This is passed as `maxRequestBodySize: 1_048_576` to the ElysiaJS `.listen()` call (`bootstrap.ts:156`).

### Startup Sequence

The server MUST execute the following steps in order before accepting traffic:

1. Initialize Sentry (import side-effect)
2. Run database migrations (DDL, serial, single-connection client)
3. Run reference data seeds (idempotent)
4. Create the Elysia app via `createApp()` factory
5. Call `.listen()` on the configured port
6. Start the token cleanup job (immediately, then every 6 hours)

(`bootstrap.ts:1-225`)

### Graceful Shutdown

The server MUST handle `SIGTERM` and `SIGINT` signals (`bootstrap.ts:209-210`). On receipt:

1. Set an idempotency guard to prevent double-shutdown
2. Start a fallback timer of `10 000` ms; if shutdown has not completed, force `process.exit(0)` (`bootstrap.ts:168`)
3. Stop the Elysia HTTP server (`app.stop()`)
4. Disconnect Redis (if connected)
5. Close the database connection pool
6. Log `"shutdown complete"` and exit

The fallback timer MUST be `.unref()`-ed so it does not keep the process alive on its own (`bootstrap.ts:182`).

### Middleware Execution Order

**Global middleware** (applied by `createApp`, in registration order):

1. CORS plugin (`cors()`)
2. Swagger plugin (dev-only)
3. Metrics plugin (`onRequest` records start time; `onAfterHandle` records histogram/counter; `onError` records error counter)
4. Security headers (`onAfterHandle` — sets 5-6 headers on every response)
5. Request logger (`derive` as global — provides `reqId`, `reqLogger`, `ip`, `startMs`; `onAfterHandle` as global — sets `x-request-id` response header and logs completion)
6. Global error handler (`onError`)

**Route-level middleware** (per protected route):

1. `requestLogger` (already derived globally, but used for route-group scoping)
2. `jwtPlugin` (adds `jwt.sign()` / `jwt.verify()` to context)
3. `resolveUserId` (extracts `userId` from Bearer token or throws 401)
4. `rateLimit()` called at start of handler body

(`create-app.ts:40-109`)

---

## 2. CORS Configuration

The Go API MUST reproduce the following CORS behavior:

- `Access-Control-Allow-Credentials` MUST be `true` on all responses (`create-app.ts:44`)
- Allowed origins MUST be read from the `CORS_ORIGIN` environment variable, parsed as a comma-separated list of URLs (`bootstrap.ts:20-39`)
- When `CORS_ORIGIN` is not set and `NODE_ENV !== 'production'`, the default origin MUST be `http://localhost:3000` (`bootstrap.ts:25`)
- When `CORS_ORIGIN` is not set and `NODE_ENV === 'production'`, startup MUST throw an error (`bootstrap.ts:22-24`)
- Each origin in `CORS_ORIGIN` MUST be validated as a parseable URL; invalid URLs MUST cause a startup error (`bootstrap.ts:33-36`)
- If only one origin is provided, it MUST be passed as a string (not an array) (`bootstrap.ts:39`)
- The ElysiaJS CORS plugin does NOT explicitly set `allowedHeaders` or `methods` — it mirrors the request's `Access-Control-Request-Headers` header. The Go implementation SHOULD mirror this behavior

---

## 3. Security Headers

The following headers MUST be set on every response via the `onAfterHandle` hook (`create-app.ts:49-57`):

| Header                      | Value                                                                      | Condition                                             |
| --------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| `x-content-type-options`    | `nosniff`                                                                  | Always                                                |
| `x-frame-options`           | `DENY`                                                                     | Always                                                |
| `referrer-policy`           | `strict-origin-when-cross-origin`                                          | Always                                                |
| `content-security-policy`   | See below                                                                  | Always                                                |
| `strict-transport-security` | `max-age=31536000; includeSubDomains`                                      | `NODE_ENV === 'production'` only (`create-app.ts:54`) |
| `permissions-policy`        | `camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()` | Always (`bootstrap.ts:51-52`)                         |

### CSP Value (verbatim)

The `content-security-policy` header value MUST be exactly (`bootstrap.ts:48-49`):

```
default-src 'self'; script-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; img-src 'self' data: blob: https://lh3.googleusercontent.com; connect-src 'self' https://accounts.google.com https://www.googleapis.com https://*.ingest.sentry.io; font-src 'self' https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; frame-src https://accounts.google.com; frame-ancestors 'none'
```

---

## 4. Request Logger & Request ID

### Request ID

Every request MUST be assigned a `reqId` (`request-logger.ts:21-22`):

- If the incoming `x-request-id` header matches the regex `/^[\w-]{8,64}$/`, use its value
- Otherwise, generate a new UUID via `randomUUID()`

The `reqId` MUST be echoed back as the `x-request-id` response header (`request-logger.ts:36`).

### IP Extraction

The client IP MUST be determined as follows (`request-logger.ts:25-27`):

- When `TRUSTED_PROXY` env var is set (truthy): use `x-forwarded-for` header value, taking only the first comma-separated segment, trimmed
- When `TRUSTED_PROXY` is not set: use the direct socket address
- Fallback: `'unknown'`

### Pino Logger

Each request MUST create a Pino child logger with fields `{ reqId, method, url, ip }` (`request-logger.ts:29`).

On request start: log `"incoming request"` at `info` level.
On response: log `{ status, latencyMs }` with message `"request completed"` at `info` level (`request-logger.ts:37`).

### Redaction

Pino MUST redact the following paths with censor value `[Redacted]` (`logger.ts:10-16`):

- `req.headers.authorization`
- `req.headers.cookie`
- `*.headers.authorization`
- `*.headers.cookie`

---

## 5. Error Response Format

All error responses MUST use the following JSON shape (`create-app.ts:74`):

```json
{ "error": "<human-readable message>", "code": "<machine-readable code>" }
```

### Status Code Mapping

| Condition                                | HTTP Status        | `code` field       | Source                |
| ---------------------------------------- | ------------------ | ------------------ | --------------------- |
| `ApiError` instance                      | `error.statusCode` | `error.code`       | `create-app.ts:64-74` |
| Route not found (Elysia `NOT_FOUND`)     | 404                | `NOT_FOUND`        | `create-app.ts:77-81` |
| Elysia validation failure (`VALIDATION`) | 400                | `VALIDATION_ERROR` | `create-app.ts:83-87` |
| Elysia parse failure (`PARSE`)           | 400                | `PARSE_ERROR`      | `create-app.ts:89-93` |
| Any unhandled exception                  | 500                | `INTERNAL_ERROR`   | `create-app.ts:95-98` |

When an `ApiError` has the `headers` property set, those headers MUST be copied to the response (`create-app.ts:66-69`). This is used by the rate limiter to set `Retry-After`.

Errors with `statusCode >= 500` MUST be logged at `error` level and reported to Sentry. Errors with `statusCode < 500` MUST be logged at `warn` level (`create-app.ts:71-73`).

### Error Code Inventory

| Code                     | HTTP Status | Description                                                                                        | Source                                |
| ------------------------ | ----------- | -------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `UNAUTHORIZED`           | 401         | Missing or invalid authorization header                                                            | `auth-guard.ts:48`                    |
| `AUTH_INVALID`           | 401         | Invalid Google JWT format, header, algorithm, key, signature, payload, issuer, audience, or expiry | `google-auth.ts`                      |
| `AUTH_JWKS_UNAVAILABLE`  | 503         | Google JWKS endpoint unavailable or invalid response                                               | `google-auth.ts:97,101`               |
| `AUTH_GOOGLE_INVALID`    | 401         | Google token verification failed                                                                   | `routes/auth.ts:112`                  |
| `AUTH_NO_REFRESH_TOKEN`  | 401         | No refresh token cookie present                                                                    | `routes/auth.ts:191`                  |
| `AUTH_INVALID_REFRESH`   | 401         | Refresh token not found in DB (possibly reused)                                                    | `routes/auth.ts:209`                  |
| `AUTH_REFRESH_EXPIRED`   | 401         | Refresh token found but expired                                                                    | `routes/auth.ts:215`                  |
| `TOKEN_INVALID`          | 401         | JWT verification failed or invalid payload                                                         | `auth-guard.ts:74,79`                 |
| `USER_NOT_FOUND`         | 404         | User not found (or soft-deleted)                                                                   | `services/auth.ts:124`                |
| `ACCOUNT_DELETED`        | 403         | User account has been soft-deleted                                                                 | `services/auth.ts:97-100`             |
| `DB_WRITE_ERROR`         | 500         | Database write operation failed                                                                    | `services/auth.ts:93`                 |
| `CONFIGURATION_ERROR`    | 500         | Missing required env var (e.g. GOOGLE_CLIENT_ID)                                                   | `google-auth.ts:115`                  |
| `NOT_FOUND`              | 404         | Generic resource not found                                                                         | `error-handler.ts:16`                 |
| `FORBIDDEN`              | 403         | Access denied / invalid status transition                                                          | `error-handler.ts:17`                 |
| `VALIDATION_ERROR`       | 400/422     | Request validation failed                                                                          | `error-handler.ts:19`                 |
| `PARSE_ERROR`            | 400         | Invalid request body (unparseable JSON)                                                            | `error-handler.ts:20`                 |
| `INTERNAL_ERROR`         | 500         | Unhandled server error                                                                             | `error-handler.ts:32`                 |
| `RATE_LIMITED`           | 429         | Rate limit exceeded                                                                                | `rate-limit.ts:97`                    |
| `GATEWAY_TIMEOUT`        | —           | Timeout (defined but usage is implicit)                                                            | `error-handler.ts:35`                 |
| `LIMIT_EXCEEDED`         | 409         | Definition limit reached (max 10 per user)                                                         | `services/program-definitions.ts:149` |
| `INVALID_TRANSITION`     | 403         | Invalid status transition                                                                          | `error-handler.ts:23`                 |
| `ACTIVE_INSTANCES_EXIST` | 409         | Cannot delete definition with active instances                                                     | `routes/program-definitions.ts:210`   |
| `HYDRATION_FAILED`       | 500         | Program definition hydration failed                                                                | `routes/catalog.ts:112`               |
| `METADATA_TOO_LARGE`     | 400         | Metadata exceeds 10KB limit                                                                        | `services/programs.ts:410`            |
| `INVALID_AVATAR`         | 400         | Avatar is not a valid base64 data URL                                                              | `routes/auth.ts:338`                  |
| `AVATAR_TOO_LARGE`       | 400         | Avatar exceeds 200KB limit                                                                         | `routes/auth.ts:343`                  |
| `AMBIGUOUS_SOURCE`       | 422         | Both programId and definitionId provided                                                           | `routes/programs.ts:77`               |
| `MISSING_PROGRAM_SOURCE` | 422         | Neither programId nor definitionId provided                                                        | `routes/programs.ts:82`               |
| `INVALID_PROGRAM`        | 400         | Unknown programId (not in catalog)                                                                 | `services/programs.ts:220`            |
| `INVALID_CURSOR`         | 400         | Malformed cursor string                                                                            | `services/programs.ts:286`            |
| `INSTANCE_NOT_FOUND`     | 404         | Program instance not found or not owned                                                            | `services/programs.ts:352`            |
| `RESULT_NOT_FOUND`       | 404         | Workout result not found                                                                           | `services/results.ts:268`             |
| `PROGRAM_NOT_FOUND`      | 404         | Catalog program not found                                                                          | `routes/catalog.ts:109`               |
| `INVALID_DATA`           | 400         | Invalid import data (bad index, slot, or amrapReps)                                                | `services/programs.ts:613-620`        |
| `INVALID_SLUG`           | 422         | Exercise name produces empty slug                                                                  | `routes/exercises.ts:196`             |
| `DUPLICATE`              | 409         | Exercise ID already exists                                                                         | `routes/exercises.ts:211`             |
| `CREATE_FAILED`          | 500         | Program instance creation failed                                                                   | `services/programs.ts:243`            |
| `IMPORT_FAILED`          | 500         | Import instance creation failed                                                                    | `services/programs.ts:638`            |
| `DEFINITION_INVALID`     | 422         | Custom definition failed validation                                                                | `routes/programs.ts:91`               |
| `INSERT_FAILED`          | 500         | Result record insertion failed                                                                     | `services/results.ts:212`             |

---

## 6. Rate Limiting

### Algorithm

The rate limiter uses a **sliding-window** algorithm (`rate-limit.ts`). Two backends:

1. **Redis sorted-set** (when `REDIS_URL` is set): Lua script runs atomically on Redis (`redis-rate-limit.ts:15-32`):
   - `ZREMRANGEBYSCORE key -inf (now - windowMs)` — prune expired entries
   - `ZCARD key` — count remaining entries
   - If `count >= maxRequests`: return 0 (denied)
   - `ZADD key now <now>:<random>` — add entry with unique member
   - `PEXPIRE key windowMs` — set key expiry
   - Return 1 (allowed)

2. **In-memory `Map<string, number[]>`** (fallback when no Redis): timestamps filtered by cutoff, new timestamp pushed (`rate-limit.ts:32-51`)

### Fail-Open Rule

The rate limiter MUST fail open: if Redis is unavailable, the `check()` method MUST return `true` (allowed) (`redis-rate-limit.ts:37`).

### Key Format

Rate limit keys MUST follow the pattern `rl:<endpoint>:<identity>` (`rate-limit.ts:94`).

### Defaults

- `windowMs`: `60 000` ms (1 minute) (`rate-limit.ts:83`)
- `maxRequests`: `20` (`rate-limit.ts:84`)

### 429 Response

When the rate limit is exceeded, the server MUST throw an `ApiError` with:

- Status `429`
- Body `{ "error": "Too many requests", "code": "RATE_LIMITED" }`
- Header `Retry-After: <Math.ceil(windowMs / 1000)>` (`rate-limit.ts:97-99`)

### Rate Limit Table

| Method | Path                                            | Window (ms) | Max                   | Key Identity                       | Source                              |
| ------ | ----------------------------------------------- | ----------- | --------------------- | ---------------------------------- | ----------------------------------- |
| POST   | /api/auth/google                                | 60 000      | 10                    | `ip`                               | `routes/auth.ts:105`                |
| POST   | /api/auth/dev                                   | —           | —                     | No rate limiting                   | `routes/auth.ts:155`                |
| POST   | /api/auth/refresh                               | 60 000      | 20 (prod) / 500 (dev) | `ip`                               | `routes/auth.ts:185`                |
| POST   | /api/auth/signout                               | 60 000      | 20                    | `ip`                               | `routes/auth.ts:253`                |
| GET    | /api/auth/me                                    | 60 000      | 100                   | `userId` (from JWT sub)            | `routes/auth.ts:301`                |
| PATCH  | /api/auth/me                                    | 60 000      | 20                    | `ip`                               | `routes/auth.ts:332`                |
| DELETE | /api/auth/me                                    | 60 000      | 5                     | `ip`                               | `routes/auth.ts:394`                |
| GET    | /api/programs                                   | 60 000      | 100                   | `userId`                           | `routes/programs.ts:41`             |
| POST   | /api/programs                                   | 60 000      | 20                    | `userId`                           | `routes/programs.ts:68`             |
| GET    | /api/programs/:id                               | 60 000      | 100                   | `userId`                           | `routes/programs.ts:141`            |
| PATCH  | /api/programs/:id                               | 60 000      | 20                    | `userId`                           | `routes/programs.ts:179`            |
| PATCH  | /api/programs/:id/metadata                      | 60 000      | 20                    | `userId`                           | `routes/programs.ts:222`            |
| DELETE | /api/programs/:id                               | 60 000      | 20                    | `userId`                           | `routes/programs.ts:259`            |
| GET    | /api/programs/:id/export                        | 60 000      | 20                    | `userId`                           | `routes/programs.ts:286`            |
| POST   | /api/programs/import                            | 60 000      | 20                    | `userId`                           | `routes/programs.ts:311`            |
| POST   | /api/programs/:id/results                       | 60 000      | 60                    | `userId`                           | `routes/results.ts:33`              |
| DELETE | /api/programs/:id/results/:workoutIndex/:slotId | —           | —                     | **No rate limiting**               | `routes/results.ts:83-98`           |
| POST   | /api/programs/:id/undo                          | 60 000      | 20                    | `userId`                           | `routes/results.ts:129`             |
| GET    | /api/catalog                                    | 60 000      | 100                   | `x-forwarded-for ?? 'anonymous'`   | `routes/catalog.ts:82`              |
| GET    | /api/catalog/:programId                         | 60 000      | 100                   | `x-forwarded-for ?? 'anonymous'`   | `routes/catalog.ts:105`             |
| POST   | /api/catalog/preview                            | 3 600 000   | 30                    | `userId`                           | `routes/catalog.ts:38`              |
| GET    | /api/exercises                                  | 60 000      | 100                   | `userId:ip` (auth'd) / `ip` (anon) | `routes/exercises.ts:97-99`         |
| GET    | /api/muscle-groups                              | 60 000      | 100                   | `x-forwarded-for ?? 'anonymous'`   | `routes/exercises.ts:154`           |
| POST   | /api/exercises                                  | 60 000      | 20                    | `userId`                           | `routes/exercises.ts:185`           |
| GET    | /api/program-definitions                        | 60 000      | 100                   | `userId`                           | `routes/program-definitions.ts:67`  |
| POST   | /api/program-definitions                        | 3 600 000   | 5                     | `userId`                           | `routes/program-definitions.ts:34`  |
| POST   | /api/program-definitions/fork                   | 3 600 000   | 10                    | `userId`                           | `routes/program-definitions.ts:97`  |
| GET    | /api/program-definitions/:id                    | 60 000      | 100                   | `userId`                           | `routes/program-definitions.ts:144` |
| PUT    | /api/program-definitions/:id                    | 3 600 000   | 20                    | `userId`                           | `routes/program-definitions.ts:171` |
| DELETE | /api/program-definitions/:id                    | 3 600 000   | 20                    | `userId`                           | `routes/program-definitions.ts:203` |
| PATCH  | /api/program-definitions/:id/status             | 3 600 000   | 20                    | `userId`                           | `routes/program-definitions.ts:245` |
| GET    | /api/stats/online                               | —           | —                     | No rate limiting                   | `routes/stats.ts:5-25`              |
| GET    | /health                                         | —           | —                     | No rate limiting                   | `create-app.ts:110-165`             |
| GET    | /metrics                                        | —           | —                     | No rate limiting                   | `create-app.ts:166-176`             |

---

## 7. Auth Contract

### JWT (Access Token)

- **Algorithm:** HS256 (ElysiaJS `@elysiajs/jwt` default) (`auth-guard.ts:39-43`)
- **Secret:** `JWT_SECRET` env var (`auth-guard.ts:21`)
  - Production: MUST be set, MUST NOT be `dev-secret-change-me`, MUST be at least 64 characters (`auth-guard.ts:28-34`)
  - Dev default: `dev-secret-change-me` (`auth-guard.ts:19`)
- **Payload claims:**

| Claim   | Type            | Present When                                                              |
| ------- | --------------- | ------------------------------------------------------------------------- |
| `sub`   | UUID string     | Always — the user's ID                                                    |
| `email` | string          | Only on sign-in tokens (Google/dev), not on refresh-issued tokens         |
| `exp`   | duration string | Always — `JWT_ACCESS_EXPIRY` env var, default `15m` (`routes/auth.ts:29`) |

- **Transmission:** `Authorization: Bearer <token>` request header. The `Bearer ` prefix (with trailing space) MUST be checked (`auth-guard.ts:46-56`)
- **Verification:** `jwt.verify(token)` returns `false` on invalid/expired. The `sub` claim MUST be a string (`auth-guard.ts:77-80`)
- **Cross-server interop:** The Go API MUST be able to verify JWTs signed by the TS API and vice versa during migration. Both MUST use the same `JWT_SECRET` and HS256 algorithm

### Refresh Token (Cookie)

- **Token format:** UUID v4 (`crypto.randomUUID()`) (`services/auth.ts:35`)
- **Storage:** SHA-256 hex-encoded hash stored in `refresh_tokens.token_hash` (`services/auth.ts:39-43`)
- **Cookie name:** `refresh_token` (`routes/auth.ts:46`)
- **Cookie attributes** (`routes/auth.ts:55-61`):

| Attribute  | Value                                         | Source              |
| ---------- | --------------------------------------------- | ------------------- |
| `httpOnly` | `true`                                        | `routes/auth.ts:56` |
| `secure`   | `true` in production, `false` in dev          | `routes/auth.ts:57` |
| `sameSite` | `strict`                                      | `routes/auth.ts:58` |
| `maxAge`   | `604800` (7 _ 24 _ 60 \* 60 seconds = 7 days) | `routes/auth.ts:59` |
| `path`     | `/api/auth`                                   | `routes/auth.ts:60` |

- **Expiry:** 7 days (`REFRESH_TOKEN_DAYS = 7`, `services/auth.ts:27`)

### Token Rotation Flow

1. Client sends `POST /api/auth/refresh` with `refresh_token` cookie
2. Server reads cookie value, computes SHA-256 hash
3. Looks up hash in `refresh_tokens` table
4. If not found, checks `previous_token_hash` for a successor (theft detection)
5. If found and not expired: revoke old token (DELETE from DB)
6. Create new refresh token with `previousTokenHash` set to the old hash
7. Sign new access token (JWT)
8. Set new `refresh_token` cookie
9. Return `{ "accessToken": "<jwt>" }`

(`routes/auth.ts:180-244`)

### Theft Detection

When a refresh token is presented but not found in `refresh_tokens`:

1. Query `refresh_tokens` WHERE `previous_token_hash = <presented-hash>` (`services/auth.ts:161-169`)
2. If a successor exists, this means the presented token was already rotated — possible theft
3. Revoke ALL refresh tokens for the affected `userId` (`services/auth.ts:185-187`)
4. Throw `AUTH_INVALID_REFRESH`

(`routes/auth.ts:198-209`)

### Google OAuth Flow

1. Client obtains Google ID token from Google Identity Services
2. `POST /api/auth/google` with `{ "credential": "<google-id-token>" }`
3. Server verifies RS256 signature against Google JWKS
   - JWKS URL: `https://www.googleapis.com/oauth2/v3/certs` (`google-auth.ts:8`)
   - Cache TTL: 1 hour (`60 * 60 * 1000` ms) (`google-auth.ts:10`)
   - JWKS fetch timeout: 5 000 ms (`google-auth.ts:96`)
4. Validates standard claims:
   - Issuer MUST be `accounts.google.com` or `https://accounts.google.com` (`google-auth.ts:9`)
   - Audience MUST match `GOOGLE_CLIENT_ID` env var (`google-auth.ts:168`)
   - Token MUST NOT be expired (`google-auth.ts:160`)
5. Upserts user: `INSERT INTO users ... ON CONFLICT (google_id) DO UPDATE SET name, email, updated_at` (`services/auth.ts:80-91`)
6. If user has `deleted_at` set, throws `ACCOUNT_DELETED` (403) (`services/auth.ts:95-101`)
7. New-user detection heuristic: `|createdAt - updatedAt| < 2000ms` (`services/auth.ts:103`)
8. Issues access token + refresh token cookie
9. On new users: fires Telegram notification (fire-and-forget, does NOT block response) (`routes/auth.ts:122-128`)

### Signout Behavior

`POST /api/auth/signout` (`routes/auth.ts:250-277`):

- Reads `refresh_token` cookie; if present, computes hash and deletes from DB
- Clears the cookie via `.remove()`
- If no cookie present: no-op (no error thrown, still returns 204)
- Response: 204 with empty body

### Account Deletion Auth Effects

`DELETE /api/auth/me` (`routes/auth.ts:391-418`):

- Sets `users.deleted_at = now()` (soft-delete)
- Revokes ALL refresh tokens for the user (`services/auth.ts:140`)
- Clears the `refresh_token` cookie
- Response: 204 with empty body
- Data purged after 30 days by external `purge-deleted-users.ts` script

### Auth Guard Soft-Delete Filter

`findUserById()` (`services/auth.ts:50-55`) filters `WHERE deleted_at IS NULL`. This means:

- `GET /api/auth/me` returns 404 for soft-deleted users
- Short-lived access tokens (15 min) naturally expire within the deletion window
- The `resolveUserId` guard does NOT check `deleted_at` — it only verifies the JWT. Endpoints that need user existence MUST call `findUserById()` explicitly

### Avatar Validation

`PATCH /api/auth/me` validates `avatarUrl` when provided (`routes/auth.ts:334-358`):

- MUST match regex: `/^data:image\/(jpeg|png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/` (`routes/auth.ts:52-53`)
- MUST NOT exceed `200 000` bytes (`routes/auth.ts:51`)
- Base64 roundtrip MUST be validated: decode then re-encode and compare (`routes/auth.ts:351-353`)
- Send `avatarUrl: null` to remove the avatar

---

## 8. Endpoint Reference

All API routes live under the `/api` prefix. System routes (`/health`, `/metrics`) and SPA routes have no prefix.

### Auth Routes

#### `POST /api/auth/google`

**Auth:** none
**Rate limit:** 60 000 ms / 10 max / key: `ip`

**Path parameters:** none

**Query parameters:** none

**Request body:**

```json
{
  "credential": "string, required, minLength 1"
}
```

**Responses:**

| Status | Body                                                                                                                                   | Condition                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 200    | `{ "user": { "id": "<uuid>", "email": "<string>", "name": "<string\|null>", "avatarUrl": "<string\|null>" }, "accessToken": "<jwt>" }` | Success                      |
| 400    | `{ "error": "...", "code": "VALIDATION_ERROR" }`                                                                                       | Missing/invalid body         |
| 401    | `{ "error": "...", "code": "AUTH_GOOGLE_INVALID" }`                                                                                    | Invalid Google credential    |
| 403    | `{ "error": "...", "code": "ACCOUNT_DELETED" }`                                                                                        | User account is soft-deleted |
| 429    | `{ "error": "Too many requests", "code": "RATE_LIMITED" }`                                                                             | Rate limit exceeded          |
| 500    | `{ "error": "...", "code": "DB_WRITE_ERROR" }`                                                                                         | Database upsert failed       |
| 503    | `{ "error": "...", "code": "AUTH_JWKS_UNAVAILABLE" }`                                                                                  | Google JWKS unreachable      |

**Error codes:** `AUTH_GOOGLE_INVALID`, `ACCOUNT_DELETED`, `DB_WRITE_ERROR`, `AUTH_JWKS_UNAVAILABLE`, `AUTH_INVALID`, `CONFIGURATION_ERROR`, `RATE_LIMITED`

**Side effects:**

- Sets `refresh_token` cookie (see [Auth Contract](#7-auth-contract))
- On new users: fires Telegram notification (fire-and-forget)
- Upserts user row (ON CONFLICT on `google_id`)

**Pagination:** none

**Caching:** none

---

#### `POST /api/auth/dev`

**Auth:** none
**Rate limit:** none
**Dev-only:** yes, condition: `NODE_ENV !== 'production'`. In production, returns 404 with `{ "error": "Not found", "code": "NOT_FOUND" }` (`routes/auth.ts:156-158`)

**Path parameters:** none

**Query parameters:** none

**Request body:**

```json
{
  "email": "string, required, format: email"
}
```

**Responses:**

| Status | Body                                                                                                   | Condition            |
| ------ | ------------------------------------------------------------------------------------------------------ | -------------------- |
| 201    | `{ "user": { "id": "...", "email": "...", "name": null, "avatarUrl": null }, "accessToken": "<jwt>" }` | Success              |
| 404    | `{ "error": "Not found", "code": "NOT_FOUND" }`                                                        | Called in production |

**Error codes:** `NOT_FOUND`

**Side effects:**

- Sets `refresh_token` cookie
- Reuses existing user by email to avoid unique constraint violations (`routes/auth.ts:161-163`)

**Pagination:** none

**Caching:** none

---

#### `POST /api/auth/refresh`

**Auth:** cookie-based (`refresh_token` cookie)
**Rate limit:** 60 000 ms / 20 max (prod) or 500 max (dev) / key: `ip` (`routes/auth.ts:185`)

**Path parameters:** none

**Query parameters:** none

**Request body:** none (cookie-based)

**Responses:**

| Status | Body                                                                   | Condition                |
| ------ | ---------------------------------------------------------------------- | ------------------------ |
| 200    | `{ "accessToken": "<jwt>" }`                                           | Success                  |
| 401    | `{ "error": "No refresh token", "code": "AUTH_NO_REFRESH_TOKEN" }`     | No cookie                |
| 401    | `{ "error": "Invalid refresh token", "code": "AUTH_INVALID_REFRESH" }` | Token not found / reused |
| 401    | `{ "error": "Refresh token expired", "code": "AUTH_REFRESH_EXPIRED" }` | Token expired            |
| 429    | `{ "error": "Too many requests", "code": "RATE_LIMITED" }`             | Rate limit exceeded      |

**Error codes:** `AUTH_NO_REFRESH_TOKEN`, `AUTH_INVALID_REFRESH`, `AUTH_REFRESH_EXPIRED`, `RATE_LIMITED`

**Side effects:**

- Rotates `refresh_token` cookie (old revoked, new issued)
- On theft detection: revokes ALL user sessions

**Pagination:** none

**Caching:** none

---

#### `POST /api/auth/signout`

**Auth:** none (reads `refresh_token` cookie)
**Rate limit:** 60 000 ms / 20 max / key: `ip`

**Path parameters:** none

**Query parameters:** none

**Request body:** none

**Responses:**

| Status | Body                                                       | Condition                         |
| ------ | ---------------------------------------------------------- | --------------------------------- |
| 204    | empty                                                      | Success (or no-op when no cookie) |
| 429    | `{ "error": "Too many requests", "code": "RATE_LIMITED" }` | Rate limit exceeded               |

**Error codes:** `RATE_LIMITED`

**Side effects:**

- Revokes refresh token from DB (if cookie present)
- Clears `refresh_token` cookie

**Pagination:** none

**Caching:** none

---

#### `GET /api/auth/me`

**Auth:** required (manual JWT extraction — does NOT use `resolveUserId` guard; implements its own Bearer token extraction inline) (`routes/auth.ts:286-298`)
**Rate limit:** 60 000 ms / 100 max / key: `userId` (sub from JWT)

**Path parameters:** none

**Query parameters:** none

**Request body:** none

**Responses:**

| Status | Body                                                                                               | Condition                      |
| ------ | -------------------------------------------------------------------------------------------------- | ------------------------------ |
| 200    | `{ "id": "<uuid>", "email": "<string>", "name": "<string\|null>", "avatarUrl": "<string\|null>" }` | Success                        |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`                                                       | Missing/invalid auth header    |
| 401    | `{ "error": "...", "code": "TOKEN_INVALID" }`                                                      | JWT verification failed        |
| 404    | `{ "error": "...", "code": "USER_NOT_FOUND" }`                                                     | User not found or soft-deleted |

**Error codes:** `UNAUTHORIZED`, `TOKEN_INVALID`, `USER_NOT_FOUND`

**Side effects:** none

**Pagination:** none

**Caching:** none

---

#### `PATCH /api/auth/me`

**Auth:** required (resolveUserId guard)
**Rate limit:** 60 000 ms / 20 max / key: `ip`

**Path parameters:** none

**Query parameters:** none

**Request body:**

```json
{
  "name": "string, optional, minLength 1, maxLength 100",
  "avatarUrl": "string | null, optional"
}
```

**Responses:**

| Status | Body                                                                                               | Condition             |
| ------ | -------------------------------------------------------------------------------------------------- | --------------------- |
| 200    | `{ "id": "<uuid>", "email": "<string>", "name": "<string\|null>", "avatarUrl": "<string\|null>" }` | Success               |
| 400    | `{ "error": "...", "code": "INVALID_AVATAR" }`                                                     | Avatar format invalid |
| 400    | `{ "error": "...", "code": "AVATAR_TOO_LARGE" }`                                                   | Avatar exceeds 200KB  |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`                                                       | Missing/invalid token |
| 404    | `{ "error": "...", "code": "USER_NOT_FOUND" }`                                                     | User not found        |

**Error codes:** `INVALID_AVATAR`, `AVATAR_TOO_LARGE`, `UNAUTHORIZED`, `TOKEN_INVALID`, `USER_NOT_FOUND`

**Side effects:**

- Updates user profile in DB

**Pagination:** none

**Caching:** none

---

#### `DELETE /api/auth/me`

**Auth:** required (resolveUserId guard)
**Rate limit:** 60 000 ms / 5 max / key: `ip`

**Path parameters:** none

**Query parameters:** none

**Request body:** none

**Responses:**

| Status | Body                                           | Condition             |
| ------ | ---------------------------------------------- | --------------------- |
| 204    | empty                                          | Success               |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`   | Missing/invalid token |
| 404    | `{ "error": "...", "code": "USER_NOT_FOUND" }` | User not found        |

**Error codes:** `UNAUTHORIZED`, `TOKEN_INVALID`, `USER_NOT_FOUND`

**Side effects:**

- Sets `users.deleted_at = now()` (soft-delete)
- Revokes ALL refresh tokens for user
- Clears `refresh_token` cookie

**Pagination:** none

**Caching:** none

---

### Program Routes

All program routes require `Authorization: Bearer <token>` via `resolveUserId`.

#### `GET /api/programs`

**Auth:** required (resolveUserId guard)
**Rate limit:** 60 000 ms / 100 max / key: `userId`

**Path parameters:** none

**Query parameters:**

- `limit` — integer, optional, range [1, 100], default 20
- `cursor` — string, optional, composite cursor token from previous response

**Request body:** none

**Responses:**

| Status | Body                                                                                                              | Condition             |
| ------ | ----------------------------------------------------------------------------------------------------------------- | --------------------- |
| 200    | `{ "data": [{ "id", "programId", "name", "status", "createdAt", "updatedAt" }], "nextCursor": "<string\|null>" }` | Success               |
| 400    | `{ "error": "Invalid cursor format", "code": "INVALID_CURSOR" }`                                                  | Bad cursor            |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`                                                                      | Missing/invalid token |

**Error codes:** `INVALID_CURSOR`, `UNAUTHORIZED`, `TOKEN_INVALID`

**Side effects:** none

**Pagination:** cursor-based (see [Cursor Pagination](#10-cursor-pagination))

**Caching:** none

---

#### `POST /api/programs`

**Auth:** required (resolveUserId guard)
**Rate limit:** 60 000 ms / 20 max / key: `userId`

**Path parameters:** none

**Query parameters:** none

**Request body:**

```json
{
  "programId": "string, optional, minLength 1",
  "definitionId": "string, optional, minLength 1",
  "name": "string, required, minLength 1, maxLength 100",
  "config": { "<key maxLength 30>": "<number 0-10000 | string maxLength 100>" }
}
```

Exactly one of `programId` or `definitionId` MUST be provided. Both = 422 `AMBIGUOUS_SOURCE`. Neither = 422 `MISSING_PROGRAM_SOURCE`.

**Responses:**

| Status | Body                                                                                    | Condition                    |
| ------ | --------------------------------------------------------------------------------------- | ---------------------------- |
| 201    | `ProgramInstanceResponse` (see [JSON Serialization Rules](#9-json-serialization-rules)) | Success                      |
| 400    | `{ "error": "...", "code": "INVALID_PROGRAM" }`                                         | Unknown programId            |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`                                            | Missing/invalid token        |
| 403    | `{ "error": "...", "code": "FORBIDDEN" }`                                               | Definition not owned by user |
| 404    | `{ "error": "...", "code": "NOT_FOUND" }`                                               | Definition not found         |
| 422    | `{ "error": "...", "code": "AMBIGUOUS_SOURCE" }`                                        | Both sources provided        |
| 422    | `{ "error": "...", "code": "MISSING_PROGRAM_SOURCE" }`                                  | No source provided           |
| 422    | `{ "error": "...", "code": "DEFINITION_INVALID" }`                                      | Custom definition invalid    |
| 429    | `{ "error": "Too many requests", "code": "RATE_LIMITED" }`                              | Rate limit exceeded          |

**Error codes:** `INVALID_PROGRAM`, `AMBIGUOUS_SOURCE`, `MISSING_PROGRAM_SOURCE`, `DEFINITION_INVALID`, `FORBIDDEN`, `NOT_FOUND`, `CREATE_FAILED`, `UNAUTHORIZED`, `TOKEN_INVALID`, `RATE_LIMITED`

**Side effects:**

- Auto-completes any existing active program for the user
- Creates new program instance row

**Pagination:** none

**Caching:** none

---

#### `GET /api/programs/:id`

**Auth:** required (resolveUserId guard)
**Rate limit:** 60 000 ms / 100 max / key: `userId`

**Path parameters:**

- `id` — UUID, program instance ID

**Query parameters:** none

**Request body:** none

**Responses:**

| Status | Body                                               | Condition              |
| ------ | -------------------------------------------------- | ---------------------- |
| 200    | `ProgramInstanceResponse`                          | Success                |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`       | Missing/invalid token  |
| 404    | `{ "error": "...", "code": "INSTANCE_NOT_FOUND" }` | Not found or not owned |

**Error codes:** `INSTANCE_NOT_FOUND`, `UNAUTHORIZED`, `TOKEN_INVALID`

**Side effects:** none

**Pagination:** none

**Caching:**

- Redis key: `program:<userId>:<instanceId>`, TTL 300s (`program-cache.ts:10,17-19`)
- Singleflight: concurrent GETs for the same instance share one DB fetch (`routes/programs.ts:146`)
- Invalidated on any write to that instance (PATCH, DELETE, result mutation, undo)

---

#### `PATCH /api/programs/:id`

**Auth:** required (resolveUserId guard)
**Rate limit:** 60 000 ms / 20 max / key: `userId`

**Path parameters:**

- `id` — UUID

**Query parameters:** none

**Request body:**

```json
{
  "name": "string, optional, minLength 1, maxLength 100",
  "status": "optional, one of: 'active' | 'completed' | 'archived'",
  "config": "optional, Record<string maxLength 30, number 0-10000 | string maxLength 100>"
}
```

**Responses:**

| Status | Body                                                       | Condition              |
| ------ | ---------------------------------------------------------- | ---------------------- |
| 200    | `ProgramInstanceResponse`                                  | Success                |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`               | Missing/invalid token  |
| 404    | `{ "error": "...", "code": "INSTANCE_NOT_FOUND" }`         | Not found or not owned |
| 429    | `{ "error": "Too many requests", "code": "RATE_LIMITED" }` | Rate limit exceeded    |

**Error codes:** `INSTANCE_NOT_FOUND`, `UNAUTHORIZED`, `TOKEN_INVALID`, `RATE_LIMITED`

**Side effects:**

- Invalidates Redis cache for this instance

**Pagination:** none

**Caching:** invalidates `program:<userId>:<id>`

---

#### `PATCH /api/programs/:id/metadata`

**Auth:** required (resolveUserId guard)
**Rate limit:** 60 000 ms / 20 max / key: `userId`

**Path parameters:**

- `id` — UUID

**Query parameters:** none

**Request body:**

```json
{
  "metadata": { "<key maxLength 50>": "<string maxLength 500 | number | boolean | null>" }
}
```

**Responses:**

| Status | Body                                                                       | Condition                  |
| ------ | -------------------------------------------------------------------------- | -------------------------- |
| 200    | `ProgramInstanceResponse`                                                  | Success                    |
| 400    | `{ "error": "Metadata exceeds 10KB limit", "code": "METADATA_TOO_LARGE" }` | Patch exceeds 10 000 bytes |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`                               | Missing/invalid token      |
| 404    | `{ "error": "...", "code": "INSTANCE_NOT_FOUND" }`                         | Not found or not owned     |
| 429    | `{ "error": "Too many requests", "code": "RATE_LIMITED" }`                 | Rate limit exceeded        |

**Error codes:** `METADATA_TOO_LARGE`, `INSTANCE_NOT_FOUND`, `UNAUTHORIZED`, `TOKEN_INVALID`, `RATE_LIMITED`

**Side effects:**

- Shallow-merges metadata using PostgreSQL JSONB `||` operator: `COALESCE(metadata, '{}'::jsonb) || $1::jsonb` (`services/programs.ts:417`)
- Size limit: `10 000` bytes checked on `JSON.stringify(metadata)` of the incoming patch, not the total (`services/programs.ts:407-411`)
- Invalidates Redis cache for this instance

**Pagination:** none

**Caching:** invalidates `program:<userId>:<id>`

---

#### `DELETE /api/programs/:id`

**Auth:** required (resolveUserId guard)
**Rate limit:** 60 000 ms / 20 max / key: `userId`

**Path parameters:**

- `id` — UUID

**Query parameters:** none

**Request body:** none

**Responses:**

| Status | Body                                                       | Condition              |
| ------ | ---------------------------------------------------------- | ---------------------- |
| 204    | empty                                                      | Success                |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`               | Missing/invalid token  |
| 404    | `{ "error": "...", "code": "INSTANCE_NOT_FOUND" }`         | Not found or not owned |
| 429    | `{ "error": "Too many requests", "code": "RATE_LIMITED" }` | Rate limit exceeded    |

**Error codes:** `INSTANCE_NOT_FOUND`, `UNAUTHORIZED`, `TOKEN_INVALID`, `RATE_LIMITED`

**Side effects:**

- CASCADE deletes `workout_results` and `undo_entries`
- Invalidates Redis cache for this instance

**Pagination:** none

**Caching:** invalidates `program:<userId>:<id>`

---

#### `GET /api/programs/:id/export`

**Auth:** required (resolveUserId guard)
**Rate limit:** 60 000 ms / 20 max / key: `userId`

**Path parameters:**

- `id` — UUID

**Query parameters:** none

**Request body:** none

**Responses:**

| Status | Body                                                                                                                                                 | Condition              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 200    | `{ "version": 1, "exportDate": "<ISO 8601>", "programId": "<string>", "name": "<string>", "config": {...}, "results": {...}, "undoHistory": [...] }` | Success                |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`                                                                                                         | Missing/invalid token  |
| 404    | `{ "error": "...", "code": "INSTANCE_NOT_FOUND" }`                                                                                                   | Not found or not owned |

**Error codes:** `INSTANCE_NOT_FOUND`, `UNAUTHORIZED`, `TOKEN_INVALID`

**Side effects:** none

**Pagination:** none

**Caching:** none

---

#### `POST /api/programs/import`

**Auth:** required (resolveUserId guard)
**Rate limit:** 60 000 ms / 20 max / key: `userId`

**Path parameters:** none

**Query parameters:** none

**Request body:**

```json
{
  "version": 1,
  "exportDate": "string, required, format: date-time",
  "programId": "string, required, minLength 1",
  "name": "string, required, minLength 1, maxLength 100",
  "config": { "<key maxLength 30>": "<number 0-10000 | string maxLength 100>" },
  "results": {
    "<workoutIndex>": {
      "<slotId>": {
        "result": "optional, 'success' | 'fail'",
        "amrapReps": "optional, integer >= 0",
        "rpe": "optional, integer 6-10"
      }
    }
  },
  "undoHistory": [
    {
      "i": "integer >= 0",
      "slotId": "string, minLength 1",
      "prev": "optional, 'success' | 'fail'",
      "prevRpe": "optional, integer 1-10",
      "prevAmrapReps": "optional, integer >= 0"
    }
  ]
}
```

Constraints: `undoHistory` max 500 items. `workoutIndex` bounds validated against program definition. `slotId` validated against definition's valid slot IDs. `amrapReps` max 99.

**Responses:**

| Status | Body                                                       | Condition                             |
| ------ | ---------------------------------------------------------- | ------------------------------------- |
| 201    | `ProgramInstanceResponse`                                  | Success                               |
| 400    | `{ "error": "...", "code": "INVALID_PROGRAM" }`            | Unknown programId                     |
| 400    | `{ "error": "...", "code": "INVALID_DATA" }`               | Bad workout index, slot, or amrapReps |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`               | Missing/invalid token                 |
| 429    | `{ "error": "Too many requests", "code": "RATE_LIMITED" }` | Rate limit exceeded                   |
| 500    | `{ "error": "...", "code": "HYDRATION_FAILED" }`           | Program definition hydration failed   |

**Error codes:** `INVALID_PROGRAM`, `INVALID_DATA`, `HYDRATION_FAILED`, `IMPORT_FAILED`, `UNAUTHORIZED`, `TOKEN_INVALID`, `RATE_LIMITED`

**Side effects:**

- Creates program instance + bulk inserts results and undo entries in a transaction

**Pagination:** none

**Caching:** none

---

### Result Routes

All result routes require `Authorization: Bearer <token>` via `resolveUserId`. Routes are nested under `/api/programs/:id`.

#### `POST /api/programs/:id/results`

**Auth:** required (resolveUserId guard)
**Rate limit:** 60 000 ms / 60 max / key: `userId`

**Path parameters:**

- `id` — UUID, program instance ID

**Query parameters:** none

**Request body:**

```json
{
  "workoutIndex": "integer >= 0",
  "slotId": "string, minLength 1",
  "result": "'success' | 'fail'",
  "amrapReps": "optional, integer >= 0 (max 99)",
  "rpe": "optional, integer 1-10",
  "setLogs": "optional, array of { reps: integer 0-999, weight?: number >= 0, rpe?: integer 1-10 }, maxItems 20"
}
```

**Responses:**

| Status | Body                                                                                                           | Condition                                                  |
| ------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 201    | `{ "workoutIndex": <n>, "slotId": "<s>", "result": "...", "amrapReps"?: <n>, "rpe"?: <n>, "setLogs"?: [...] }` | Success (fields omitted, not null, when DB column is NULL) |
| 400    | `{ "error": "...", "code": "INVALID_DATA" }`                                                                   | amrapReps > 99 or rpe out of range                         |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`                                                                   | Missing/invalid token                                      |
| 404    | `{ "error": "...", "code": "INSTANCE_NOT_FOUND" }`                                                             | Program not found or not owned                             |
| 429    | `{ "error": "Too many requests", "code": "RATE_LIMITED" }`                                                     | Rate limit exceeded                                        |

**Error codes:** `INVALID_DATA`, `INSERT_FAILED`, `INSTANCE_NOT_FOUND`, `UNAUTHORIZED`, `TOKEN_INVALID`, `RATE_LIMITED`

**Side effects:**

- Upserts workout result (INSERT ... ON CONFLICT DO UPDATE on `(instanceId, workoutIndex, slotId)`)
- Pushes undo entry capturing previous state
- Trims undo stack to max 50 entries per instance
- Syncs `completed_at` on all rows for that workout index when all slots filled
- Touches `updated_at` on the program instance (fire-and-forget)
- Invalidates Redis cache for this instance

**Pagination:** none

**Caching:** invalidates `program:<userId>:<id>`

---

#### `DELETE /api/programs/:id/results/:workoutIndex/:slotId`

**Auth:** required (resolveUserId guard)
**Rate limit:** none (no `rateLimit()` call in this handler) (`routes/results.ts:83-98`)

**Path parameters:**

- `id` — UUID, program instance ID
- `workoutIndex` — numeric
- `slotId` — string

**Query parameters:** none

**Request body:** none

**Responses:**

| Status | Body                                               | Condition                      |
| ------ | -------------------------------------------------- | ------------------------------ |
| 204    | empty                                              | Success                        |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`       | Missing/invalid token          |
| 404    | `{ "error": "...", "code": "INSTANCE_NOT_FOUND" }` | Program not found or not owned |
| 404    | `{ "error": "...", "code": "RESULT_NOT_FOUND" }`   | Result not found               |

**Error codes:** `INSTANCE_NOT_FOUND`, `RESULT_NOT_FOUND`, `UNAUTHORIZED`, `TOKEN_INVALID`

**Side effects:**

- Pushes undo entry capturing the deleted result
- Deletes the result row
- Trims undo stack to max 50 entries
- Syncs `completed_at`
- Touches `updated_at` on the program instance (fire-and-forget)
- Invalidates Redis cache for this instance

**Pagination:** none

**Caching:** invalidates `program:<userId>:<id>`

---

#### `POST /api/programs/:id/undo`

**Auth:** required (resolveUserId guard)
**Rate limit:** 60 000 ms / 20 max / key: `userId`

**Path parameters:**

- `id` — UUID, program instance ID

**Query parameters:** none

**Request body:** none

**Responses:**

| Status | Body                                                                                           | Condition                      |
| ------ | ---------------------------------------------------------------------------------------------- | ------------------------------ |
| 200    | `{ "undone": null }`                                                                           | Nothing to undo                |
| 200    | `{ "undone": { "i": <n>, "slotId": "<s>", "prev"?: "success\|fail", "prevSetLogs"?: [...] } }` | Undo applied                   |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`                                                   | Missing/invalid token          |
| 404    | `{ "error": "...", "code": "INSTANCE_NOT_FOUND" }`                                             | Program not found or not owned |
| 429    | `{ "error": "Too many requests", "code": "RATE_LIMITED" }`                                     | Rate limit exceeded            |

**IMPORTANT:** The undo response MUST NOT include `prevRpe` or `prevAmrapReps`. Only `prev` and `prevSetLogs` are included in the response shape (`routes/results.ts:135-142`). This differs from the internal `undoHistory` in `ProgramInstanceResponse`.

**Error codes:** `INSTANCE_NOT_FOUND`, `UNAUTHORIZED`, `TOKEN_INVALID`, `RATE_LIMITED`

**Side effects:**

- Pops the most recent undo entry (highest id, LIFO)
- If `prevResult === null`: deletes current result
- If `prevResult !== null`: upserts previous result state (via ON CONFLICT DO UPDATE)
- Syncs `completed_at`
- Touches `updated_at` on the program instance (fire-and-forget)
- Invalidates Redis cache for this instance

**Pagination:** none

**Caching:** invalidates `program:<userId>:<id>`

---

### Catalog Routes

#### `GET /api/catalog`

**Auth:** none
**Rate limit:** 60 000 ms / 100 max / key: `x-forwarded-for ?? 'anonymous'` (`routes/catalog.ts:82`)

**Path parameters:** none

**Query parameters:** none

**Request body:** none

**Responses:**

| Status | Body                                                                                                                            | Condition |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 200    | `[{ "id", "name", "description", "author", "category", "level", "source", "totalWorkouts", "workoutsPerWeek", "cycleLength" }]` | Success   |

**Error codes:** `RATE_LIMITED`

**Side effects:** none

**Pagination:** none (returns all active programs)

**Caching:**

- `Cache-Control: public, max-age=300, stale-while-revalidate=60` (`routes/catalog.ts:85`)
- Redis key: `catalog:list`, TTL 300s, singleflight (`catalog-cache.ts:17`)

---

#### `GET /api/catalog/:programId`

**Auth:** none
**Rate limit:** 60 000 ms / 100 max / key: `x-forwarded-for ?? 'anonymous'` (`routes/catalog.ts:105`)

**Path parameters:**

- `programId` — string, catalog program ID

**Query parameters:** none

**Request body:** none

**Responses:**

| Status | Body                                                            | Condition              |
| ------ | --------------------------------------------------------------- | ---------------------- |
| 200    | Hydrated `ProgramDefinition` object                             | Success                |
| 404    | `{ "error": "Program not found", "code": "PROGRAM_NOT_FOUND" }` | Unknown program        |
| 500    | `{ "error": "...", "code": "HYDRATION_FAILED" }`                | Corrupted program data |

**Error codes:** `PROGRAM_NOT_FOUND`, `HYDRATION_FAILED`, `RATE_LIMITED`

**Side effects:** none

**Pagination:** none

**Caching:**

- `Cache-Control: public, max-age=300` (`routes/catalog.ts:114`)
- Redis key: `catalog:detail:<programId>`, TTL 300s, singleflight (`catalog-cache.ts:60-61`)

---

#### `POST /api/catalog/preview`

**Auth:** required (resolveUserId guard)
**Rate limit:** 3 600 000 ms / 30 max / key: `userId` (`routes/catalog.ts:38-40`)

**Path parameters:** none

**Query parameters:** none

**Request body:**

```json
{
  "definition": "<any>",
  "config": "<optional, any>"
}
```

**Responses:**

| Status | Body                                                       | Condition                 |
| ------ | ---------------------------------------------------------- | ------------------------- |
| 200    | Array of up to 10 `GenericWorkoutRow` objects              | Success                   |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`               | Missing/invalid token     |
| 422    | `{ "error": "...", "code": "VALIDATION_ERROR" }`           | Invalid definition        |
| 429    | `{ "error": "Too many requests", "code": "RATE_LIMITED" }` | Rate limit exceeded       |
| 500    | `{ "error": "...", "code": "INTERNAL_ERROR" }`             | Engine computation failed |

**Error codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `TOKEN_INVALID`, `RATE_LIMITED`, `INTERNAL_ERROR`

**Side effects:** none (pure computation, no DB writes)

**Pagination:** none

**Caching:** none

---

### Exercise Routes

#### `GET /api/exercises`

**Auth:** optional (different behavior based on auth state)
**Rate limit:** 60 000 ms / 100 max / key: `userId:ip` (authenticated) or `ip` (anonymous) (`routes/exercises.ts:97-99`)

**Path parameters:** none

**Query parameters:**

- `q` — string, optional, text search (ILIKE against name)
- `muscleGroupId` — string, optional, comma-separated IDs (max 20 values)
- `equipment` — string, optional, comma-separated
- `force` — string, optional, comma-separated
- `level` — string, optional, comma-separated
- `mechanic` — string, optional, comma-separated
- `category` — string, optional, comma-separated
- `isCompound` — string, optional, `"true"` or `"false"`
- `limit` — integer, optional, range [1, 1000], default 100
- `offset` — integer, optional, >= 0, default 0

**Request body:** none

**Responses:**

| Status | Body                                                                     | Condition |
| ------ | ------------------------------------------------------------------------ | --------- |
| 200    | `{ "data": [ExerciseEntry], "total": <n>, "offset": <n>, "limit": <n> }` | Success   |

ExerciseEntry shape: `{ "id", "name", "muscleGroupId", "equipment": "<string\|null>", "isCompound": <bool>, "isPreset": <bool>, "createdBy": "<uuid\|null>", "force": "<string\|null>", "level": "<string\|null>", "mechanic": "<string\|null>", "category": "<string\|null>", "secondaryMuscles": ["<string>"]\|null }`

**Error codes:** `RATE_LIMITED`

**Side effects:** none

**Pagination:** offset-based (response includes `total`, `offset`, `limit`)

**Caching:**

- `Cache-Control: public, max-age=300` — only for unauthenticated responses (`routes/exercises.ts:118-120`)
- Redis: keyed by `exercises:<preset|userId>:<filterHash>`, TTL 300s (preset) / 120s (user) (`exercise-cache.ts:15-19`)
- Singleflight per query

---

#### `GET /api/muscle-groups`

**Auth:** none
**Rate limit:** 60 000 ms / 100 max / key: `x-forwarded-for ?? 'anonymous'` (`routes/exercises.ts:154`)

**Path parameters:** none

**Query parameters:** none

**Request body:** none

**Responses:**

| Status | Body                                         | Condition |
| ------ | -------------------------------------------- | --------- |
| 200    | `[{ "id": "<string>", "name": "<string>" }]` | Success   |

**Error codes:** `RATE_LIMITED`

**Side effects:** none

**Pagination:** none

**Caching:**

- `Cache-Control: public, max-age=600` (`routes/exercises.ts:157`)
- Redis key: `muscle-groups:list`, TTL 600s (`muscle-groups-cache.ts:19`)
- Singleflight

---

#### `POST /api/exercises`

**Auth:** required (resolveUserId guard)
**Rate limit:** 60 000 ms / 20 max / key: `userId`

**Path parameters:** none

**Query parameters:** none

**Request body:**

```json
{
  "name": "string, required, minLength 1, maxLength 100",
  "muscleGroupId": "string, required, minLength 1, maxLength 50",
  "equipment": "string, optional, maxLength 50",
  "isCompound": "boolean, optional"
}
```

**Slug generation algorithm** (`routes/exercises.ts:187-191`):

```
name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 50)
```

If the resulting slug is empty, throws 422 `INVALID_SLUG`.

**Responses:**

| Status | Body                                                              | Condition             |
| ------ | ----------------------------------------------------------------- | --------------------- |
| 201    | `ExerciseEntry`                                                   | Success               |
| 400    | `{ "error": "Invalid muscle group", "code": "VALIDATION_ERROR" }` | Unknown muscleGroupId |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`                      | Missing/invalid token |
| 409    | `{ "error": "Exercise ID already exists", "code": "DUPLICATE" }`  | Slug conflicts        |
| 422    | `{ "error": "...", "code": "INVALID_SLUG" }`                      | Empty slug            |
| 429    | `{ "error": "Too many requests", "code": "RATE_LIMITED" }`        | Rate limit exceeded   |

**Error codes:** `VALIDATION_ERROR`, `DUPLICATE`, `INVALID_SLUG`, `UNAUTHORIZED`, `TOKEN_INVALID`, `RATE_LIMITED`

**Side effects:**

- Inserts exercise row with `is_preset = false`, `created_by = userId`
- Invalidates user-specific exercise cache (SCAN + DEL)

**Pagination:** none

**Caching:** invalidates `exercises:user:<userId>:*`

---

### Program Definition Routes

All routes require `Authorization: Bearer <token>` via `resolveUserId`.

#### `POST /api/program-definitions`

**Auth:** required (resolveUserId guard)
**Rate limit:** 3 600 000 ms / 5 max / key: `userId`

**Path parameters:** none

**Query parameters:** none

**Request body:**

```json
{
  "definition": "<any, validated against ProgramDefinitionSchema>"
}
```

Constraint: `definition.source` MUST be `"custom"`. Max 10 active definitions per user.

**Responses:**

| Status | Body                                                                         | Condition             |
| ------ | ---------------------------------------------------------------------------- | --------------------- |
| 201    | `ProgramDefinitionResponse`                                                  | Success               |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`                                 | Missing/invalid token |
| 409    | `{ "error": "Definition limit reached (max 10)", "code": "LIMIT_EXCEEDED" }` | Limit exceeded        |
| 422    | `{ "error": "...", "code": "VALIDATION_ERROR" }`                             | Invalid definition    |
| 429    | `{ "error": "Too many requests", "code": "RATE_LIMITED" }`                   | Rate limit exceeded   |

`ProgramDefinitionResponse` shape: `{ "id", "userId", "definition": <object>, "status": "draft|pending_review|approved|rejected", "createdAt": "<ISO>", "updatedAt": "<ISO>", "deletedAt": "<ISO>|null" }`

**Error codes:** `LIMIT_EXCEEDED`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `TOKEN_INVALID`, `RATE_LIMITED`, `INTERNAL_ERROR`

**Side effects:** creates definition row with `status: 'draft'`

**Pagination:** none

**Caching:** none

---

#### `GET /api/program-definitions`

**Auth:** required (resolveUserId guard)
**Rate limit:** 60 000 ms / 100 max / key: `userId`

**Path parameters:** none

**Query parameters:**

- `limit` — integer, optional, range [1, 100], default 20
- `offset` — integer, optional, >= 0, default 0

**Request body:** none

**Responses:**

| Status | Body                                                    | Condition             |
| ------ | ------------------------------------------------------- | --------------------- |
| 200    | `{ "data": [ProgramDefinitionResponse], "total": <n> }` | Success               |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`            | Missing/invalid token |

**Error codes:** `UNAUTHORIZED`, `TOKEN_INVALID`

**Side effects:** none

**Pagination:** offset-based (response includes `total`)

**Caching:** none

---

#### `POST /api/program-definitions/fork`

**Auth:** required (resolveUserId guard)
**Rate limit:** 3 600 000 ms / 10 max / key: `userId`

**Path parameters:** none

**Query parameters:** none

**Request body:**

```json
{
  "sourceId": "string, required, minLength 1",
  "sourceType": "'template' | 'definition'"
}
```

**Responses:**

| Status | Body                                                       | Condition                           |
| ------ | ---------------------------------------------------------- | ----------------------------------- |
| 201    | `ProgramDefinitionResponse`                                | Success                             |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`               | Missing/invalid token               |
| 403    | `{ "error": "...", "code": "FORBIDDEN" }`                  | Source definition not owned by user |
| 404    | `{ "error": "...", "code": "NOT_FOUND" }`                  | Source not found                    |
| 409    | `{ "error": "...", "code": "LIMIT_EXCEEDED" }`             | Definition limit reached            |
| 422    | `{ "error": "...", "code": "VALIDATION_ERROR" }`           | Source failed validation            |
| 429    | `{ "error": "Too many requests", "code": "RATE_LIMITED" }` | Rate limit exceeded                 |

**Error codes:** `FORBIDDEN`, `NOT_FOUND`, `LIMIT_EXCEEDED`, `VALIDATION_ERROR`, `INTERNAL_ERROR`, `UNAUTHORIZED`, `TOKEN_INVALID`, `RATE_LIMITED`

**Side effects:**

- Creates new draft definition with `" (copia)"` suffix appended to name
- Assigns a new UUID as definition `id`

**Pagination:** none

**Caching:** none

---

#### `GET /api/program-definitions/:id`

**Auth:** required (resolveUserId guard)
**Rate limit:** 60 000 ms / 100 max / key: `userId`

**Path parameters:**

- `id` — UUID

**Query parameters:** none

**Request body:** none

**Responses:**

| Status | Body                                         | Condition              |
| ------ | -------------------------------------------- | ---------------------- |
| 200    | `ProgramDefinitionResponse`                  | Success                |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }` | Missing/invalid token  |
| 404    | `{ "error": "...", "code": "NOT_FOUND" }`    | Not found or not owned |

**Error codes:** `NOT_FOUND`, `UNAUTHORIZED`, `TOKEN_INVALID`

**Side effects:** none

**Pagination:** none

**Caching:** none

---

#### `PUT /api/program-definitions/:id`

**Auth:** required (resolveUserId guard)
**Rate limit:** 3 600 000 ms / 20 max / key: `userId`

**Path parameters:**

- `id` — UUID

**Query parameters:** none

**Request body:**

```json
{
  "definition": "<any, validated against ProgramDefinitionSchema>"
}
```

**Responses:**

| Status | Body                                             | Condition              |
| ------ | ------------------------------------------------ | ---------------------- |
| 200    | `ProgramDefinitionResponse`                      | Success                |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`     | Missing/invalid token  |
| 404    | `{ "error": "...", "code": "NOT_FOUND" }`        | Not found or not owned |
| 422    | `{ "error": "...", "code": "VALIDATION_ERROR" }` | Invalid definition     |

**Error codes:** `NOT_FOUND`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `TOKEN_INVALID`

**Side effects:**

- If status was `pending_review` or `approved`, resets to `draft` (`services/program-definitions.ts:258-259`)

**Pagination:** none

**Caching:** none

---

#### `DELETE /api/program-definitions/:id`

**Auth:** required (resolveUserId guard)
**Rate limit:** 3 600 000 ms / 20 max / key: `userId`

**Path parameters:**

- `id` — UUID

**Query parameters:** none

**Request body:** none

**Responses:**

| Status | Body                                                                                                      | Condition              |
| ------ | --------------------------------------------------------------------------------------------------------- | ---------------------- |
| 204    | empty                                                                                                     | Success                |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`                                                              | Missing/invalid token  |
| 404    | `{ "error": "...", "code": "NOT_FOUND" }`                                                                 | Not found or not owned |
| 409    | `{ "error": "Cannot delete definition with active program instances", "code": "ACTIVE_INSTANCES_EXIST" }` | Has active instances   |

**Error codes:** `NOT_FOUND`, `ACTIVE_INSTANCES_EXIST`, `UNAUTHORIZED`, `TOKEN_INVALID`

**Side effects:**

- Soft-deletes (sets `deleted_at` timestamp)
- Checks for active program instances before deleting

**Pagination:** none

**Caching:** none

---

#### `PATCH /api/program-definitions/:id/status`

**Auth:** required (resolveUserId guard)
**Rate limit:** 3 600 000 ms / 20 max / key: `userId`

**Path parameters:**

- `id` — UUID

**Query parameters:** none

**Request body:**

```json
{
  "status": "'draft' | 'pending_review' | 'approved' | 'rejected'"
}
```

**State machine transitions** (`services/program-definitions.ts:547-562`):

| From             | To               | Allowed Role                     |
| ---------------- | ---------------- | -------------------------------- |
| `draft`          | `pending_review` | Owner                            |
| `pending_review` | `draft`          | Owner                            |
| `pending_review` | `approved`       | Admin (`ADMIN_USER_IDS` env var) |
| `pending_review` | `rejected`       | Admin (`ADMIN_USER_IDS` env var) |
| Any other        | Any              | FORBIDDEN                        |

Admin check: `ADMIN_USER_IDS` env var, comma-separated UUIDs (`services/program-definitions.ts:78-87`).

**Responses:**

| Status | Body                                                                       | Condition                            |
| ------ | -------------------------------------------------------------------------- | ------------------------------------ |
| 200    | `ProgramDefinitionResponse`                                                | Success                              |
| 401    | `{ "error": "...", "code": "UNAUTHORIZED" }`                               | Missing/invalid token                |
| 403    | `{ "error": "Forbidden: invalid status transition", "code": "FORBIDDEN" }` | Invalid transition or not authorized |
| 404    | `{ "error": "...", "code": "NOT_FOUND" }`                                  | Not found                            |

**Error codes:** `FORBIDDEN`, `NOT_FOUND`, `UNAUTHORIZED`, `TOKEN_INVALID`, `INTERNAL_ERROR`

**Side effects:**

- On `approved`: invalidates `catalog:list` and `catalog:detail:<programId>` Redis keys (`services/program-definitions.ts:363-370`)

**Pagination:** none

**Caching:** conditionally invalidates catalog cache on approval

---

### Stats Routes

#### `GET /api/stats/online`

**Auth:** none
**Rate limit:** none

**Path parameters:** none

**Query parameters:** none

**Request body:** none

**Responses:**

| Status | Body                          | Condition                                        |
| ------ | ----------------------------- | ------------------------------------------------ |
| 200    | `{ "count": <number\|null> }` | Success. `null` when Redis unavailable or errors |

**Error codes:** none

**Side effects:** none

**Pagination:** none

**Caching:** none (reads from Redis sorted set in real-time)

---

### System Routes

System routes have NO `/api` prefix.

#### `GET /health`

**Auth:** none
**Rate limit:** none

**Path parameters:** none

**Query parameters:** none

**Request body:** none

**Responses:**

| Status | Body                                                                                                                                      | Condition      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 200    | `{ "status": "ok", "timestamp": "<ISO>", "uptime": <int>, "db": { "status": "ok", "latencyMs": <n> }, "redis": <status> }`                | All healthy    |
| 503    | `{ "status": "degraded", "timestamp": "<ISO>", "uptime": <int>, "db": { "status": "error", "error": "Unavailable" }, "redis": <status> }` | DB unreachable |

Redis status is one of:

- `{ "status": "ok", "latencyMs": <n> }` — Redis connected and responding
- `{ "status": "disabled" }` — No `REDIS_URL` configured
- `{ "status": "error", "error": "Unavailable" }` — Redis configured but unreachable

**IMPORTANT:** Only DB status determines overall health. Redis being `disabled` or `error` does NOT degrade overall status (`create-app.ts:143`).

The `uptime` field MUST be `Math.floor(process.uptime())` — integer seconds since process start (`create-app.ts:148`).

The `timestamp` MUST be `new Date().toISOString()` (`create-app.ts:147`).

**Error codes:** none

**Side effects:** executes `SELECT 1` against DB and `PING` against Redis

**Pagination:** none

**Caching:** none

---

#### `GET /metrics`

**Auth:** optional bearer token. If `METRICS_TOKEN` env var is set, requires `Authorization: Bearer <METRICS_TOKEN>`. If not set, endpoint is public (`create-app.ts:167-173`).

**Rate limit:** none

**Path parameters:** none

**Query parameters:** none

**Request body:** none

**Responses:**

| Status | Body                                                                  | Condition                        |
| ------ | --------------------------------------------------------------------- | -------------------------------- |
| 200    | Prometheus text format (`content-type` set to `registry.contentType`) | Success                          |
| 401    | `{ "error": "Invalid metrics token", "code": "UNAUTHORIZED" }`        | Token required but wrong/missing |

**Error codes:** `UNAUTHORIZED`

**Side effects:** none

**Pagination:** none

**Caching:** none

---

## 9. JSON Serialization Rules

### Case Convention

All JSON keys MUST use camelCase. No snake_case in request or response bodies. (`exploration §9`)

### Date Format

All timestamps MUST be serialized as ISO 8601 with milliseconds and `Z` suffix, matching the output of JavaScript's `new Date().toISOString()`:

```
2024-01-15T10:30:00.000Z
```

**Go implementation note:** Go's `time.RFC3339Nano` is NOT a drop-in equivalent. `RFC3339Nano` produces variable-length fractional seconds (e.g. `2024-01-15T10:30:00.123456789Z`) and omits fractional seconds entirely for round timestamps. The Go API MUST use a custom format string `"2006-01-02T15:04:05.000Z07:00"` to guarantee exactly 3 fractional digits and a `Z` suffix for UTC.

### Null vs Omit

Both patterns are used. The Go implementation MUST match the TS behavior exactly per field:

| Response Type                | Field              | Behavior                                    | Go Consequence                                              |
| ---------------------------- | ------------------ | ------------------------------------------- | ----------------------------------------------------------- |
| User profile                 | `name`             | always-present-possibly-null                | `*string` (no `omitempty`)                                  |
| User profile                 | `avatarUrl`        | always-present-possibly-null                | `*string` (no `omitempty`)                                  |
| ProgramInstanceResponse      | `metadata`         | always-present-possibly-null                | `json.RawMessage` (no `omitempty`), marshal `nil` as `null` |
| ProgramInstanceResponse      | `definitionId`     | always-present-possibly-null                | `*string` (no `omitempty`)                                  |
| ProgramInstanceResponse      | `customDefinition` | always-present-possibly-null                | `json.RawMessage` (no `omitempty`), marshal `nil` as `null` |
| ProgramInstanceResponse      | `results`          | always-present (empty `{}` when no results) | `map[string]...` or struct, never `omitempty`               |
| ProgramInstanceResponse      | `undoHistory`      | always-present (empty `[]` when no entries) | `[]UndoEntry`, marshal `nil` slice as `[]`                  |
| ProgramInstanceResponse      | `resultTimestamps` | always-present (empty `{}`)                 | `map[string]string`, never `omitempty`                      |
| ProgramInstanceResponse      | `completedDates`   | always-present (empty `{}`)                 | `map[string]string`, never `omitempty`                      |
| Result fields in results map | `amrapReps`        | omitted-when-null                           | `*int` with `json:",omitempty"`                             |
| Result fields in results map | `rpe`              | omitted-when-null                           | `*int` with `json:",omitempty"`                             |
| Result fields in results map | `setLogs`          | omitted-when-null                           | `*[]SetLog` with `json:",omitempty"` or custom marshaler    |
| UndoHistory entry            | `prev`             | omitted-when-null                           | `*string` with `json:",omitempty"`                          |
| UndoHistory entry            | `prevRpe`          | omitted-when-null                           | `*int` with `json:",omitempty"`                             |
| UndoHistory entry            | `prevAmrapReps`    | omitted-when-null                           | `*int` with `json:",omitempty"`                             |
| UndoHistory entry            | `prevSetLogs`      | omitted-when-null                           | `*[]SetLog` with `json:",omitempty"` or custom marshaler    |
| Paginated list               | `nextCursor`       | always-present-possibly-null                | `*string` (no `omitempty`)                                  |
| ProgramDefinitionResponse    | `deletedAt`        | always-present-possibly-null                | `*string` (no `omitempty`)                                  |
| ExerciseEntry                | `equipment`        | always-present-possibly-null                | `*string` (no `omitempty`)                                  |
| ExerciseEntry                | `createdBy`        | always-present-possibly-null                | `*string` (no `omitempty`)                                  |
| ExerciseEntry                | `force`            | always-present-possibly-null                | `*string` (no `omitempty`)                                  |
| ExerciseEntry                | `level`            | always-present-possibly-null                | `*string` (no `omitempty`)                                  |
| ExerciseEntry                | `mechanic`         | always-present-possibly-null                | `*string` (no `omitempty`)                                  |
| ExerciseEntry                | `category`         | always-present-possibly-null                | `*string` (no `omitempty`)                                  |
| ExerciseEntry                | `secondaryMuscles` | always-present-possibly-null                | `*[]string` (no `omitempty`), marshal `nil` as `null`       |
| Stats online                 | `count`            | always-present-possibly-null                | `*int` (no `omitempty`)                                     |

### JSONB Pass-Through Fields

The following fields are stored as PostgreSQL JSONB and MUST be returned as-is (arbitrary JSON), not deserialized into typed structs:

- `config` in `ProgramInstanceResponse` — `Record<string, number | string>`
- `metadata` in `ProgramInstanceResponse` — arbitrary JSON object
- `definition` in `ProgramDefinitionResponse` — arbitrary JSON object (ProgramDefinition schema)
- `customDefinition` in `ProgramInstanceResponse` — arbitrary JSON object or null
- `set_logs` in workout results — array of `{ reps, weight?, rpe? }` or null

In Go, use `json.RawMessage` for these fields.

### Number Precision

Numbers use standard JavaScript float64 precision. No special handling is required. The Go API SHOULD use `float64` for weight values and `int` for integer fields.

### Empty Collections

- Empty results MUST be `{}` (empty object), not `null` or omitted (`services/programs.ts:92,100`)
- Empty undo history MUST be `[]` (empty array), not `null` or omitted (`services/programs.ts:113`)
- Empty `resultTimestamps` MUST be `{}` (`services/programs.ts:71-81`)
- Empty `completedDates` MUST be `{}` (`services/programs.ts:130-140`)

---

## 10. Cursor Pagination

### Format

Cursor format: `<ISO-timestamp>_<UUID>` where the separator is a single underscore.

Example: `2024-01-15T10:30:00.000Z_550e8400-e29b-41d4-a716-446655440000`

### Parsing Algorithm

The cursor MUST be parsed using `lastIndexOf('_')` to split timestamp from UUID (`services/programs.ts:265`):

1. Find the last underscore position
2. Everything before = ISO timestamp string
3. Everything after = UUID string
4. Parse timestamp with `new Date(tsStr)` — if `NaN`, reject with `INVALID_CURSOR`
5. Verify UUID part is non-empty

This is critical because ISO timestamps contain hyphens but not underscores, while UUIDs contain hyphens. Using `lastIndexOf('_')` ensures the split happens at the correct boundary.

### SQL WHERE Predicate

```sql
WHERE user_id = :userId
  AND (
    created_at < :ts
    OR (created_at = :ts AND id > :id)
  )
ORDER BY created_at DESC, id ASC
LIMIT :limit + 1
```

(`services/programs.ts:288-294,297-309`)

The `+1` row is used to determine if more pages exist (`services/programs.ts:311-314`).

### Cursor Generation

`nextCursor = hasMore ? `${lastRow.createdAt.toISOString()}_${lastRow.id}` : null` (`services/programs.ts:314`)

### Page Size

- Default: `20`
- Max: `100`
- Clamped with `Math.min(options.limit ?? 20, 100)` (`services/programs.ts:279`)

### Offset-Based Pagination

`GET /api/exercises` and `GET /api/program-definitions` use offset-based pagination:

- **Exercises:** response shape `{ data, total, offset, limit }` with default `limit=100`, `offset=0`
- **Program definitions:** response shape `{ data, total }` with default `limit=20`, `offset=0`

---

## 11. Prometheus Metrics

### Custom Metrics

| Metric Name                     | Type      | Labels                           | Notes                                                                                    |
| ------------------------------- | --------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Buckets: `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]` (`lib/metrics.ts:11`)   |
| `http_requests_total`           | Counter   | `method`, `route`, `status_code` | Total request count                                                                      |
| `rate_limit_hits_total`         | Counter   | `endpoint`                       | Incremented on 429 rejection (`rate-limit.ts:96`)                                        |
| `http_errors_total`             | Counter   | `status_class`, `error_code`     | `status_class` is `"4xx"` or `"5xx"`; `error_code` is the `ApiError.code` or `"UNKNOWN"` |
| `db_queries_total`              | Counter   | `query_type`                     | Values: `select`, `insert`, `update`, `delete`, `other`                                  |

Default prom-client metrics (Node.js/Bun runtime metrics) are also collected via `collectDefaultMetrics({ register: registry })` (`lib/metrics.ts:5`).

### Route Normalization

Route labels MUST be normalized to prevent high-cardinality explosion (`plugins/metrics.ts:12-16`):

1. UUID regex: `/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi` → replaced with `:id`
2. Numeric segments regex: `/\/\d+/g` → replaced with `/:n`

Examples:

- `/programs/abc-123-def-456-ghi` → `/programs/:id`
- `/programs/:id/results/5/t1` → `/programs/:id/results/:n/t1`

### Error Metrics

On error, `httpRequestsTotal` is incremented with the error status AND `httpErrorsTotal` is incremented separately (`plugins/metrics.ts:39-54`). The `httpRequestDuration` is NOT recorded on errors (start time is deleted but not observed).

---

## 12. Redis Key Space

| Key Pattern                                    | TTL                                                           | Purpose                                   | Source                                       |
| ---------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------- |
| `program:<userId>:<instanceId>`                | 300s                                                          | Program instance response cache           | `program-cache.ts:10,17-19`                  |
| `catalog:list`                                 | 300s                                                          | Catalog list cache                        | `catalog-cache.ts:17`                        |
| `catalog:detail:<programId>`                   | 300s                                                          | Catalog detail cache                      | `catalog-cache.ts:60-61`                     |
| `rl:<endpoint>:<key>`                          | `windowMs` (PEXPIRE)                                          | Rate limiter sliding window (sorted sets) | `rate-limit.ts:94`, `redis-rate-limit.ts:30` |
| `users:online`                                 | No fixed TTL (ZREMRANGEBYSCORE prunes entries older than 60s) | Presence tracking sorted set              | `presence.ts:4`                              |
| `exercises:<preset\|user:userId>:<filterHash>` | 300s (preset) / 120s (user)                                   | Exercise list cache                       | `exercise-cache.ts:15-19,73-79`              |
| `muscle-groups:list`                           | 600s                                                          | Muscle group list cache                   | `muscle-groups-cache.ts:19`                  |

All Redis caches are fail-open: if Redis is unavailable, the API continues without cache. Errors are logged at `warn` level.

---

## 13. Request/Response Header Inventory

### Consumed Request Headers

| Header                           | Usage                                                                    | Source                                         |
| -------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------- |
| `Authorization`                  | Bearer token for protected routes (`resolveUserId`) and metrics endpoint | `auth-guard.ts:46`, `create-app.ts:169`        |
| `Cookie`                         | `refresh_token` for `/auth/refresh` and `/auth/signout`                  | `routes/auth.ts:187-188,255-256`               |
| `x-request-id`                   | Propagated as response header if valid (`/^[\w-]{8,64}$/`)               | `request-logger.ts:21-22`                      |
| `x-forwarded-for`                | Client IP when `TRUSTED_PROXY=true`; rate limit key for public routes    | `request-logger.ts:26`, `routes/catalog.ts:82` |
| `user-agent`                     | Device classification for new-user Telegram notification                 | `routes/auth.ts:123`                           |
| `content-type`                   | Validated for JSON body parsing by Elysia                                | Elysia framework                               |
| `access-control-request-headers` | CORS preflight header mirroring                                          | Elysia CORS plugin                             |

### Emitted Response Headers

| Header                             | Value                                                                                  | When                                        | Source                    |
| ---------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------- |
| `x-request-id`                     | `<reqId>`                                                                              | Always                                      | `request-logger.ts:36`    |
| `x-content-type-options`           | `nosniff`                                                                              | Always                                      | `create-app.ts:50`        |
| `x-frame-options`                  | `DENY`                                                                                 | Always                                      | `create-app.ts:51`        |
| `referrer-policy`                  | `strict-origin-when-cross-origin`                                                      | Always                                      | `create-app.ts:52`        |
| `content-security-policy`          | Full CSP string (see [Security Headers](#3-security-headers))                          | Always                                      | `create-app.ts:53`        |
| `strict-transport-security`        | `max-age=31536000; includeSubDomains`                                                  | `NODE_ENV === 'production'` only            | `create-app.ts:54-55`     |
| `permissions-policy`               | `camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()`             | Always                                      | `create-app.ts:57`        |
| `access-control-allow-credentials` | `true`                                                                                 | All CORS responses                          | `create-app.ts:44`        |
| `access-control-allow-origin`      | Mirrored from configured origins                                                       | CORS responses                              | Elysia CORS plugin        |
| `Cache-Control`                    | `public, max-age=300, stale-while-revalidate=60`                                       | `GET /api/catalog`                          | `routes/catalog.ts:85`    |
| `Cache-Control`                    | `public, max-age=300`                                                                  | `GET /api/catalog/:id`                      | `routes/catalog.ts:114`   |
| `Cache-Control`                    | `public, max-age=300`                                                                  | `GET /api/exercises` (unauthenticated only) | `routes/exercises.ts:119` |
| `Cache-Control`                    | `public, max-age=600`                                                                  | `GET /api/muscle-groups`                    | `routes/exercises.ts:157` |
| `Retry-After`                      | `<Math.ceil(windowMs / 1000)>` (seconds)                                               | 429 responses                               | `rate-limit.ts:98`        |
| `content-type`                     | `text/plain; charset=utf-8`                                                            | `GET /.well-known/security.txt`             | `create-app.ts:186`       |
| `content-type`                     | `registry.contentType` (Prometheus text format)                                        | `GET /metrics`                              | `create-app.ts:174`       |
| `set-cookie`                       | `refresh_token=...; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/api/auth` | Auth token issuance / rotation              | `routes/auth.ts:55-61`    |

---

## 14. Background Jobs

### Token Cleanup

- **Trigger:** runs at startup and then every 6 hours (`bootstrap.ts:216-225`)
- **Interval:** `6 * 60 * 60 * 1000` ms = 21 600 000 ms
- **SQL:** `DELETE FROM refresh_tokens WHERE expires_at < now()` (`services/auth.ts:208-209`)
- **Error handling:** errors are caught and logged at `error` level; the job does not crash the server (`bootstrap.ts:219-221`)

### Presence Tracking

- **Trigger:** on every authenticated request (via `resolveUserId`) (`auth-guard.ts:82-87`)
- **Behavior:** fire-and-forget (errors logged at `warn`, do not affect the response)
- **Redis commands:** MULTI/EXEC pipeline (`presence.ts:11-15`):
  1. `ZADD users:online <now_ms> <userId>` — upsert user with current timestamp as score
  2. `ZREMRANGEBYSCORE users:online -inf <now - 60000>` — prune stale entries
- **TTL semantics:** entries with score older than 60 seconds are pruned on every update

### Telegram Notification

- **Trigger:** on new user sign-up via `POST /api/auth/google` (`routes/auth.ts:122-128`)
- **Behavior:** fire-and-forget; errors logged at `warn` level; no-ops when `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` are absent (`telegram.ts:32-33`)
- **Timeout:** 5 000 ms (`telegram.ts:14`)
- **Message format:** `"New user: <email> | <deviceType> | <timestamp>"` where `deviceType` is `Mobile`, `Desktop`, `Bot`, or `Unknown` (`routes/auth.ts:126`)

---

## 15. Environment Variable Table

| Name                 | Required                               | Default                 | Purpose                                                               |
| -------------------- | -------------------------------------- | ----------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`       | Yes                                    | —                       | PostgreSQL connection URL                                             |
| `JWT_SECRET`         | Yes (prod: 64+ chars, not dev default) | `dev-secret-change-me`  | HS256 JWT signing secret                                              |
| `GOOGLE_CLIENT_ID`   | Yes                                    | —                       | Google OAuth client ID for ID token verification                      |
| `CORS_ORIGIN`        | Yes (prod)                             | `http://localhost:3000` | Comma-separated allowed origins                                       |
| `PORT`               | No                                     | `3001`                  | HTTP listen port                                                      |
| `NODE_ENV`           | No                                     | —                       | `production` enables strict checks, HSTS, disables dev endpoints      |
| `LOG_LEVEL`          | No                                     | `info`                  | Pino log level                                                        |
| `REDIS_URL`          | No                                     | —                       | ioredis connection URL; enables distributed rate limiting and caching |
| `METRICS_TOKEN`      | No                                     | —                       | Bearer token to protect `GET /metrics`                                |
| `TRUSTED_PROXY`      | No                                     | —                       | `"true"` to trust `x-forwarded-for` for client IP                     |
| `ADMIN_USER_IDS`     | No                                     | —                       | Comma-separated UUIDs of admin users (for definition approval)        |
| `SENTRY_DSN`         | No                                     | —                       | Sentry error tracking DSN                                             |
| `TELEGRAM_BOT_TOKEN` | No                                     | —                       | Telegram bot token for new-user notifications                         |
| `TELEGRAM_CHAT_ID`   | No                                     | —                       | Telegram chat/channel ID for notifications                            |
| `JWT_ACCESS_EXPIRY`  | No                                     | `15m`                   | JWT access token expiry (ElysiaJS duration format)                    |
| `DB_POOL_SIZE`       | No                                     | `50`                    | PostgreSQL connection pool max size                                   |
| `DB_SSL`             | No                                     | —                       | `"false"` to disable SSL; production default is `"require"`           |

---

## 16. SPA Serving

The API serves the pre-built React SPA from `web/dist/` relative to the API source directory (`create-app.ts:178-189`):

- **Static files:** served via `@elysiajs/static` with `prefix: '/'` and `alwaysStatic: true` from `resolve(import.meta.dir, '../../web/dist')` (`create-app.ts:177-183`)
- **Root:** `GET /` → serves `web/dist/index.html` (`create-app.ts:184`)
- **Security.txt:** `GET /.well-known/security.txt` → serves `web/dist/.well-known/security.txt` with `content-type: text/plain; charset=utf-8` (`create-app.ts:185-188`)
- **Catch-all:** `GET /*` → serves `web/dist/index.html` for client-side routing (`create-app.ts:189`)

**IMPORTANT:** SPA serving is production-only in the sense that the static files must exist. In development, the frontend runs its own dev server.

The Go API MUST implement the same catch-all behavior: any GET request not matching an API route, health, or metrics MUST serve the SPA `index.html`.

---

## 17. Risks & Go Implementation Pitfalls

### Risk 1: JWT Cross-Server Interop

During migration, both TS and Go servers may run simultaneously. JWTs signed by one server MUST be verifiable by the other. Both MUST use the same `JWT_SECRET` and HS256 algorithm. The ElysiaJS JWT plugin uses `jose` under the hood — verify that Go's `golang-jwt/jwt` produces identical tokens.

Cross-reference: [Auth Contract](#7-auth-contract)

### Risk 2: Date Serialization Mismatch

Go's `time.RFC3339Nano` does NOT produce the same format as JavaScript's `Date.toISOString()`. The TS API always emits exactly 3 fractional digits (milliseconds) with a `Z` suffix. Go may emit 0, 3, 6, or 9 fractional digits depending on the value. Use a custom format or post-processing.

Cross-reference: [JSON Serialization Rules](#9-json-serialization-rules)

### Risk 3: Null vs Omit in JSON

Go's `encoding/json` treats `omitempty` on pointer fields differently from TypeScript's spread-conditional pattern. A field with `omitempty` will be omitted when the pointer is nil AND when the value is zero. This can cause `0`, `false`, or `""` to be incorrectly omitted. Test every nullable field explicitly.

Cross-reference: [JSON Serialization Rules](#9-json-serialization-rules)

### Risk 4: Cookie Path Attribute

The `refresh_token` cookie has `path: /api/auth`. If the Go API sets a different path (or no path), the browser will send the cookie on different requests, breaking auth. Ensure the cookie path is exactly `/api/auth`.

Cross-reference: [Auth Contract](#7-auth-contract)

### Risk 5: Rate Limiter Sliding Window Precision

The TS rate limiter uses `Date.now()` (millisecond precision) for sorted set scores. The Lua script uses `tonumber()` which may lose precision on large millisecond timestamps. The Go implementation SHOULD use the same precision.

Cross-reference: [Rate Limiting](#6-rate-limiting)

### Risk 6: Cursor Pagination Split Point

The cursor uses `lastIndexOf('_')` to split ISO timestamp from UUID. If the Go implementation uses `strings.Split` or `strings.SplitN` instead of finding the last underscore, it will break on ISO timestamps containing underscores (unlikely but the algorithm must be exact).

Cross-reference: [Cursor Pagination](#10-cursor-pagination)

### Risk 7: JSONB Shallow Merge for Metadata

The metadata update uses PostgreSQL's `||` operator for JSONB merge. This is a shallow merge — nested objects are replaced, not merged recursively. The Go implementation MUST NOT implement deep merge.

Cross-reference: [Endpoint Reference](#8-endpoint-reference) (`PATCH /api/programs/:id/metadata`)

### Risk 8: Undo Response Shape Mismatch

The undo response (`POST /programs/:id/undo`) intentionally OMITS `prevRpe` and `prevAmrapReps` from the response. Only `prev` and `prevSetLogs` are included. This differs from the full `undoHistory` in `ProgramInstanceResponse`. The Go implementation MUST use a separate response struct for undo.

Cross-reference: [Endpoint Reference](#8-endpoint-reference) (`POST /api/programs/:id/undo`)

### Risk 9: Auto-Complete Active Instances

When creating a new program instance, the TS API auto-completes any existing active instance for the user. This is a side effect that happens BEFORE the insert. The Go implementation MUST replicate this behavior.

Cross-reference: [Endpoint Reference](#8-endpoint-reference) (`POST /api/programs`)

### Risk 10: Singleflight for Cache Misses

The TS API uses a singleflight pattern for `GET /programs/:id` and catalog operations. Without this, a cache miss under load causes a thundering herd of identical DB queries. Use `golang.org/x/sync/singleflight`.

Cross-reference: [Endpoint Reference](#8-endpoint-reference) (`GET /api/programs/:id`)

### Risk 11: CSP String Verbatim

The CSP header is a long, specific string with exact domain whitelist entries. A single character difference will break the frontend. Copy the string character-for-character.

Cross-reference: [Security Headers](#3-security-headers)

### Risk 12: Error Handler Priority

The TS error handler checks `instanceof ApiError` first, then Elysia's `NOT_FOUND`, `VALIDATION`, `PARSE` codes. In Go, there is no framework-level error code enum. The Go API MUST ensure custom errors take priority over generic 404/400 handling.

Cross-reference: [Error Response Format](#5-error-response-format)

### Risk 13: Presence Tracking Fire-and-Forget

Presence tracking MUST be fire-and-forget. If the Go implementation uses a synchronous Redis call, it will add latency to every authenticated request. Use a goroutine.

Cross-reference: [Background Jobs](#14-background-jobs)

### Risk 14: GET /auth/me Manual JWT Extraction

`GET /auth/me` does NOT use the standard `resolveUserId` guard. It manually extracts and verifies the JWT inline. This means the rate limit key is `userId` (from the JWT sub claim), not `ip`. The Go implementation MUST replicate this pattern.

Cross-reference: [Endpoint Reference](#8-endpoint-reference) (`GET /api/auth/me`)

### Risk 15: Fail-Open Rate Limiter

When Redis is unavailable, the rate limiter MUST allow all requests (fail-open). This is a deliberate design choice for availability. The Go implementation MUST NOT default to deny-all on Redis failure.

Cross-reference: [Rate Limiting](#6-rate-limiting)
