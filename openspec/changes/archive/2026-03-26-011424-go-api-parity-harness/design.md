---
summary: Technical design for apps/harness — HTTP contract test suite using bun:test, native fetch, Zod strict schemas, and manual cookie jar.
read_when: Implementing the go-api-parity-harness change or reviewing its architecture.
---

# Design: go-api-parity-harness

**Change**: go-api-parity-harness
**Date**: 2026-03-26
**Status**: draft
**Depends On**: proposal.md, specs/spec.md, exploration.md

---

## 1. Directory Structure

```
apps/harness/
├── package.json
├── tsconfig.json
├── src/
│   ├── helpers/
│   │   ├── client.ts          # createClient(), authFetch(), BASE_URL resolution
│   │   ├── cookie-jar.ts      # CookieJar class — parse Set-Cookie, replay Cookie
│   │   ├── seed.ts            # seedUser(), createTestProgram(), seedResult()
│   │   └── assertions.ts      # expectISODate(), expectKeys(), expectErrorShape()
│   ├── schemas/
│   │   ├── auth.ts            # UserResponseSchema, AuthResponseSchema, RefreshResponseSchema
│   │   ├── programs.ts        # ProgramInstanceResponseSchema, ProgramListResponseSchema, ExportResponseSchema, ImportResponseSchema
│   │   ├── results.ts         # ResultEntrySchema, UndoResponseSchema
│   │   ├── catalog.ts         # CatalogListResponseSchema, CatalogDetailResponseSchema
│   │   ├── exercises.ts       # ExerciseListResponseSchema, MuscleGroupsResponseSchema, CreateExerciseResponseSchema
│   │   ├── program-definitions.ts  # ProgramDefinitionResponseSchema, ProgramDefinitionListResponseSchema
│   │   ├── system.ts          # HealthResponseSchema, StatsOnlineResponseSchema
│   │   └── error.ts           # ErrorResponseSchema
│   └── tests/
│       ├── auth.test.ts
│       ├── programs.test.ts
│       ├── results.test.ts
│       ├── catalog.test.ts
│       ├── exercises.test.ts
│       ├── program-definitions.test.ts
│       └── system.test.ts
```

No files outside `apps/harness/` are created or modified. The root `package.json` workspaces glob `"apps/*"` already covers this path — no root manifest change required.

---

## 2. Module Design

### 2.1 `src/helpers/client.ts`

**Responsibility**: HTTP transport layer. Resolves paths against `BASE_URL`, injects auth headers, integrates cookie jar.

```typescript
// Exports
export const BASE_URL: string; // process.env.BASE_URL ?? 'http://localhost:3001'

export function createClient(): HarnessClient;

export interface HarnessClient {
  readonly jar: CookieJar;
  get(path: string, options?: RequestOptions): Promise<Response>;
  post(path: string, body?: unknown, options?: RequestOptions): Promise<Response>;
  patch(path: string, body?: unknown, options?: RequestOptions): Promise<Response>;
  put(path: string, body?: unknown, options?: RequestOptions): Promise<Response>;
  delete(path: string, options?: RequestOptions): Promise<Response>;
}

interface RequestOptions {
  accessToken?: string;
  headers?: Record<string, string>;
}
```

**Implementation details**:

- Each method resolves `path` against `BASE_URL` via `new URL(path, BASE_URL)`.
- If `accessToken` is provided, sets `Authorization: Bearer <token>`.
- Before sending, calls `jar.getCookieHeader(url)` and sets the `Cookie` header if non-empty.
- After receiving, calls `jar.captureFromResponse(url, response)` to store any `Set-Cookie` headers.
- POST/PATCH/PUT set `Content-Type: application/json` and `JSON.stringify(body)` when body is provided.
- Uses native `fetch` — zero external HTTP dependencies.

**Imports**: `CookieJar` from `./cookie-jar.ts`.

### 2.2 `src/helpers/cookie-jar.ts`

**Responsibility**: Minimal cookie storage with path-scoped replay.

```typescript
export class CookieJar {
  // Store: Map<cookieName, Cookie>
  captureFromResponse(url: URL, response: Response): void;
  getCookieHeader(url: URL): string; // "name=value; name2=value2" or ""
  getCookie(name: string): Cookie | undefined;
  clear(): void;
}

export interface Cookie {
  readonly name: string;
  readonly value: string;
  readonly path: string; // defaults to "/"
  readonly httpOnly: boolean; // defaults to false
  readonly secure: boolean; // defaults to false
  readonly sameSite: string; // "Strict" | "Lax" | "None" | ""
  readonly maxAge: number | null; // seconds, null if not set
}
```

**Implementation details**:

- Uses `response.headers.getSetCookie()` (standard Web API, supported in Bun) to get individual `Set-Cookie` header strings. This handles multiple cookies on a single response correctly.
- Parses each `Set-Cookie` string by splitting on `;`, trimming each part. The first segment is `name=value`; subsequent segments are attributes (`Path=...`, `HttpOnly`, `Secure`, `SameSite=...`, `Max-Age=...`).
- Attribute parsing is case-insensitive on attribute names (`httponly` matches `HttpOnly`).
- `getCookieHeader(url)` filters stored cookies by path: a cookie with `path=/api/auth` matches URLs whose pathname starts with `/api/auth`. Returns only matching cookies joined with `; `.
- `maxAge=0` cookies are treated as expired and excluded from `getCookieHeader()` output but remain queryable via `getCookie()` for assertion purposes (REQ-HARNESS-009 signout test needs to inspect the expired cookie).

**No imports** from other harness modules.

### 2.3 `src/helpers/seed.ts`

**Responsibility**: Test user/program creation via HTTP endpoints.

```typescript
export interface SeededUser {
  readonly email: string;
  readonly userId: string;
  readonly accessToken: string;
  readonly client: HarnessClient; // pre-configured with populated cookie jar
}

export async function seedUser(): Promise<SeededUser>;
export async function createTestProgram(
  accessToken: string,
  client: HarnessClient
): Promise<string>;
export async function seedResult(
  client: HarnessClient,
  accessToken: string,
  programId: string,
  workoutIndex: number,
  slotId: string,
  result: string,
  extras?: { amrapReps?: number; rpe?: number; setLogs?: unknown[] }
): Promise<Response>;
```

**Implementation details**:

- `seedUser()` creates a fresh `HarnessClient`, generates `harness-<crypto.randomUUID()>@test.local`, calls `POST /api/auth/dev` with `{ email }`. Parses the response to extract `user.id`, `accessToken`. The client's cookie jar captures the `refresh_token` cookie automatically.
- `createTestProgram()` calls `POST /api/programs` with `{ programId: 'gzclp', name: 'Harness Test', config: DEFAULT_WEIGHTS }`. Returns the `id` from the response body.
- `seedResult()` calls `POST /api/programs/:id/results`. Returns the raw `Response` for tests that need to inspect it.
- `DEFAULT_WEIGHTS` is defined inline (same values as `apps/web/e2e/helpers/fixtures.ts`) — no import from `apps/web`.

**Imports**: `createClient`, `HarnessClient` from `./client.ts`.

### 2.4 `src/helpers/assertions.ts`

**Responsibility**: Reusable assertion helpers shared across all test files.

```typescript
export const ISO_DATE_REGEX: RegExp; // /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
export const UUID_V4_REGEX: RegExp; // /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function expectISODate(value: string): void; // expect(value).toMatch(ISO_DATE_REGEX)
export function expectUUID(value: string): void; // expect(value).toMatch(UUID_V4_REGEX)
export function expectKeys(obj: unknown, keys: string[]): void; // expect(Object.keys(obj).sort()).toEqual(keys)
export function expectCursor(cursor: string): void; // split at lastIndexOf('_'), validate ISO + UUID parts
export function expectErrorShape(body: unknown): void; // parse against ErrorResponseSchema + key enumeration
export function expectEmpty204(response: Response): Promise<void>; // status 204 + text === ""
```

**Imports**: `ErrorResponseSchema` from `../schemas/error.ts`, `expect` from `bun:test`.

---

## 3. Schema Architecture

### 3.1 Principles

- Every schema uses `.strict()` — rejects unexpected keys at parse time.
- Each schema file begins with a comment citing the contract section: `// http-contract.md §N`.
- Schemas define the _response_ shape only, not request bodies.
- Nullable-always-present fields use `z.string().nullable()` (no `.optional()`).
- Omitted-when-null fields use `z.number().optional()` (the key may be absent).
- Timestamp fields use `z.string().regex(ISO_DATE_REGEX)` where `ISO_DATE_REGEX` is imported from `assertions.ts`.
- JSONB pass-through fields (`config`, `metadata`, `definition`, `customDefinition`) use `z.unknown()` — structural validation of their contents is out of scope.

### 3.2 Schema Definitions by Route Group

**`src/schemas/error.ts`** — (http-contract.md §5)

```typescript
export const ErrorResponseSchema = z
  .object({
    error: z.string(),
    code: z.string(),
  })
  .strict();
```

**`src/schemas/auth.ts`** — (http-contract.md §3, §9)

```typescript
export const UserResponseSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    createdAt: z.string().regex(ISO_DATE_REGEX),
    updatedAt: z.string().regex(ISO_DATE_REGEX),
  })
  .strict();

export const AuthResponseSchema = z
  .object({
    user: UserResponseSchema,
    accessToken: z.string(),
  })
  .strict();

export const RefreshResponseSchema = z
  .object({
    accessToken: z.string(),
  })
  .strict();
```

**`src/schemas/programs.ts`** — (http-contract.md §4, §9, §10)

The `ResultEntrySchema` uses `.passthrough()` for the inner slot map values because result entries have omitted-when-null fields (`amrapReps`, `rpe`, `setLogs`). A strict schema cannot express "these keys may or may not exist." Instead, the test layer combines a lenient parse with explicit key enumeration assertions.

```typescript
const ResultEntrySchema = z
  .object({
    result: z.string(),
    amrapReps: z.number().optional(),
    rpe: z.number().optional(),
    setLogs: z.array(z.unknown()).optional(),
  })
  .strict();

// results map: Record<workoutIndex, Record<slotId, ResultEntry>>
const ResultsMapSchema = z.record(z.string(), z.record(z.string(), ResultEntrySchema));

const UndoEntrySchema = z
  .object({
    i: z.number(),
    slotId: z.string(),
    prev: z.string().optional(),
    prevRpe: z.number().optional(),
    prevAmrapReps: z.number().optional(),
    prevSetLogs: z.array(z.unknown()).optional(),
  })
  .strict();

export const ProgramInstanceResponseSchema = z
  .object({
    id: z.string(),
    programId: z.string(),
    name: z.string(),
    config: z.unknown(),
    metadata: z.unknown().nullable(),
    status: z.string(),
    results: ResultsMapSchema,
    undoHistory: z.array(UndoEntrySchema),
    resultTimestamps: z.record(z.string(), z.string()),
    completedDates: z.record(z.string(), z.string()),
    definitionId: z.string().nullable(),
    customDefinition: z.unknown().nullable(),
    createdAt: z.string().regex(ISO_DATE_REGEX),
    updatedAt: z.string().regex(ISO_DATE_REGEX),
  })
  .strict();

export const ProgramListResponseSchema = z
  .object({
    programs: z.array(ProgramInstanceResponseSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();

export const ExportResponseSchema = z
  .object({
    programId: z.string(),
    name: z.string(),
    config: z.unknown(),
    results: ResultsMapSchema,
  })
  .strict();

export const ImportResponseSchema = z
  .object({
    imported: z.number(),
  })
  .strict();
```

**`src/schemas/results.ts`** — (http-contract.md §4)

```typescript
// POST results returns the full ProgramInstanceResponse — reuse from programs.ts
export { ProgramInstanceResponseSchema as ResultResponseSchema } from './programs';

export const UndoResponseSchema = z
  .object({
    i: z.number(),
    slotId: z.string(),
    prev: z.string().optional(),
    prevRpe: z.number().optional(),
    prevAmrapReps: z.number().optional(),
    prevSetLogs: z.array(z.unknown()).optional(),
  })
  .strict();
```

**`src/schemas/catalog.ts`** — (http-contract.md §6, §8)

```typescript
const CatalogEntrySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    author: z.string(),
    tags: z.array(z.string()),
  })
  .strict();

export const CatalogListResponseSchema = z.array(CatalogEntrySchema);

export const CatalogDetailResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    author: z.string(),
    tags: z.array(z.string()),
    definition: z.unknown(),
  })
  .strict();
```

> Note: The exact catalog shapes will be verified against the live TS API during implementation. The schemas above are derived from contract §6 but may need field adjustments once grounded against actual responses.

**`src/schemas/exercises.ts`** — (http-contract.md §4, §9)

```typescript
const ExerciseEntrySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    primaryMuscles: z.array(z.string()),
    secondaryMuscles: z.array(z.string()).nullable(),
    equipment: z.string().nullable(),
    force: z.string().nullable(),
    level: z.string().nullable(),
    mechanic: z.string().nullable(),
    category: z.string().nullable(),
    createdBy: z.string().nullable(),
  })
  .strict();

export const ExerciseListResponseSchema = z
  .object({
    exercises: z.array(ExerciseEntrySchema),
    total: z.number(),
    offset: z.number(),
    limit: z.number(),
  })
  .strict();

export const MuscleGroupsResponseSchema = z.array(z.string());

export const CreateExerciseResponseSchema = ExerciseEntrySchema;
```

**`src/schemas/program-definitions.ts`** — (http-contract.md §4, §9)

```typescript
const ProgramDefinitionResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    definition: z.unknown(),
    isPublic: z.boolean(),
    createdBy: z.string(),
    deletedAt: z.string().nullable(),
    createdAt: z.string().regex(ISO_DATE_REGEX),
    updatedAt: z.string().regex(ISO_DATE_REGEX),
  })
  .strict();

export const ProgramDefinitionListResponseSchema = z.array(ProgramDefinitionResponseSchema);
export { ProgramDefinitionResponseSchema };
```

**`src/schemas/system.ts`** — (http-contract.md §11)

```typescript
export const HealthResponseSchema = z
  .object({
    status: z.string(),
    timestamp: z.string().regex(ISO_DATE_REGEX),
    uptime: z.number(),
    db: z.string(),
    redis: z.string(),
  })
  .strict();

export const StatsOnlineResponseSchema = z
  .object({
    count: z.number().nullable(),
  })
  .strict();
```

### 3.3 Key Enumeration Strategy

Key enumeration (`Object.keys(body).sort()`) is applied as a separate assertion _after_ Zod parse succeeds, on these high-risk shapes:

| Shape                                           | Expected sorted keys                                                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User` (from `/auth/me`)                        | `["avatarUrl", "createdAt", "email", "id", "name", "updatedAt"]`                                                                                                                            |
| `ProgramInstanceResponse`                       | `["completedDates", "config", "createdAt", "customDefinition", "definitionId", "id", "metadata", "name", "programId", "results", "resultTimestamps", "status", "undoHistory", "updatedAt"]` |
| Error response                                  | `["code", "error"]`                                                                                                                                                                         |
| `UndoEntry` (base keys when no optional fields) | `["i", "slotId"]` minimum; optional keys verified via `"key" in body === false`                                                                                                             |
| Result entry (base)                             | `["result"]` minimum; optional keys verified via absence                                                                                                                                    |

The `expectKeys()` helper in `assertions.ts` handles the `Object.keys().sort()` + `toEqual()` pattern.

---

## 4. Test File Structure

### 4.1 Naming Convention

One file per route group: `src/tests/<group>.test.ts`. Group names match `src/schemas/<group>.ts`.

### 4.2 Setup / Teardown Pattern

```typescript
// src/tests/auth.test.ts
import { describe, it, expect, beforeAll } from 'bun:test';
import { seedUser, type SeededUser } from '../helpers/seed';
import { AuthResponseSchema, UserResponseSchema } from '../schemas/auth';
import { expectISODate, expectKeys, expectErrorShape, expectEmpty204 } from '../helpers/assertions';

describe('auth', () => {
  let user: SeededUser;

  beforeAll(async () => {
    user = await seedUser();
  });

  describe('POST /api/auth/dev', () => {
    it('returns valid AuthResponse shape', async () => {
      // seedUser() already called this; call again for shape assertion
      const fresh = await seedUser();
      const res = await fresh.client.post('/api/auth/dev', { email: fresh.email });
      // ... (this re-calls, but seedUser gives us everything we need)
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns valid UserResponse shape', async () => {
      const res = await user.client.get('/api/auth/me', { accessToken: user.accessToken });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(UserResponseSchema.safeParse(body).success).toBe(true);
      expectKeys(body, ['avatarUrl', 'createdAt', 'email', 'id', 'name', 'updatedAt']);
    });

    it('user.name is present with null value', async () => {
      const res = await user.client.get('/api/auth/me', { accessToken: user.accessToken });
      const body = await res.json();
      expect('name' in body).toBe(true);
      expect(body.name).toBeNull();
    });

    it('timestamps have exactly 3 fractional digits', async () => {
      const res = await user.client.get('/api/auth/me', { accessToken: user.accessToken });
      const body = await res.json();
      expectISODate(body.createdAt);
      expectISODate(body.updatedAt);
    });
  });

  describe('GET /api/auth/me — unauthenticated', () => {
    it('returns 401 with exact error shape', async () => {
      const res = await user.client.get('/api/auth/me'); // no accessToken
      expect(res.status).toBe(401);
      const body = await res.json();
      expectErrorShape(body);
      expectKeys(body, ['code', 'error']);
      expect(body.code).toBe('UNAUTHORIZED');
    });
  });
});
```

### 4.3 Isolation Pattern

- **Per-file user**: each test file calls `seedUser()` in `beforeAll`. This creates a unique user with `harness-<uuid>@test.local`. No shared users across files.
- **Per-test mutations**: tests that create programs or submit results do so against the file's own user. Deletion tests create their own resources before deleting.
- **No file ordering dependency**: `bun test` can run files in any order or in parallel. The `package.json` `test` script runs `bun test src/tests/` without ordering constraints.
- **No `afterAll` cleanup**: seeded users are abandoned. DB cleanup is a server-side concern (test DB reset between CI runs, not between test files).

### 4.4 Test Mapping to Requirements

| Test File                     | Requirements Covered                                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.test.ts`                | REQ-003 (seed), REQ-004 (auth schemas), REQ-005 (User keys), REQ-006 (null-vs-omit User), REQ-007 (dates), REQ-009 (cookie attrs), REQ-011 (error shape), REQ-012 (signout 204)        |
| `programs.test.ts`            | REQ-004 (program schemas), REQ-005 (ProgramInstance keys), REQ-006 (empty collections, null fields), REQ-007 (dates), REQ-008 (cursor), REQ-011 (404/400 errors), REQ-012 (delete 204) |
| `results.test.ts`             | REQ-004 (result schemas), REQ-005 (result entry keys, undo keys), REQ-006 (omit amrapReps/rpe/setLogs, undo omit prevRpe/prevAmrapReps), REQ-007 (dates), REQ-012 (delete result 204)  |
| `catalog.test.ts`             | REQ-004 (catalog schemas), REQ-010 (Cache-Control exact match)                                                                                                                         |
| `exercises.test.ts`           | REQ-004 (exercise schemas), REQ-006 (nullable exercise fields)                                                                                                                         |
| `program-definitions.test.ts` | REQ-004 (definition schemas), REQ-006 (deletedAt nullable), REQ-007 (dates), REQ-012 (delete 204)                                                                                      |
| `system.test.ts`              | REQ-015 (health shape), REQ-016 (stats online)                                                                                                                                         |

REQ-001 (workspace structure) is verified structurally — the workspace existing and tests running proves it.
REQ-002 (HTTP client) is exercised by every test.
REQ-013 (test isolation) is verified by the parallel-safe seedUser pattern.
REQ-014 (CI lifecycle) is handled by `package.json` scripts + preload.

---

## 5. CI Integration

### 5.1 `apps/harness/package.json`

```json
{
  "name": "harness",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "bun test src/tests/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/bun": "^1.3.9",
    "typescript": "^5.9.3"
  }
}
```

### 5.2 `apps/harness/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["bun-types"]
  },
  "include": ["src"]
}
```

### 5.3 Monorepo Wiring

The root `package.json` has `"workspaces": ["apps/*", "packages/*"]`. Adding `apps/harness/` with a `package.json` makes it a workspace automatically. The root scripts use `--filter '*'`:

- `bun run test` → runs `bun run --filter '*' test` → includes harness.
- `bun run typecheck` → runs `bun run --filter '*' typecheck` → includes harness.

No root `package.json` modification needed. The harness is picked up by the existing glob.

### 5.4 Server Lifecycle for CI

The harness does **not** manage server lifecycle itself. Instead, it follows the same pattern as the existing test pipeline:

- **Local dev**: developer starts the API with `bun run dev:api`, then runs `bun run --filter harness test`.
- **CI**: the CI pipeline starts the API server before running harness tests. This can be a `pretest` script or a CI job step. The harness includes a health-check wait in a preload file.

**`src/preload.ts`** — registered via `bunfig.toml`:

```typescript
// Waits for the server to be ready before tests run.
// In local dev (no CI env), assumes server is already running.
const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:3001';
const MAX_WAIT_MS = 30_000;
const POLL_INTERVAL_MS = 500;

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {
      // Server not up yet
    }
    await Bun.sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Server at ${BASE_URL} did not become healthy within ${MAX_WAIT_MS}ms`);
}

await waitForServer();
```

**`apps/harness/bunfig.toml`**:

```toml
[test]
preload = ["./src/preload.ts"]
```

This ensures every `bun test` invocation in the harness waits for the server before running any test file.

### 5.5 CI Job Structure (conceptual)

```yaml
# In existing CI pipeline, add a step after API is running:
- name: Run harness tests
  env:
    BASE_URL: http://localhost:3001
    NODE_ENV: development
  run: bun run --filter harness test
```

The harness does NOT start or stop the server. The CI pipeline is responsible for ensuring a running API with `NODE_ENV=development` and a seeded PostgreSQL database.

---

## 6. Dependency Diagram

```
apps/harness/
│
├── src/tests/*.test.ts
│   ├── imports from: src/helpers/seed.ts
│   ├── imports from: src/helpers/assertions.ts
│   ├── imports from: src/schemas/*.ts
│   └── imports from: bun:test
│
├── src/helpers/seed.ts
│   ├── imports from: src/helpers/client.ts
│   └── uses: crypto.randomUUID() (global)
│
├── src/helpers/client.ts
│   └── imports from: src/helpers/cookie-jar.ts
│
├── src/helpers/assertions.ts
│   ├── imports from: src/schemas/error.ts
│   └── imports from: bun:test (expect)
│
├── src/schemas/*.ts
│   └── imports from: zod
│   └── imports from: src/helpers/assertions.ts (ISO_DATE_REGEX only)
│
└── src/preload.ts
    └── imports from: nothing (standalone)
```

**External dependencies**: `zod` (npm). That's it.

**No imports from**:

- `apps/api/` — zero. The harness is a pure HTTP black box.
- `apps/web/` — zero.
- `packages/shared/` — zero. Schemas are authored independently from contract, not from shared types. This is intentional: the harness must validate what the server _actually sends_, not what the shared types _declare_.

---

## 7. Design Decisions

### D1: Why not import schemas from `@gzclp/shared`?

The shared package defines TypeScript types for the engine's internal computation. The harness needs to validate _serialized HTTP responses_, including serialization-specific concerns (ISO date format, null-vs-omit, key casing) that TypeScript types cannot express. Independent Zod schemas authored from `http-contract.md` are the correct tool.

### D2: Why `HarnessClient` returns raw `Response` instead of parsed JSON?

Tests need access to `response.status`, `response.headers`, and `response.text()` for 204 assertions. Returning raw `Response` gives tests full control. Each test calls `await res.json()` only when it needs the body.

### D3: Why no `afterAll` cleanup?

Seeded users use random UUIDs. They don't collide and don't accumulate meaningful state. The test database is reset between CI runs at the infrastructure level. Adding cleanup would introduce unnecessary delete calls that could themselves fail and obscure real test failures.

### D4: Why a preload for health-check instead of a `webServer` block?

`bun:test` has no built-in `webServer` lifecycle config like Playwright. The preload file is the idiomatic Bun way to run setup before all tests. It's simpler than a custom test runner wrapper.

### D5: CookieJar `maxAge=0` handling

Expired cookies (from signout) are kept in storage but excluded from `getCookieHeader()` output. This lets `auth.test.ts` inspect the cookie attributes after signout (REQ-HARNESS-009) while correctly not replaying them on subsequent requests.

---

## 8. Implementation Order

1. **`cookie-jar.ts`** — zero deps, unit-testable in isolation
2. **`client.ts`** — depends on cookie-jar
3. **`schemas/error.ts`** + **`assertions.ts`** — depend on zod, bun:test
4. **`schemas/auth.ts`** + **`seed.ts`** — depend on client, assertions
5. **`preload.ts`** + **`bunfig.toml`** + **`package.json`** + **`tsconfig.json`** — workspace scaffolding
6. **`tests/system.test.ts`** — simplest test, validates server is reachable
7. **`tests/auth.test.ts`** — validates seeding works, cookie assertions
8. **`tests/programs.test.ts`** — most complex shape, cursor pagination
9. **`tests/results.test.ts`** — omit-when-null assertions
10. **`tests/catalog.test.ts`** — Cache-Control header assertions
11. **`tests/exercises.test.ts`** — nullable field assertions
12. **`tests/program-definitions.test.ts`** — admin-scoped, deletedAt nullable

Each step is independently committable and testable.
