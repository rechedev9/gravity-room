# Delta Spec: Contract Structure

**Change**: go-api-migration-contract
**Date**: 2026-03-26
**Status**: draft
**Depends On**: proposal.md

---

## Context

Defines the required structure, format, and organization of the HTTP contract oracle document (`openspec/contract/http-contract.md`). This document is the single source of truth for all Go migration lotes. Its structure must be consistent, navigable, and machine-auditable.

## ADDED Requirements

### REQ-CS-001: Document Location and Format

The contract document MUST be a single Markdown file at `openspec/contract/http-contract.md`. The `openspec/contract/` directory MUST be created if it does not exist.

#### Scenario: File exists at correct path · `code-based` · `critical`

- **WHEN** the contract document is produced
- **THEN** it MUST exist at `openspec/contract/http-contract.md` and MUST NOT be split across multiple files

### REQ-CS-002: YAML Front-matter

The document MUST begin with YAML front-matter containing exactly two fields: `summary` and `read_when`, per the project docs convention.

#### Scenario: Front-matter present and valid · `code-based` · `critical`

- **WHEN** the document is parsed
- **THEN** it MUST contain a YAML block delimited by `---` with non-empty `summary` and `read_when` string fields

### REQ-CS-003: Document Header

The document MUST include a header section immediately after front-matter containing: document title, change ID (`go-api-migration-contract`), the pinned source commit SHA (`bef5a51`), the source branch (`go-api`), and the date of capture.

#### Scenario: Pinned commit SHA present · `code-based` · `critical`

- **WHEN** a reader checks the document header
- **THEN** it MUST contain the exact commit SHA `bef5a51` so any TS changes after this commit trigger a contract amendment

### REQ-CS-004: Normative Language

All behavioral requirements in the contract MUST use RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) in uppercase. Descriptive or explanatory text MUST NOT use these keywords in uppercase unless conveying a normative requirement.

#### Scenario: Normative keyword usage · `human-review` · `critical`

- **WHEN** a reviewer reads any requirement sentence
- **THEN** the sentence MUST use RFC 2119 keywords to distinguish mandatory from optional behavior

### REQ-CS-005: Required Top-Level Sections

The document MUST contain the following top-level sections in order:

1. Server Configuration
2. CORS Configuration
3. Security Headers
4. Request Logger & Request ID
5. Error Response Format (with full error code inventory)
6. Rate Limiting (with per-endpoint table)
7. Auth Contract (JWT, refresh token, Google OAuth)
8. Endpoint Reference (all 28+ endpoints, grouped by route group)
9. JSON Serialization Rules (with null-vs-omit table)
10. Cursor Pagination
11. Prometheus Metrics
12. Redis Key Space
13. Request/Response Header Inventory
14. Background Jobs
15. Environment Variable Table
16. SPA Serving
17. Risks & Go Implementation Pitfalls

#### Scenario: All sections present · `code-based` · `critical`

- **WHEN** the document section headings are extracted
- **THEN** all 17 sections listed above MUST be present as distinct headings

### REQ-CS-006: Cross-Reference Anchors

Each section MUST use a Markdown heading that can serve as an anchor link. The Risks section MUST cross-reference the relevant contract section for each risk entry using Markdown anchor links.

#### Scenario: Risk cross-references resolve · `code-based` · `important`

- **WHEN** each risk entry references a contract section
- **THEN** the referenced heading anchor MUST exist elsewhere in the document

### REQ-CS-007: VERIFY Annotations

Any behavioral detail in the contract that was derived from inference rather than direct source reading MUST be annotated with `[VERIFY]` inline. The exploration document's use of "likely", "unclear", or similar hedging language MUST be resolved against the source or flagged with `[VERIFY]`.

#### Scenario: No unresolved ambiguity without annotation · `human-review` · `critical`

- **WHEN** the contract states a behavioral requirement
- **THEN** it MUST either be verified against the TS source at the pinned commit or be marked `[VERIFY]`

### REQ-CS-008: Source File Citations

When the contract specifies an exact value (CSP string, cookie maxAge, regex pattern, environment variable default), it SHOULD cite the source file and line from the TS codebase to enable future auditing.

#### Scenario: Exact values cite source · `human-review` · `important`

- **WHEN** an exact literal value is specified
- **THEN** it SHOULD include a parenthetical source citation (e.g., `(src/create-app.ts:42)`)

## Acceptance Criteria Summary

| ID         | Criterion                                            | Eval         |
| ---------- | ---------------------------------------------------- | ------------ |
| REQ-CS-001 | Single file at `openspec/contract/http-contract.md`  | code-based   |
| REQ-CS-002 | Valid YAML front-matter with `summary` + `read_when` | code-based   |
| REQ-CS-003 | Header contains pinned commit SHA `bef5a51`          | code-based   |
| REQ-CS-004 | RFC 2119 normative keywords used consistently        | human-review |
| REQ-CS-005 | All 17 top-level sections present                    | code-based   |
| REQ-CS-006 | Risk cross-references resolve to valid anchors       | code-based   |
| REQ-CS-007 | Ambiguities flagged with `[VERIFY]`                  | human-review |
| REQ-CS-008 | Exact values cite TS source file/line                | human-review |

## Eval Definitions

| Eval Type      | Method                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| `code-based`   | Automated check: parse document, verify file location, front-matter fields, section headings, anchor resolution |
| `human-review` | Manual reading by reviewer to confirm normative language, VERIFY annotations, and source citations              |

# Delta Spec: Endpoint Contract

**Change**: go-api-migration-contract
**Date**: 2026-03-26
**Status**: draft
**Depends On**: proposal.md

---

## Context

Defines what information the contract document MUST capture for each HTTP endpoint. The TS API exposes 28+ endpoints across 6 route groups plus system routes. Each endpoint specification must be complete enough for a Go implementor to reproduce its behavior without consulting the TS source.

## ADDED Requirements

### REQ-EP-001: Endpoint Inventory Completeness

The contract MUST document every HTTP endpoint exposed by the TS API at commit `bef5a51`. The minimum set includes:

**Auth** (`/api/auth`): `POST /google`, `POST /dev`, `POST /refresh`, `POST /signout`, `GET /me`, `PATCH /me`, `DELETE /me`

**Programs** (`/api/programs`): `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `PATCH /:id/metadata`, `DELETE /:id`, `GET /:id/export`, `POST /import`

**Results** (`/api/programs/:id`): `POST /results`, `DELETE /results/:workoutIndex/:slotId`, `POST /undo`

**Catalog** (`/api/catalog`): `GET /`, `GET /:programId`, `POST /preview`

**Exercises** (`/api/exercises`, `/api/muscle-groups`): `GET /exercises`, `POST /exercises`, `GET /muscle-groups`

**Program Definitions** (`/api/program-definitions`): `POST /`, `GET /`, `POST /fork`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `PATCH /:id/status`

**Stats**: `GET /api/stats/online`

**System**: `GET /health`, `GET /metrics`

#### Scenario: All endpoints present · `code-based` · `critical`

- **WHEN** the endpoint reference section is parsed
- **THEN** every endpoint listed above MUST have a dedicated subsection

### REQ-EP-002: Per-Endpoint Required Fields

Each endpoint subsection MUST include all of the following fields:

1. **HTTP method and full path** (including `/api` prefix)
2. **Auth requirement**: one of "none", "required (Bearer token)", "optional (different behavior when authenticated)", or "cookie-based (refresh_token)"
3. **Rate limit**: window (ms), max requests, and key identity; or explicit "none" if no rate limiting
4. **Request body shape**: JSON schema or "empty/none"; including field types, constraints (min/max length, ranges, enums), and optionality
5. **Query parameters**: name, type, default, constraints; or "none"
6. **Path parameters**: name and type; or "none"
7. **Response body shape per status code**: exact JSON structure with field types
8. **All possible HTTP status codes** returned by the endpoint
9. **All possible error codes** (the `code` field in error responses)
10. **Side effects**: cookie mutations, cache invalidation, background jobs, DB cascades; or "none"

#### Scenario: Endpoint has all required fields · `human-review` · `critical`

- **WHEN** a reviewer checks any endpoint subsection
- **THEN** all 10 fields listed above MUST be present and non-empty

### REQ-EP-003: Route Grouping

Endpoints MUST be organized by route group in the following order: Auth, Programs, Results, Catalog, Exercises, Program Definitions, Stats, System. Each group MUST have its own heading.

#### Scenario: Route groups in order · `code-based` · `important`

- **WHEN** the endpoint reference section headings are extracted
- **THEN** they MUST appear in the specified group order

### REQ-EP-004: Auth Guard Variants

The contract MUST distinguish between the two auth patterns used in the TS codebase:

1. **`resolveUserId` guard**: standard middleware that extracts `userId` from JWT and stores it; used by most protected routes
2. **Manual JWT extraction**: used by `GET /api/auth/me`, which manually reads the `Authorization` header and calls `jwt.verify()` outside the standard guard

The contract MUST specify which pattern each endpoint uses.

#### Scenario: Auth pattern specified per endpoint · `human-review` · `critical`

- **WHEN** an endpoint requires auth
- **THEN** the contract MUST state whether it uses the `resolveUserId` guard or manual extraction

### REQ-EP-005: Request Body Validation Constraints

For each endpoint that accepts a request body, the contract MUST specify all validation constraints from both the route-level schema (Elysia/Zod) and the service-level validation. Constraints include:

- String length limits (min, max)
- Numeric ranges (min, max, integer-only)
- Enum values
- Array length limits
- Required vs optional fields
- Mutual exclusion rules (e.g., `programId` XOR `definitionId`)
- Format patterns (e.g., avatar data-URL regex)

#### Scenario: Validation constraints complete · `human-review` · `critical`

- **WHEN** an endpoint accepts a request body
- **THEN** every constraint applied by the TS code (route schema + service layer) MUST be documented

### REQ-EP-006: Side Effects Documentation

For endpoints with side effects, the contract MUST specify:

- **Cookie mutations**: which cookies are set, modified, or cleared, with all attributes
- **Cache invalidation**: which Redis keys are invalidated
- **Background jobs**: fire-and-forget operations (e.g., Telegram notification, presence update)
- **DB cascades**: cascade deletes or related row updates (e.g., auto-completing active instances)
- **Undo stack**: whether the operation pushes an undo entry and the trim behavior

#### Scenario: Side effects enumerated · `human-review` · `critical`

- **WHEN** an endpoint mutates state beyond the primary response
- **THEN** every side effect MUST be listed with sufficient detail for Go reproduction

### REQ-EP-007: Pagination Specification

The contract MUST specify the pagination strategy for each list endpoint:

- `GET /api/programs`: cursor-based (details deferred to the cursor pagination section, but the endpoint spec MUST reference it)
- `GET /api/program-definitions`: offset-based (`offset` + `limit`, response includes `total`)
- `GET /api/exercises`: offset-based (`offset` + `limit`, response includes `total`, `offset`, `limit`)

#### Scenario: Pagination type declared · `code-based` · `important`

- **WHEN** a list endpoint is documented
- **THEN** it MUST specify cursor-based or offset-based and the response shape for pagination metadata

### REQ-EP-008: Caching Behavior

For endpoints that set `Cache-Control` headers or use Redis caching, the contract MUST specify:

- The exact `Cache-Control` header value
- The Redis cache key pattern and TTL
- Whether singleflight (concurrent request dedup) is applied
- Cache invalidation triggers

#### Scenario: Cache details present · `human-review` · `important`

- **WHEN** an endpoint uses caching
- **THEN** header value, Redis key, TTL, and invalidation triggers MUST all be documented

### REQ-EP-009: Dev-Only Endpoints

The contract MUST clearly mark endpoints that are disabled in production. `POST /api/auth/dev` MUST be documented with the condition for availability (`NODE_ENV !== 'production'`) and the production behavior (404).

#### Scenario: Dev endpoint flagged · `code-based` · `important`

- **WHEN** an endpoint exists only in non-production environments
- **THEN** it MUST be marked with the condition and the production fallback behavior

### REQ-EP-010: No-Rate-Limit Exception

The contract MUST explicitly document `DELETE /api/programs/:id/results/:workoutIndex/:slotId` as having NO rate limiting, and MUST note this is an exception to the pattern of all other write endpoints.

#### Scenario: Rate limit exception documented · `code-based` · `important`

- **WHEN** the delete-result endpoint is documented
- **THEN** it MUST explicitly state "no rate limiting" rather than omitting the field

## Acceptance Criteria Summary

| ID         | Criterion                                      | Eval         |
| ---------- | ---------------------------------------------- | ------------ |
| REQ-EP-001 | All 28+ endpoints documented                   | code-based   |
| REQ-EP-002 | 10 required fields per endpoint                | human-review |
| REQ-EP-003 | Route groups in specified order                | code-based   |
| REQ-EP-004 | Auth guard variant specified                   | human-review |
| REQ-EP-005 | All validation constraints captured            | human-review |
| REQ-EP-006 | Side effects enumerated                        | human-review |
| REQ-EP-007 | Pagination strategy declared per list endpoint | code-based   |
| REQ-EP-008 | Caching details complete                       | human-review |
| REQ-EP-009 | Dev-only endpoints flagged                     | code-based   |
| REQ-EP-010 | No-rate-limit exception documented             | code-based   |

## Eval Definitions

| Eval Type      | Method                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `code-based`   | Parse document: check for endpoint headings matching the inventory; verify presence of rate-limit, pagination, and dev-flag fields       |
| `human-review` | Reviewer compares each endpoint spec against the TS source at `bef5a51` to confirm completeness of fields, constraints, and side effects |

# Delta Spec: Serialization Contract

**Change**: go-api-migration-contract
**Date**: 2026-03-26
**Status**: draft
**Depends On**: proposal.md

---

## Context

Defines what the contract document MUST specify about JSON serialization, the highest-risk area for behavioral divergence between the TS and Go implementations. The TS codebase uses spread conditionals to omit fields, camelCase naming, ISO 8601 dates, and JSONB pass-through -- patterns that have no direct Go equivalent and require explicit contract specification.

## ADDED Requirements

### REQ-SER-001: Case Convention

The contract MUST specify that all JSON request and response bodies use camelCase field names. No snake_case field MUST appear in any JSON payload.

#### Scenario: Case convention stated · `code-based` · `critical`

- **WHEN** the serialization section is read
- **THEN** it MUST contain a normative statement that all JSON fields MUST be camelCase

### REQ-SER-002: Date Format

The contract MUST specify that all date/time values are serialized as ISO 8601 with millisecond precision and UTC `Z` suffix. The exact format MUST be stated as `YYYY-MM-DDTHH:mm:ss.sssZ` (matching JavaScript `new Date().toISOString()` output).

#### Scenario: Date format specified · `code-based` · `critical`

- **WHEN** a Go implementor serializes a timestamp
- **THEN** the contract MUST provide the exact format string and note that Go's `time.RFC3339Nano` is NOT equivalent (it omits trailing zeros)

### REQ-SER-003: Null-vs-Omit Table

The contract MUST include a comprehensive table listing every response field that can be absent, with three columns: field path (dotted notation within its response type), behavior (`always-present-possibly-null`, `omitted-when-null`, `always-present-never-null`), and the Go implementation consequence.

The table MUST cover at minimum:

**User fields:**

- `name`: always-present-possibly-null
- `avatarUrl`: always-present-possibly-null

**ProgramInstanceResponse fields:**

- `metadata`: always-present-possibly-null
- `definitionId`: always-present-possibly-null
- `customDefinition`: always-present-possibly-null

**Result fields (within `results` map):**

- `amrapReps`: omitted-when-null
- `rpe`: omitted-when-null
- `setLogs`: omitted-when-null

**Undo entry fields:**

- `prev`: omitted-when-null
- `prevRpe`: omitted-when-null
- `prevAmrapReps`: omitted-when-null
- `prevSetLogs`: omitted-when-null

**Pagination:**

- `nextCursor`: always-present-possibly-null

**ProgramDefinitionResponse:**

- `deletedAt`: always-present-possibly-null

#### Scenario: Null-vs-omit table complete · `human-review` · `critical`

- **WHEN** a Go implementor checks field serialization behavior
- **THEN** every nullable/optional response field MUST appear in the table with its behavior and Go consequence

### REQ-SER-004: Go Implementation Consequence Column

The null-vs-omit table MUST include a column specifying the Go consequence for each behavior:

- `always-present-possibly-null`: use pointer type (e.g., `*string`) WITHOUT `omitempty` tag
- `omitted-when-null`: use pointer type WITH `omitempty` tag, OR custom `MarshalJSON`
- `always-present-never-null`: use value type (e.g., `string`) without pointer

#### Scenario: Go consequence documented · `human-review` · `critical`

- **WHEN** the null-vs-omit table is read
- **THEN** each row MUST include the Go struct tag or pattern required to reproduce the TS behavior

### REQ-SER-005: JSONB Pass-Through Fields

The contract MUST list all fields stored as PostgreSQL JSONB and returned without transformation:

- `config` (ProgramInstanceResponse)
- `metadata` (ProgramInstanceResponse)
- `definition` (ProgramDefinitionResponse, catalog detail)
- `customDefinition` (ProgramInstanceResponse)
- `setLogs` (workout result, undo entry)

The contract MUST specify that the Go implementation MUST scan these as raw JSON bytes (`json.RawMessage` or equivalent) and include them in the response without re-encoding, to preserve field ordering and numeric precision.

#### Scenario: JSONB pass-through documented · `code-based` · `critical`

- **WHEN** the serialization section lists JSONB fields
- **THEN** each field listed above MUST be present with the pass-through requirement

### REQ-SER-006: Number Precision

The contract MUST specify that numeric values use standard IEEE 754 float64 precision (JavaScript `number` semantics). No special precision handling is required beyond what Go's `encoding/json` provides by default.

#### Scenario: Number precision stated · `code-based` · `important`

- **WHEN** the serialization section is read
- **THEN** it MUST state the numeric precision expectation

### REQ-SER-007: Cursor Format Specification

The contract MUST specify the cursor pagination format in a dedicated subsection:

1. **Format**: `<ISO-8601-timestamp>_<UUID>` (single underscore separator)
2. **Example**: `2024-01-15T10:30:00.000Z_550e8400-e29b-41d4-a716-446655440000`
3. **Parsing algorithm**: split on `lastIndexOf('_')` -- everything before = ISO timestamp, everything after = UUID
4. **SQL predicate**: `WHERE (created_at < :ts) OR (created_at = :ts AND id > :id)` with `ORDER BY created_at DESC, id ASC`
5. **Generation**: `<row.createdAt.toISOString()>_<row.id>`
6. **`nextCursor`**: `null` (not omitted) when no more pages exist

#### Scenario: Cursor algorithm fully specified · `code-based` · `critical`

- **WHEN** a Go implementor builds cursor pagination
- **THEN** the contract MUST provide the exact format, parsing algorithm, SQL predicate, and generation logic

### REQ-SER-008: Undo Response Shape

The contract MUST specify that the `POST /api/programs/:id/undo` response omits `prevRpe` and `prevAmrapReps` from the response body, even though these fields exist on the undo entry in the database. Only `prev` and `prevSetLogs` are included (when non-null) alongside `i` and `slotId`.

#### Scenario: Undo response field subset documented · `code-based` · `critical`

- **WHEN** the undo endpoint response shape is specified
- **THEN** it MUST explicitly note that `prevRpe` and `prevAmrapReps` are NOT included in the response

### REQ-SER-009: Empty Collections vs Null

The contract MUST specify the behavior for empty collections:

- `results` in ProgramInstanceResponse: empty object `{}` (not null, not omitted) when no results exist
- `undoHistory` in ProgramInstanceResponse: empty array `[]` (not null, not omitted) when no undo entries exist
- `resultTimestamps` and `completedDates`: empty object `{}` when no results exist
- `data` in paginated responses: empty array `[]` when no items match

#### Scenario: Empty collection behavior documented · `code-based` · `important`

- **WHEN** the serialization section is read
- **THEN** the behavior for empty collections MUST be specified (empty vs null vs omitted)

## Acceptance Criteria Summary

| ID          | Criterion                                         | Eval         |
| ----------- | ------------------------------------------------- | ------------ |
| REQ-SER-001 | camelCase convention stated                       | code-based   |
| REQ-SER-002 | Date format with millisecond precision specified  | code-based   |
| REQ-SER-003 | Null-vs-omit table with all fields                | human-review |
| REQ-SER-004 | Go consequence column present                     | human-review |
| REQ-SER-005 | JSONB pass-through fields listed                  | code-based   |
| REQ-SER-006 | Number precision stated                           | code-based   |
| REQ-SER-007 | Cursor format, parsing, SQL, generation specified | code-based   |
| REQ-SER-008 | Undo response field subset documented             | code-based   |
| REQ-SER-009 | Empty collection behavior specified               | code-based   |

## Eval Definitions

| Eval Type      | Method                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code-based`   | Parse contract document: verify presence of null-vs-omit table, JSONB field list, cursor algorithm section, date format string, and camelCase statement |
| `human-review` | Reviewer cross-checks null-vs-omit table against every spread conditional and nullable field in the TS source at `bef5a51`                              |

# Delta Spec: Auth Contract

**Change**: go-api-migration-contract
**Date**: 2026-03-26
**Status**: draft
**Depends On**: proposal.md

---

## Context

Defines what the contract document MUST specify about the authentication and authorization system. This is the highest-stakes cross-cutting concern: JWT interop between TS and Go during migration, refresh token rotation with theft detection, cookie attributes, and Google OAuth verification all have zero tolerance for behavioral divergence.

## ADDED Requirements

### REQ-AUTH-001: JWT Access Token Specification

The contract MUST specify the complete JWT access token contract:

1. **Algorithm**: HS256
2. **Secret source**: `JWT_SECRET` environment variable; MUST be 64+ characters in production; dev default: `dev-secret-change-me`
3. **Payload claims**: `sub` (user UUID), `email` (optional, included on sign-in tokens only), `exp` (duration from `JWT_ACCESS_EXPIRY` env var, default `15m`)
4. **Transmission**: `Authorization: Bearer <token>` request header
5. **Verification**: HS256 signature check; `verify()` returns false on invalid or expired

The contract MUST note that during migration, tokens issued by the TS server MUST be verifiable by the Go server and vice versa (shared secret, same algorithm, compatible claim structure).

#### Scenario: JWT spec complete · `human-review` · `critical`

- **WHEN** a Go implementor configures JWT
- **THEN** the contract MUST provide algorithm, secret constraints, all claims, transmission header, and cross-server interop requirement

### REQ-AUTH-002: Refresh Token Cookie Specification

The contract MUST specify the complete refresh token cookie contract:

1. **Cookie name**: `refresh_token`
2. **Token format**: raw UUID v4 (`crypto.randomUUID()`)
3. **Storage**: SHA-256 hex hash of the raw token stored in `refresh_tokens` DB table
4. **Cookie attributes** (exact values):
   - `httpOnly`: `true`
   - `secure`: `true` in production, `false` in development
   - `sameSite`: `strict`
   - `maxAge`: `604800` (7 days = 7 _ 24 _ 60 \* 60 seconds)
   - `path`: `/api/auth`
5. **Expiry**: 7 days (`REFRESH_TOKEN_DAYS = 7`)

#### Scenario: Cookie attributes exact · `code-based` · `critical`

- **WHEN** the cookie specification is read
- **THEN** all 5 cookie attributes MUST be present with their exact values, including the `path` scope

### REQ-AUTH-003: Token Rotation Flow

The contract MUST specify the refresh token rotation algorithm:

1. Client sends `POST /api/auth/refresh` (cookie-based, no body)
2. Server reads `refresh_token` cookie
3. Server looks up SHA-256 hash in `refresh_tokens` table
4. If not found: 401 `AUTH_INVALID_REFRESH`
5. If expired (`expires_at < now()`): 401 `AUTH_REFRESH_EXPIRED`
6. Server revokes the old token (marks as revoked or deletes)
7. Server issues a new refresh token (new UUID, new hash, sets `previous_token_hash` to old hash)
8. Server sets new `refresh_token` cookie with same attributes
9. Server returns new access token in response body

#### Scenario: Rotation flow complete · `human-review` · `critical`

- **WHEN** the rotation section is read
- **THEN** every step from cookie read through new token issuance MUST be specified

### REQ-AUTH-004: Theft Detection Algorithm

The contract MUST specify the token theft detection mechanism:

1. When a revoked/rotated token is presented, the server finds its successor via `previous_token_hash`
2. If a successor exists (meaning the token was already rotated), this indicates theft
3. On theft detection: revoke ALL refresh tokens for the affected user (nuclear revocation)

The contract MUST note that this is a chain-based detection: each token points back to its predecessor via `previous_token_hash`.

#### Scenario: Theft detection specified · `human-review` · `critical`

- **WHEN** a Go implementor handles an already-rotated token
- **THEN** the contract MUST specify the successor lookup and nuclear revocation behavior

### REQ-AUTH-005: Google OAuth Verification

The contract MUST specify the Google OAuth token verification:

1. **Endpoint**: `POST /api/auth/google` with body `{ "credential": "<google-id-token>" }`
2. **Algorithm**: RS256 (Google-issued)
3. **JWKS URL**: `https://www.googleapis.com/oauth2/v3/certs` (cached 1 hour)
4. **Issuer validation**: MUST be `accounts.google.com` OR `https://accounts.google.com`
5. **Audience validation**: MUST match `GOOGLE_CLIENT_ID` env var
6. **Expiry validation**: token MUST NOT be expired
7. **User upsert**: `INSERT ... ON CONFLICT (google_id) DO UPDATE SET name, email, updated_at`
8. **New user detection**: `|createdAt - updatedAt| < 2000ms` heuristic
9. **New user side effect**: Telegram notification (fire-and-forget, MUST NOT block response)

#### Scenario: Google OAuth fully specified · `human-review` · `critical`

- **WHEN** a Go implementor builds Google auth
- **THEN** the contract MUST specify JWKS URL, cache TTL, issuer/audience validation, upsert SQL, and new-user heuristic

### REQ-AUTH-006: Signout Behavior

The contract MUST specify the signout flow:

1. `POST /api/auth/signout` reads `refresh_token` cookie
2. Revokes token from DB (if found; silent no-op if not found)
3. Clears `refresh_token` cookie (set empty value with `maxAge: 0` and same `path`)
4. Returns 204 with empty body

#### Scenario: Signout flow specified · `code-based` · `important`

- **WHEN** the signout endpoint is documented
- **THEN** it MUST specify cookie clearing (including path attribute) and the no-op behavior when token is absent

### REQ-AUTH-007: Account Deletion Auth Effects

The contract MUST specify what happens to auth state on account deletion (`DELETE /api/auth/me`):

1. User soft-deleted (`deleted_at = now()`)
2. ALL refresh tokens for the user revoked
3. `refresh_token` cookie cleared
4. Existing access tokens remain valid until expiry (up to 15 minutes) on endpoints that do NOT call `findUserById`
5. `GET /api/auth/me` and `POST /api/auth/refresh` will fail for soft-deleted users

#### Scenario: Deletion auth effects documented · `human-review` · `critical`

- **WHEN** the account deletion section is read
- **THEN** the contract MUST specify the window during which stale access tokens remain usable and which endpoints are affected

### REQ-AUTH-008: Auth Guard Soft-Delete Filter

The contract MUST specify that `findUserById` and `findUserByEmail` filter `WHERE deleted_at IS NULL`. This means soft-deleted users:

- CANNOT refresh tokens (refresh calls `findUserById`)
- CANNOT access `GET /api/auth/me` (calls `findUserById`)
- CAN still access program/result endpoints with a valid unexpired JWT (these only verify the JWT signature, not user existence)

#### Scenario: Soft-delete auth boundary documented · `human-review` · `critical`

- **WHEN** the contract describes the auth guard
- **THEN** it MUST distinguish which endpoints check user existence vs JWT-only

### REQ-AUTH-009: Avatar Validation Rules

The contract MUST specify the avatar validation in `PATCH /api/auth/me`:

1. Format regex: `^data:image/(jpeg|png|webp);base64,.+$`
2. Max size: 200,000 bytes (of the full data-URL string)
3. Base64 roundtrip validation: decode then re-encode; MUST match original
4. Send `null` to remove avatar
5. Error codes: `INVALID_AVATAR` (bad format or roundtrip fail), `AVATAR_TOO_LARGE` (exceeds 200KB)

#### Scenario: Avatar validation complete · `code-based` · `important`

- **WHEN** the PATCH /me endpoint is documented
- **THEN** the regex, size limit, roundtrip rule, and null-to-remove behavior MUST be present

## Acceptance Criteria Summary

| ID           | Criterion                                 | Eval         |
| ------------ | ----------------------------------------- | ------------ |
| REQ-AUTH-001 | JWT access token fully specified          | human-review |
| REQ-AUTH-002 | Cookie attributes exact with all 5 values | code-based   |
| REQ-AUTH-003 | Rotation flow step-by-step                | human-review |
| REQ-AUTH-004 | Theft detection algorithm specified       | human-review |
| REQ-AUTH-005 | Google OAuth verification complete        | human-review |
| REQ-AUTH-006 | Signout flow with cookie clearing         | code-based   |
| REQ-AUTH-007 | Deletion auth effects documented          | human-review |
| REQ-AUTH-008 | Soft-delete auth boundary documented      | human-review |
| REQ-AUTH-009 | Avatar validation rules complete          | code-based   |

## Eval Definitions

| Eval Type      | Method                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `code-based`   | Parse contract: verify cookie attribute values, avatar regex, signout 204 status, and error codes are present                |
| `human-review` | Reviewer traces JWT flow, rotation, theft detection, and Google OAuth against TS source at `bef5a51` to confirm completeness |

# Delta Spec: Infrastructure Contract

**Change**: go-api-migration-contract
**Date**: 2026-03-26
**Status**: draft
**Depends On**: proposal.md

---

## Context

Defines what the contract document MUST specify about cross-cutting infrastructure concerns: CORS, security headers, rate limiting, Redis key space, Prometheus metrics, environment variables, background jobs, request logging, body size limits, and SPA serving. These are the behaviors that apply across multiple or all endpoints and must be reproduced identically in Go.

## ADDED Requirements

### REQ-INFRA-001: CORS Configuration

The contract MUST specify the CORS configuration:

1. `Access-Control-Allow-Credentials: true` on all responses
2. Origins: parsed from `CORS_ORIGIN` env var (comma-separated); dev default `http://localhost:3000`; production: required (startup MUST fail if missing)
3. Allowed methods: plugin default (all methods)
4. Allowed headers: plugin default (mirrors `Access-Control-Request-Headers` from preflight)
5. No explicit `maxAge` override

#### Scenario: CORS config complete · `code-based` · `critical`

- **WHEN** the CORS section is read
- **THEN** credentials, origin source, and header mirroring behavior MUST be documented

### REQ-INFRA-002: Security Headers

The contract MUST specify the exact security headers set on every response via `onAfterHandle`:

| Header                      | Exact Value                                                                |
| --------------------------- | -------------------------------------------------------------------------- |
| `x-content-type-options`    | `nosniff`                                                                  |
| `x-frame-options`           | `DENY`                                                                     |
| `referrer-policy`           | `strict-origin-when-cross-origin`                                          |
| `content-security-policy`   | (full CSP string)                                                          |
| `strict-transport-security` | `max-age=31536000; includeSubDomains` (production only)                    |
| `permissions-policy`        | `camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()` |

The contract MUST reproduce the exact CSP string character-for-character. The contract MUST specify that HSTS is conditional on `NODE_ENV === 'production'`.

#### Scenario: Security headers exact · `code-based` · `critical`

- **WHEN** the security headers section is read
- **THEN** all 6 header names and their exact values MUST be present, including the full CSP string

### REQ-INFRA-003: Rate Limiter Behavior

The contract MUST specify the rate limiting mechanism:

1. **Algorithm**: sliding window using Redis sorted sets (Lua script) when Redis is available; in-memory `Map<string, number[]>` fallback otherwise
2. **Fail-open**: if Redis is unavailable, the rate check MUST return "allowed" (never block)
3. **Key format**: `rl:<endpoint-string>:<identity>`
4. **Defaults**: `windowMs=60000` (1 min), `maxRequests=20`
5. **Redis Lua script**: atomically ZREMRANGEBYSCORE (prune stale), ZCARD (count), ZADD (new entry), PEXPIRE (TTL)
6. **On limit exceeded**: HTTP 429, `Retry-After: <windowMs / 1000>` header, body `{ "error": "Too many requests", "code": "RATE_LIMITED" }`

#### Scenario: Rate limiter spec complete · `human-review` · `critical`

- **WHEN** a Go implementor builds the rate limiter
- **THEN** the contract MUST provide the algorithm, key format, Lua operations, fail-open rule, and 429 response shape

### REQ-INFRA-004: Rate Limiter Key Table

The contract MUST include a table with columns: endpoint (method + path), windowMs, maxRequests, key identity. The table MUST cover all 25+ per-endpoint overrides from the exploration document.

Key identity types:

- `ip`: raw IP from request logger
- `userId`: extracted from JWT
- `userId:ip`: composite
- `x-forwarded-for ?? 'anonymous'`: for public endpoints

The table MUST include the dev-mode override for `/auth/refresh` (500/min vs 20/min in production).

#### Scenario: Rate limit table complete · `code-based` · `critical`

- **WHEN** the rate limit table is parsed
- **THEN** it MUST contain rows for all rate-limited endpoints with windowMs, maxRequests, and key identity columns

### REQ-INFRA-005: Redis Key Space Table

The contract MUST include a table listing all Redis key patterns:

| Key Pattern                               | TTL                   | Purpose                         |
| ----------------------------------------- | --------------------- | ------------------------------- |
| `program:<userId>:<instanceId>`           | 300s                  | Program instance response cache |
| `catalog:list`                            | 300s                  | Catalog list cache              |
| `catalog:detail:<programId>`              | 300s                  | Catalog detail cache            |
| `rl:<endpoint>:<key>`                     | windowMs (PEXPIRE)    | Rate limiter sorted sets        |
| `users:online`                            | No fixed TTL (pruned) | Presence sorted set             |
| `exercises:<userId\|preset>:<filterHash>` | (cache-managed)       | Exercise list cache             |
| `muscle-groups`                           | (cache-managed)       | Muscle group list cache         |

#### Scenario: Redis key table complete · `code-based` · `critical`

- **WHEN** the Redis key space section is parsed
- **THEN** all 7 key patterns listed above MUST be present with their TTL and purpose

### REQ-INFRA-006: Prometheus Metrics

The contract MUST specify all custom Prometheus metrics:

1. `http_request_duration_seconds` (Histogram): labels `method`, `route`, `status_code`; buckets `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]`
2. `http_requests_total` (Counter): labels `method`, `route`, `status_code`
3. `rate_limit_hits_total` (Counter): label `endpoint`
4. `http_errors_total` (Counter): labels `status_class` (`4xx`/`5xx`), `error_code`
5. `db_queries_total` (Counter): label `query_type` (`select`/`insert`/`update`/`delete`/`other`)
6. Default runtime metrics (prom-client `collectDefaultMetrics`)

The contract MUST specify the route normalization regexes:

- UUID replacement: `/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi` → `:id`
- Numeric segment replacement: `/\/\d+/g` → `/:n`

The contract MUST note that the JS regex uses `gi` flags and that Go `regexp` (RE2) handles case-insensitivity differently (`(?i)` prefix).

#### Scenario: Metrics spec complete · `code-based` · `critical`

- **WHEN** the metrics section is parsed
- **THEN** all 5 custom metric names, their types, labels, and the 2 route normalization regexes MUST be present

### REQ-INFRA-007: Environment Variable Table

The contract MUST include a table listing all environment variables with columns: name, required (yes/no/prod-only), default value, purpose. The table MUST cover all variables from the exploration:

`DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `CORS_ORIGIN`, `PORT`, `NODE_ENV`, `LOG_LEVEL`, `REDIS_URL`, `METRICS_TOKEN`, `TRUSTED_PROXY`, `ADMIN_USER_IDS`, `SENTRY_DSN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `JWT_ACCESS_EXPIRY`, `DB_POOL_SIZE`, `DB_SSL`

#### Scenario: Env var table complete · `code-based` · `critical`

- **WHEN** the environment variable table is parsed
- **THEN** all 17 variables listed above MUST have rows with required, default, and purpose columns

### REQ-INFRA-008: Request Logger and Request ID

The contract MUST specify the request logging and request ID behavior:

1. `x-request-id`: taken from request header if it matches `/^[\w-]{8,64}$/`; otherwise generated as `crypto.randomUUID()`
2. `x-request-id` header MUST be set on every response
3. IP extraction: socket address by default; `x-forwarded-for` first value (split on `,`) when `TRUSTED_PROXY=true`
4. Log fields: `reqId`, `method`, `url`, `ip` on request; `status`, `latencyMs` on response
5. Pino redacts: `authorization` and `cookie` headers as `[Redacted]`

#### Scenario: Request ID and logging specified · `code-based` · `important`

- **WHEN** the request logger section is read
- **THEN** the regex for `x-request-id` validation, IP extraction logic, and log field inventory MUST be present

### REQ-INFRA-009: Body Size Limit

The contract MUST specify that the maximum request body size is 1,048,576 bytes (1 MB). Requests exceeding this MUST be rejected.

#### Scenario: Body size limit stated · `code-based` · `important`

- **WHEN** the server configuration section is read
- **THEN** the 1 MB body size limit MUST be stated with the exact byte count

### REQ-INFRA-010: Background Jobs

The contract MUST specify all background jobs:

1. **Token cleanup**: runs at startup and every 6 hours; `DELETE FROM refresh_tokens WHERE expires_at < now()`
2. **Presence tracking**: fire-and-forget on every authenticated request; ZADD + ZREMRANGEBYSCORE in Redis MULTI/EXEC pipeline
3. **Telegram notification**: fire-and-forget on new user creation; MUST NOT block the response

#### Scenario: Background jobs documented · `code-based` · `important`

- **WHEN** the background jobs section is read
- **THEN** all 3 background jobs MUST be documented with their trigger, frequency, and failure behavior

### REQ-INFRA-011: SPA Serving

The contract MUST specify the SPA static file serving:

1. Static files served from `web/dist/` directory
2. `GET /` serves `web/dist/index.html`
3. `GET /.well-known/security.txt` serves `web/dist/.well-known/security.txt` with `content-type: text/plain; charset=utf-8`
4. `GET /*` (catch-all, after all API routes) serves `web/dist/index.html` for client-side routing
5. No `/api` prefix on SPA routes

#### Scenario: SPA serving rules documented · `code-based` · `important`

- **WHEN** the SPA section is read
- **THEN** the static directory, index.html fallback, security.txt content-type, and catch-all behavior MUST be specified

### REQ-INFRA-012: Error Response Shape

The contract MUST specify the global error response shape:

1. **Shape**: `{ "error": "<human-readable message>", "code": "<machine-readable code>" }` — always exactly these two fields
2. **Status code mapping**: `ApiError` → `error.statusCode`; route not found → 404 `NOT_FOUND`; validation failure → 400 `VALIDATION_ERROR`; parse failure → 400 `PARSE_ERROR`; unhandled → 500 `INTERNAL_ERROR`
3. **Full error code inventory**: all known `ApiError` codes with their typical HTTP status

The contract MUST list every error code from the exploration document (30+ codes).

#### Scenario: Error shape and code inventory complete · `code-based` · `critical`

- **WHEN** the error section is parsed
- **THEN** the JSON shape, status mapping rules, and complete error code inventory MUST be present

### REQ-INFRA-013: Middleware Execution Order

The contract MUST document the middleware execution order:

1. CORS plugin
2. Swagger plugin (dev only)
3. Metrics plugin (`onRequest` start; `onAfterHandle` record)
4. Security headers (`onAfterHandle`)
5. Request logger (`derive` before handler; `onAfterHandle` log)
6. Global error handler (`onError`)
7. Route handler

Route-level order for protected routes:

1. Request logger (provides `reqId`, `reqLogger`, `ip`, `startMs`)
2. JWT plugin (provides `jwt.sign()`/`jwt.verify()`)
3. `resolveUserId` (extracts userId or throws 401)
4. Rate limit check (called at start of handler)

#### Scenario: Middleware order documented · `human-review` · `important`

- **WHEN** the middleware section is read
- **THEN** both the global and route-level execution orders MUST be specified

### REQ-INFRA-014: Graceful Shutdown

The contract MUST specify the server shutdown behavior:

1. Handles `SIGTERM` and `SIGINT`
2. Grace period: 10,000 ms timeout
3. Go implementation MUST handle in-flight requests during shutdown

#### Scenario: Shutdown spec present · `code-based` · `important`

- **WHEN** the server configuration section is read
- **THEN** the signal handling and grace period MUST be specified

### REQ-INFRA-015: Risks and Go Pitfalls Section

The contract MUST include a dedicated risks section listing all identified risks from the proposal and exploration, each with:

1. The risk description
2. A cross-reference link to the relevant contract section
3. The Go implementation consequence or mitigation

The risks MUST include at minimum: JWT library differences, cursor format, null-vs-omit, date serialization, JSONB pass-through, cookie path scope, rate limiter key semantics, HSTS conditionality, Prometheus regex flags, `isNewUser` heuristic, avatar base64 roundtrip, undo stack trim, and body size limit.

#### Scenario: Risks section complete · `human-review` · `critical`

- **WHEN** the risks section is read
- **THEN** each risk from the proposal MUST be present with a cross-reference and Go consequence

## Acceptance Criteria Summary

| ID            | Criterion                           | Eval         |
| ------------- | ----------------------------------- | ------------ |
| REQ-INFRA-001 | CORS config complete                | code-based   |
| REQ-INFRA-002 | Security headers with exact values  | code-based   |
| REQ-INFRA-003 | Rate limiter behavior specified     | human-review |
| REQ-INFRA-004 | Rate limit table with all endpoints | code-based   |
| REQ-INFRA-005 | Redis key space table complete      | code-based   |
| REQ-INFRA-006 | Prometheus metrics with regexes     | code-based   |
| REQ-INFRA-007 | Env var table with all 17 variables | code-based   |
| REQ-INFRA-008 | Request ID and logging specified    | code-based   |
| REQ-INFRA-009 | Body size limit stated              | code-based   |
| REQ-INFRA-010 | Background jobs documented          | code-based   |
| REQ-INFRA-011 | SPA serving rules documented        | code-based   |
| REQ-INFRA-012 | Error shape and 30+ error codes     | code-based   |
| REQ-INFRA-013 | Middleware execution order          | human-review |
| REQ-INFRA-014 | Graceful shutdown specified         | code-based   |
| REQ-INFRA-015 | Risks section with cross-references | human-review |

## Eval Definitions

| Eval Type      | Method                                                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code-based`   | Parse contract document: verify presence of tables (rate limit, Redis keys, env vars, error codes), exact header values, CSP string, regex patterns, and metric names |
| `human-review` | Reviewer validates rate limiter algorithm, middleware order, and risks section against TS source at `bef5a51` and proposal risks table                                |
