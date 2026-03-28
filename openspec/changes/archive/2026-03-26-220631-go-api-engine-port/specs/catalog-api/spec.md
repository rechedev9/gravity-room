# Delta Spec: Catalog API

**Change**: go-api-engine-port
**Date**: 2026-03-26
**Status**: draft
**Depends On**: proposal.md

---

## Context

`POST /api/catalog/preview` is the only auth-required endpoint in the catalog group. It is
currently unregistered in the Go API (returns 404). The TypeScript implementation lives in
`apps/api/src/routes/catalog.ts` and `apps/api/src/services/catalog.ts`.

The endpoint accepts a raw `ProgramDefinition` JSON object and an optional `config` map, runs
`ComputeGenericProgram` with empty results, and returns the first 10 rows. It is used by the
frontend to show users a preview of what workouts a program generates before they start it.

This spec covers:

- Route registration and auth enforcement
- Request/response contract
- Config resolution defaults
- Rate limiting
- Error response shapes

The Go port MUST be parity-compatible with the TypeScript implementation. Any response that the
TS API would produce, the Go API MUST also produce for the same input, and vice versa. This is
verified by the HTTP contract harness at `apps/harness/`.

---

## ADDED Requirements

### REQ-CATALOG-001: POST /api/catalog/preview route exists and requires auth

The Go API MUST register `POST /api/catalog/preview` in `internal/server/server.go` behind the
`mw.RequireAuth` middleware. The route MUST NOT be reachable without a valid access JWT. Any
request without a `Authorization: Bearer <token>` header containing a valid, non-expired JWT
MUST be rejected before the handler body executes.

The route MUST be registered within the `/api` prefix group alongside the existing catalog GET
routes, before those GET routes (consistent with the TS registration ordering).

#### Scenario: Route reachable at correct path · `code-based` · `critical`

```
WHEN POST /api/catalog/preview with valid auth and valid body
THEN HTTP 200
 (confirms the route is registered and not 404)
```

#### Scenario: Route rejects unauthenticated request · `code-based` · `critical`

```
WHEN POST /api/catalog/preview with no Authorization header
THEN HTTP 401
 AND body == { "error": "Unauthorized", "code": "UNAUTHORIZED" }
 AND Content-Type: application/json
```

#### Scenario: Route rejects expired/invalid JWT · `code-based` · `critical`

```
WHEN POST /api/catalog/preview
  AND Authorization: Bearer <tampered-or-expired-token>
THEN HTTP 401
 AND body contains "code": "UNAUTHORIZED"
```

---

### REQ-CATALOG-002: Valid request → 200 with GenericWorkoutRow[] (max 10 items)

A valid request MUST return HTTP 200 with a JSON array of `GenericWorkoutRow` objects. The array
MUST contain at most 10 items regardless of `definition.TotalWorkouts`. If
`definition.TotalWorkouts <= 10`, the array length MUST equal `totalWorkouts`.

The response body MUST be a JSON array (not wrapped in an object). Each element MUST conform to
the `GenericWorkoutRow` shape with all required fields present.

The Content-Type MUST be `application/json`.

#### Scenario: GZCLP definition returns exactly 10 rows · `code-based` · `critical`

```
GIVEN valid auth token
  AND body = {
    "definition": {
      "id": "gzclp",
      "name": "GZCLP",
      "description": "",
      "author": "Cody Lefever",
      "version": 1,
      "category": "strength",
      "source": "preset",
      "cycleLength": 4,
      "totalWorkouts": 90,
      "workoutsPerWeek": 3,
      "exercises": { "squat": { "name": "Sentadilla" }, ... },
      "configFields": [ { "key": "squat", "label": "Sentadilla", "type": "weight", "min": 2.5, "step": 2.5 }, ... ],
      "weightIncrements": { "squat": 5, "bench": 2.5, ... },
      "days": [ ... ]
    },
    "config": { "squat": 60, "bench": 40, "deadlift": 80, "ohp": 25, "latpulldown": 30, "dbrow": 30 }
  }
WHEN POST /api/catalog/preview
THEN HTTP 200
 AND Content-Type: application/json
 AND len(responseBody) == 10
 AND responseBody[0].index == 0
 AND responseBody[0].dayName == "Día 1"
 AND responseBody[0] conforms to GenericWorkoutRowSchema
```

#### Scenario: program with totalWorkouts=3 → 3 rows · `code-based` · `critical`

```
GIVEN valid auth
  AND body = {
    "definition": {
      "id": "test",
      "name": "Test",
      "description": "",
      "author": "test",
      "version": 1,
      "category": "test",
      "source": "preset",
      "cycleLength": 1,
      "totalWorkouts": 3,
      "workoutsPerWeek": 3,
      "exercises": { "ex": { "name": "Exercise" } },
      "configFields": [ { "key": "ex", "label": "Exercise", "type": "weight", "min": 0, "step": 2.5 } ],
      "weightIncrements": { "ex": 5 },
      "days": [ { "name": "Day 1", "slots": [ {
        "id": "slot1", "exerciseId": "ex", "tier": "t1",
        "stages": [ { "sets": 5, "reps": 3 } ],
        "onSuccess": { "type": "add_weight" },
        "onMidStageFail": { "type": "no_change" },
        "onFinalStageFail": { "type": "no_change" },
        "startWeightKey": "ex"
      } ] } ]
    },
    "config": {}
  }
WHEN POST /api/catalog/preview
THEN HTTP 200
 AND len(responseBody) == 3
```

#### Scenario: response rows have required fields present · `code-based` · `critical`

```
GIVEN valid GZCLP preview request as above
WHEN POST /api/catalog/preview
THEN for each row in responseBody:
  row.index is present (number)
  row.dayName is present (string)
  row.slots is present (array, len >= 1)
  row.isChanged is present (boolean)
  for each slot in row.slots:
    slot.slotId is present (string)
    slot.exerciseId is present (string)
    slot.exerciseName is present (string)
    slot.tier is present (string)
    slot.weight is present (number, may be 0)
    slot.stage is present (number, >= 0)
    slot.sets is present (number)
    slot.reps is present (number)
    slot.isAmrap is present (boolean)
    slot.stagesCount is present (number)
    slot.isChanged is present (boolean)
    slot.isDeload is present (boolean)
```

---

### REQ-CATALOG-003: Missing/invalid auth → 401

The server MUST return HTTP 401 with a JSON error body for any request where:

- The `Authorization` header is absent.
- The JWT is malformed (not a valid signed token).
- The JWT is expired.
- The JWT signature does not match the server's secret.

The error body MUST have the shape `{ "error": "<message>", "code": "UNAUTHORIZED" }`.
The `code` field value MUST be exactly `"UNAUTHORIZED"` (uppercase).

#### Scenario: No Authorization header → 401 · `code-based` · `critical`

```
WHEN POST /api/catalog/preview
  AND no Authorization header
THEN HTTP 401
 AND body.code == "UNAUTHORIZED"
```

#### Scenario: Malformed bearer token → 401 · `code-based` · `critical`

```
WHEN POST /api/catalog/preview
  AND Authorization: Bearer not.a.real.jwt
THEN HTTP 401
 AND body.code == "UNAUTHORIZED"
```

---

### REQ-CATALOG-004: Invalid definition → 422

When the `definition` field in the request body fails schema validation (e.g., missing required
fields, wrong types, invalid rule structure), the server MUST return HTTP 422 with a JSON error
body.

An empty object `{}` as the definition MUST be treated as invalid (missing required fields
`id`, `name`, `days`, `totalWorkouts`, etc.).

The error body MUST have the shape `{ "error": "<message>", "code": "VALIDATION_ERROR" }`.
The `code` field MUST be exactly `"VALIDATION_ERROR"`.

Validation MUST reject definitions structurally inconsistent with `ProgramDefinitionSchema`:

- Missing required top-level fields
- `days` with zero items
- `stages` with zero items in any slot
- Unknown `type` in any progression rule

#### Scenario: Empty definition object → 422 · `code-based` · `critical`

```
GIVEN valid auth
  AND body = { "definition": {} }
WHEN POST /api/catalog/preview
THEN HTTP 422
 AND body.code == "VALIDATION_ERROR"
 AND body.error is a non-empty string
```

#### Scenario: Definition with missing required field (no days) → 422 · `code-based` · `critical`

```
GIVEN valid auth
  AND body = { "definition": {
    "id": "test", "name": "Test", "description": "", "author": "test",
    "version": 1, "category": "test", "source": "preset",
    "cycleLength": 1, "totalWorkouts": 1, "workoutsPerWeek": 3,
    "exercises": {}, "configFields": [], "weightIncrements": {}
  } }
  (missing "days" field)
WHEN POST /api/catalog/preview
THEN HTTP 422
 AND body.code == "VALIDATION_ERROR"
```

#### Scenario: Definition with invalid rule type → 422 · `code-based` · `standard`

```
GIVEN valid auth
  AND body contains a slot with onSuccess.type = "unknown_rule"
WHEN POST /api/catalog/preview
THEN HTTP 422
 AND body.code == "VALIDATION_ERROR"
```

---

### REQ-CATALOG-005: Rate limit — 30 requests per hour per userId

The handler MUST enforce an in-process rate limit of 30 requests per hour (3,600 seconds) per
authenticated `userId`. The rate limit window MUST be a sliding window that resets when
`time.Since(windowStart) > time.Hour`.

When the 31st request within the window arrives, the server MUST return HTTP 429 with:
`{ "error": "<message>", "code": "RATE_LIMITED" }`.
The `code` field MUST be exactly `"RATE_LIMITED"`.

The rate limit MUST be keyed by `userId` (extracted from the JWT). Two different users sharing
the same IP MUST have independent rate limit counters.

Implementation MUST use a package-level `sync.Map` (no Redis dependency). The map stores a
record of `{count int, windowStart time.Time}` per `userId`.

#### Scenario: 30th request succeeds, 31st is rate limited · `code-based` · `critical`

```
GIVEN valid auth for userId "user-123"
  AND 30 prior valid requests have been made within the last hour
WHEN 31st POST /api/catalog/preview by userId "user-123"
THEN HTTP 429
 AND body.code == "RATE_LIMITED"
 AND body.error is a non-empty string
```

#### Scenario: Different userIds have independent counters · `code-based` · `standard`

```
GIVEN 30 requests made by userId "user-A"
  AND 0 requests by userId "user-B"
WHEN POST /api/catalog/preview by userId "user-B"
THEN HTTP 200
```

#### Scenario: Counter resets after window expires · `code-based` · `standard`

```
GIVEN 30 requests made by userId "user-123" at time T
  AND now > T + 1 hour
WHEN POST /api/catalog/preview by userId "user-123"
THEN HTTP 200
  (window has reset — new window starts at now)
```

---

### REQ-CATALOG-006: Config resolution — defaults when fields absent

The handler MUST resolve the incoming `config` map against the definition's `configFields` before
calling `ComputeGenericProgram`. The resolved config MUST supply a value for every config key
referenced by any slot, even when the caller's `config` map is absent or omits those keys.

Resolution rules, applied per `configField`:

- `type == "weight"`: use `config[field.key]` if present and numeric, else `0.0`.
- `type == "select"`: use `config[field.key]` if present and a string, else `field.options[0].value`.

The `config` field in the request body is optional. When omitted entirely, all weight fields
MUST default to `0.0` and all select fields MUST default to `options[0].value`.

The resolved config object passed to `ComputeGenericProgram` MUST contain only `number | string`
values. Array/object/boolean/null values in the raw `config` MUST be ignored (treated as missing).

#### Scenario: Absent config → all weight fields default to 0 · `code-based` · `critical`

```
GIVEN valid auth
  AND body = { "definition": <valid definition with weight configFields> }
  (no "config" key in body)
WHEN POST /api/catalog/preview
THEN HTTP 200
 AND rows[0].Slots[0].Weight == 0.0   (weight defaults to 0)
```

#### Scenario: Partial config → unspecified weight fields default to 0 · `code-based` · `critical`

```
GIVEN definition has configFields = [
    { "key": "squat", "type": "weight", ... },
    { "key": "bench", "type": "weight", ... }
  ]
  AND body.config = { "squat": 60 }  (bench omitted)
WHEN POST /api/catalog/preview
THEN the resolved config has squat=60.0 and bench=0.0
```

#### Scenario: Select field defaults to first option when absent · `code-based` · `critical`

```
GIVEN definition has configField =
  { "key": "variant", "type": "select", "options": [
      { "label": "Option A", "value": "a" },
      { "label": "Option B", "value": "b" }
    ] }
  AND body.config = {} (variant absent)
WHEN POST /api/catalog/preview
THEN resolved config has variant = "a"   (options[0].value)
```

#### Scenario: Object value in config treated as absent (ignored) · `code-based` · `standard`

```
GIVEN body.config = { "squat": { "value": 60 } }  (object, not number or string)
WHEN POST /api/catalog/preview
THEN resolved config treats squat as 0.0  (object value ignored)
```

---

### REQ-CATALOG-007: Response contains no more than 10 rows

The response array MUST be capped at 10 items. This MUST be enforced by slicing the
`ComputeGenericProgram` output to `rows[:min(10, len(rows))]` in `PreviewDefinition`.

A definition with `totalWorkouts > 10` MUST NOT return more than 10 rows. A definition with
`totalWorkouts <= 10` MUST return exactly `totalWorkouts` rows.

The `MAX_PREVIEW_ROWS` constant MUST be `10` (matching the TypeScript implementation).

#### Scenario: 90-workout program → exactly 10 rows · `code-based` · `critical`

```
GIVEN valid auth
  AND definition.totalWorkouts == 90  (e.g., GZCLP)
WHEN POST /api/catalog/preview
THEN len(responseBody) == 10
```

#### Scenario: 3-workout program → exactly 3 rows · `code-based` · `critical`

```
GIVEN valid auth
  AND definition.totalWorkouts == 3
WHEN POST /api/catalog/preview
THEN len(responseBody) == 3
```

#### Scenario: 10-workout program → exactly 10 rows · `code-based` · `standard`

```
GIVEN valid auth
  AND definition.totalWorkouts == 10
WHEN POST /api/catalog/preview
THEN len(responseBody) == 10
```

---

## Acceptance Criteria Summary

| Requirement ID  | Type              | Priority | Scenarios |
| --------------- | ----------------- | -------- | --------- |
| REQ-CATALOG-001 | Functional / Auth | Must     | 3         |
| REQ-CATALOG-002 | Functional        | Must     | 3         |
| REQ-CATALOG-003 | Auth              | Must     | 2         |
| REQ-CATALOG-004 | Validation        | Must     | 3         |
| REQ-CATALOG-005 | Rate Limiting     | Must     | 3         |
| REQ-CATALOG-006 | Config Resolution | Must     | 4         |
| REQ-CATALOG-007 | Output Capping    | Must     | 3         |

---

## Eval Definitions

| Scenario                                      | Eval Type  | Criticality | Threshold |
| --------------------------------------------- | ---------- | ----------- | --------- |
| Route reachable at correct path               | code-based | critical    | Pass      |
| Route rejects unauthenticated request         | code-based | critical    | Pass      |
| Route rejects expired/invalid JWT             | code-based | critical    | Pass      |
| GZCLP definition returns exactly 10 rows      | code-based | critical    | Pass      |
| program totalWorkouts=3 returns 3 rows        | code-based | critical    | Pass      |
| response rows have required fields present    | code-based | critical    | Pass      |
| No Authorization header → 401                 | code-based | critical    | Pass      |
| Malformed bearer token → 401                  | code-based | critical    | Pass      |
| Empty definition object → 422                 | code-based | critical    | Pass      |
| Missing required field (no days) → 422        | code-based | critical    | Pass      |
| Invalid rule type → 422                       | code-based | standard    | Pass      |
| 30th request succeeds, 31st rate limited      | code-based | critical    | Pass      |
| Different userIds have independent counters   | code-based | standard    | Pass      |
| Counter resets after window expires           | code-based | standard    | Pass      |
| Absent config → weight fields default 0       | code-based | critical    | Pass      |
| Partial config → unspecified fields default 0 | code-based | critical    | Pass      |
| Select field defaults to first option         | code-based | critical    | Pass      |
| Object value in config ignored                | code-based | standard    | Pass      |
| 90-workout program → 10 rows                  | code-based | critical    | Pass      |
| 3-workout program → 3 rows                    | code-based | critical    | Pass      |
| 10-workout program → 10 rows                  | code-based | standard    | Pass      |
