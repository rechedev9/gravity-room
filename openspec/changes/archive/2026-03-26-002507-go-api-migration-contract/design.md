---
summary: Design for the HTTP contract oracle document — document architecture, content extraction strategy, endpoint entry template, and verification approach.
read_when: Implementing the http-contract.md deliverable, or reviewing the contract for completeness against the 51 spec requirements.
---

# Design: go-api-migration-contract

**Change ID:** go-api-migration-contract
**Phase:** Design
**Date:** 2026-03-26

---

## 1. Document Architecture

The deliverable is a single Markdown file at `openspec/contract/http-contract.md`. No code, no tests, no schema changes.

### 1.1 Top-Level Outline

The 17 required sections (REQ-CS-005) are ordered to introduce cross-cutting concerns before endpoint specifics, so the endpoint reference can back-reference them by anchor:

```
YAML front-matter (summary + read_when)
# HTTP Contract — Gravity Room API
  Header block: change ID, pinned SHA bef5a51, branch go-api, date
  RFC 2119 boilerplate paragraph

## 1. Server Configuration
## 2. CORS Configuration
## 3. Security Headers
## 4. Request Logger & Request ID
## 5. Error Response Format
## 6. Rate Limiting
## 7. Auth Contract
## 8. Endpoint Reference
## 9. JSON Serialization Rules
## 10. Cursor Pagination
## 11. Prometheus Metrics
## 12. Redis Key Space
## 13. Request/Response Header Inventory
## 14. Background Jobs
## 15. Environment Variable Table
## 16. SPA Serving
## 17. Risks & Go Implementation Pitfalls
```

Sections 1-7 define the cross-cutting contracts. Section 8 is the bulk — one subsection per endpoint. Sections 9-16 are reference tables and algorithms. Section 17 is the risk registry with anchor cross-references.

### 1.2 Section Depth

- **H2** (`##`) for the 17 top-level sections.
- **H3** (`###`) for route groups within section 8 (Auth, Programs, Results, Catalog, Exercises, Program Definitions, Stats, System).
- **H4** (`####`) for individual endpoints within each route group.
- No deeper nesting. Subsections within cross-cutting sections use **H3**.

### 1.3 Anchor Convention

Each heading produces a GitHub-compatible anchor. The Risks section (17) cross-references anchors using `[Section Name](#slug)` links. Slugs follow GitHub auto-generation: lowercase, spaces to hyphens, strip non-alphanumeric except hyphens.

---

## 2. Content Extraction Strategy

Every value in the contract must be verified against the TS source at `bef5a51`. The exploration document is the index — it tells us where to look — but the source is the oracle.

### 2.1 Extraction Order

Process the 17 sections in document order. For each section:

1. **Identify source files.** Use the exploration's "Relevant Files" table to find the authoritative file(s).
2. **Read the source.** Open each file and extract exact values (strings, numbers, regexes, enum lists).
3. **Write normative text.** Convert extracted values into RFC 2119 statements with source citations.
4. **Flag ambiguities.** If the exploration used hedging language ("likely", "unclear", "appears to") and the source does not resolve the ambiguity, mark with `[VERIFY]`.

### 2.2 Per-Section Source Mapping

| Section                     | Primary Source Files                                                                                   | What to Extract                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Server Configuration        | `src/bootstrap.ts`, `src/create-app.ts`                                                                | PORT default, body size limit (1 MB), shutdown signals, grace period, startup sequence             |
| CORS                        | `src/create-app.ts`                                                                                    | `cors()` plugin call — origins, credentials, methods, headers                                      |
| Security Headers            | `src/create-app.ts`                                                                                    | `onAfterHandle` — each header name + value, CSP string (char-for-char), HSTS condition             |
| Request Logger & Request ID | `src/middleware/request-logger.ts`                                                                     | `x-request-id` regex, IP extraction, Pino redaction, log fields                                    |
| Error Response Format       | `src/middleware/error-handler.ts`, all route files                                                     | `ApiError` class, status mapping, all `new ApiError(...)` calls for error code inventory           |
| Rate Limiting               | `src/middleware/rate-limit.ts`, all route files                                                        | Algorithm, Lua script, key format, defaults, per-endpoint overrides (grep all `rateLimit(` calls)  |
| Auth Contract               | `src/routes/auth.ts`, `src/services/auth.ts`, `src/middleware/auth-guard.ts`, `src/lib/google-auth.ts` | JWT config, cookie attributes, rotation flow, theft detection, Google JWKS, avatar validation      |
| Endpoint Reference          | All `src/routes/*.ts`, all `src/services/*.ts`                                                         | Method, path, auth, rate limit, body schema, query params, response shape per status, side effects |
| JSON Serialization          | `src/services/*.ts` (response construction), `src/db/schema.ts` (JSONB columns)                        | Spread conditionals for null-vs-omit, JSONB columns, date serialization                            |
| Cursor Pagination           | `src/services/program.ts` (or wherever cursor logic lives)                                             | Format, parsing (`lastIndexOf`), SQL WHERE, generation                                             |
| Prometheus Metrics          | `src/lib/metrics.ts`, `src/create-app.ts`                                                              | Metric names, types, labels, buckets, route normalization regexes                                  |
| Redis Key Space             | `src/lib/redis.ts`, `src/lib/cache.ts`, `src/services/*.ts`                                            | Key patterns, TTLs, purposes                                                                       |
| Header Inventory            | `src/create-app.ts`, `src/middleware/*.ts`                                                             | All consumed request headers, all emitted response headers                                         |
| Background Jobs             | `src/bootstrap.ts`, `src/services/auth.ts`, `src/lib/presence.ts`                                      | Token cleanup interval, presence ZADD, Telegram notification                                       |
| Environment Variable Table  | `src/bootstrap.ts`, `src/create-app.ts`                                                                | All `process.env` / `Bun.env` reads with defaults                                                  |
| SPA Serving                 | `src/create-app.ts`                                                                                    | Static directory, index.html fallback, security.txt content-type                                   |
| Risks                       | `proposal.md`, `exploration.md`                                                                        | All risk entries; map each to the contract section anchor                                          |

### 2.3 Error Code Inventory Extraction

Grep all files for `new ApiError(` and `ApiError(` to build the exhaustive list. For each occurrence, capture:

- HTTP status code (first arg)
- Human-readable message (second arg)
- Machine-readable code (third arg)

Deduplicate by code. Present as a table: `| Code | HTTP Status | Message |`.

### 2.4 Rate Limit Table Extraction

Grep all route files for `rateLimit(` or the equivalent call pattern. For each match, extract:

- The endpoint method + path (from the enclosing route handler)
- `windowMs` override (or default 60000)
- `maxRequests` override (or default 20)
- Key identity (`ip`, `userId`, `userId:ip`, etc.)

Present as a table: `| Method | Path | Window (ms) | Max | Key Identity |`.

Include the dev-mode override for `/auth/refresh` as a footnote or conditional row.

### 2.5 Null-vs-Omit Table Extraction

For each service function that constructs a response object, look for:

- Spread conditionals: `...(field != null && { field })` → `omitted-when-null`
- Direct assignment of nullable DB column: `field: row.field` → `always-present-possibly-null`
- Non-nullable direct assignment: → `always-present-never-null`

Present as a table: `| Response Type | Field | Behavior | Go Consequence |`.

Go consequence column values:

- `always-present-possibly-null` → `*T` without `omitempty`
- `omitted-when-null` → `*T` with `json:",omitempty"` or custom marshaler
- `always-present-never-null` → `T` (value type, no pointer)

---

## 3. Endpoint Entry Template

Each endpoint (REQ-EP-002) uses a consistent structure. The template below covers all 10 required fields:

````markdown
#### `METHOD /api/path`

**Auth:** required (resolveUserId guard) | required (manual JWT extraction) | cookie-based (refresh_token) | none
**Rate limit:** 60000 ms / 20 max / key: `userId` — OR — none
**Dev-only:** yes, condition: `NODE_ENV !== 'production'` — OR — omit field if not dev-only

**Path parameters:**

- `id` — UUID

**Query parameters:**

- `cursor` — string, optional, cursor token
- `limit` — integer, optional, default 20, range [1, 100]

**Request body:**

```json
{
  "field": "string, required, min 1 max 100"
}
```
````

— OR — none

**Responses:**

| Status | Body                                                       | Condition             |
| ------ | ---------------------------------------------------------- | --------------------- | ------- |
| 200    | `{ "data": [...], "nextCursor": "string                    | null" }`              | Success |
| 400    | `{ "error": "...", "code": "VALIDATION_ERROR" }`           | Invalid input         |
| 401    | `{ "error": "...", "code": "AUTH_REQUIRED" }`              | Missing/invalid token |
| 429    | `{ "error": "Too many requests", "code": "RATE_LIMITED" }` | Rate limit exceeded   |

**Error codes:** `VALIDATION_ERROR`, `AUTH_REQUIRED`, `RATE_LIMITED`

**Side effects:**

- Sets `refresh_token` cookie (see [Auth Contract](#7-auth-contract))
- Invalidates Redis key `program:<userId>:<id>`
  — OR — none

**Pagination:** cursor-based (see [Cursor Pagination](#10-cursor-pagination))
— OR — offset-based (response includes `total`, `offset`, `limit`)
— OR — omit if not a list endpoint

**Caching:**

- `Cache-Control: public, max-age=300`
- Redis: `catalog:list`, TTL 300s, singleflight
- Invalidation: on catalog program update
  — OR — none

````

This template satisfies REQ-EP-002 (all 10 fields), REQ-EP-004 (auth guard variant), REQ-EP-005 (validation constraints inline in request body), REQ-EP-006 (side effects), REQ-EP-007 (pagination), REQ-EP-008 (caching), REQ-EP-009 (dev-only flag), REQ-EP-010 (explicit "none" for rate limit).

---

## 4. Table Formats

### 4.1 Rate Limiter Key Table (REQ-INFRA-004)

```markdown
| Method | Path | Window (ms) | Max | Key Identity |
|---|---|---|---|---|
| POST | /api/auth/google | 60000 | 10 | x-forwarded-for ?? 'anonymous' |
| POST | /api/auth/refresh | 60000 | 20 (dev: 500) | ip |
| ... | ... | ... | ... | ... |
````

### 4.2 Null-vs-Omit Table (REQ-SER-003, REQ-SER-004)

```markdown
| Response Type | Field       | Behavior                     | Go Consequence                  |
| ------------- | ----------- | ---------------------------- | ------------------------------- |
| User          | `name`      | always-present-possibly-null | `*string` (no omitempty)        |
| User          | `avatarUrl` | always-present-possibly-null | `*string` (no omitempty)        |
| WorkoutResult | `amrapReps` | omitted-when-null            | `*int` with `json:",omitempty"` |
| ...           | ...         | ...                          | ...                             |
```

### 4.3 Error Code Inventory (REQ-INFRA-012)

```markdown
| Code                 | HTTP Status | Description                     |
| -------------------- | ----------- | ------------------------------- |
| AUTH_REQUIRED        | 401         | Missing or invalid access token |
| AUTH_INVALID_REFRESH | 401         | Refresh token not found in DB   |
| ...                  | ...         | ...                             |
```

### 4.4 Redis Key Space Table (REQ-INFRA-005)

```markdown
| Key Pattern                     | TTL  | Purpose                         |
| ------------------------------- | ---- | ------------------------------- |
| `program:<userId>:<instanceId>` | 300s | Program instance response cache |
| ...                             | ...  | ...                             |
```

### 4.5 Environment Variable Table (REQ-INFRA-007)

```markdown
| Name         | Required              | Default                | Purpose                      |
| ------------ | --------------------- | ---------------------- | ---------------------------- |
| DATABASE_URL | yes                   | —                      | PostgreSQL connection string |
| JWT_SECRET   | prod-only (64+ chars) | `dev-secret-change-me` | HMAC-SHA256 signing key      |
| ...          | ...                   | ...                    | ...                          |
```

### 4.6 Security Headers Table (REQ-INFRA-002)

```markdown
| Header                      | Value                                 | Condition                        |
| --------------------------- | ------------------------------------- | -------------------------------- |
| `x-content-type-options`    | `nosniff`                             | always                           |
| `strict-transport-security` | `max-age=31536000; includeSubDomains` | `NODE_ENV === 'production'` only |
| ...                         | ...                                   | ...                              |
```

### 4.7 Prometheus Metrics Table (REQ-INFRA-006)

```markdown
| Metric Name                     | Type      | Labels                     | Notes                       |
| ------------------------------- | --------- | -------------------------- | --------------------------- |
| `http_request_duration_seconds` | Histogram | method, route, status_code | Buckets: [0.005, 0.01, ...] |
| ...                             | ...       | ...                        | ...                         |
```

---

## 5. Verification Approach

Since this is a documentation-only change, verification means confirming the contract accurately reflects the running TS source.

### 5.1 Source Parity Checks

For every exact value in the contract (strings, numbers, regexes), the implementation step must:

1. Read the TS source file at the cited line.
2. Copy the value character-for-character.
3. Include the source citation in parentheses: `(src/create-app.ts:42)`.

### 5.2 Completeness Checks

After writing the contract, verify against each spec:

| Check                                | Method                                                   |
| ------------------------------------ | -------------------------------------------------------- |
| REQ-CS-005: 17 sections present      | Grep headings in the contract                            |
| REQ-EP-001: 28+ endpoints present    | Count H4 headings in section 8                           |
| REQ-EP-002: 10 fields per endpoint   | Manual scan of each endpoint entry against the template  |
| REQ-SER-003: Null-vs-omit table rows | Compare table row count against exploration's field list |
| REQ-INFRA-004: Rate limit table rows | Compare row count against grep of `rateLimit(` in source |
| REQ-INFRA-005: Redis key patterns    | Compare against grep of Redis key construction in source |
| REQ-INFRA-007: 17 env vars           | Count rows in env var table                              |
| REQ-INFRA-012: 30+ error codes       | Count rows in error code inventory                       |
| REQ-INFRA-015: Risk cross-references | Verify each anchor link resolves                         |

### 5.3 VERIFY Annotation Audit

After writing, search the contract for `[VERIFY]`. Each annotation represents an unresolved ambiguity. Attempt to resolve by reading the TS source. If unresolvable from source alone, leave the annotation for human review.

### 5.4 Anchor Resolution

After writing, extract all `](#...)` link targets and all heading slugs. Confirm every link target matches a heading slug. This satisfies REQ-CS-006.

---

## 6. Normative Language Convention

Per REQ-CS-004, the contract uses RFC 2119 keywords:

- **MUST / MUST NOT** — absolute requirements / prohibitions. Used for behaviors where divergence breaks clients.
- **SHOULD / SHOULD NOT** — recommended. Used for behaviors where minor divergence is tolerable (e.g., log format details).
- **MAY** — truly optional. Used sparingly.

Uppercase only when normative. Lowercase "must" in explanatory prose is fine.

The document opens with the standard RFC 2119 boilerplate:

> The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

---

## 7. Implementation Sequence

Since all content feeds into a single file, the writing order matters only for efficiency (avoiding re-reads). Recommended order:

1. **Front-matter + header + RFC 2119 boilerplate** — scaffolding.
2. **Environment Variable Table (sec 15)** — needed as reference for conditions in other sections.
3. **Server Configuration (sec 1)** — PORT, body size, shutdown.
4. **CORS (sec 2)** — short, one source file.
5. **Security Headers (sec 3)** — short, same source file.
6. **Request Logger (sec 4)** — same source area.
7. **Error Response Format (sec 5)** — requires full grep of all route/service files.
8. **Rate Limiting (sec 6)** — requires full grep of all route files for overrides.
9. **Auth Contract (sec 7)** — the largest cross-cutting section; multiple source files.
10. **Endpoint Reference (sec 8)** — the bulk; process route group by route group.
11. **JSON Serialization (sec 9)** — requires re-visiting service response construction.
12. **Cursor Pagination (sec 10)** — one algorithm, one source location.
13. **Prometheus Metrics (sec 11)** — one source file.
14. **Redis Key Space (sec 12)** — grep across services.
15. **Header Inventory (sec 13)** — synthesized from all prior sections.
16. **Background Jobs (sec 14)** — bootstrap + services.
17. **SPA Serving (sec 16)** — create-app.ts.
18. **Risks (sec 17)** — last, since it cross-references all prior sections.

---

## 8. Spec Traceability

Every requirement from the 5 spec domains maps to a specific section and format element in the contract:

| Spec                    | Reqs                        | Covered By                                                       |
| ----------------------- | --------------------------- | ---------------------------------------------------------------- |
| contract-structure      | CS-001 through CS-008       | Document scaffolding, heading structure, front-matter, citations |
| endpoint-contract       | EP-001 through EP-010       | Section 8 endpoint entries using the template from Design sec 3  |
| serialization-contract  | SER-001 through SER-009     | Sections 9 + 10 + per-endpoint response shapes in sec 8          |
| auth-contract           | AUTH-001 through AUTH-009   | Section 7 + auth endpoint entries in sec 8                       |
| infrastructure-contract | INFRA-001 through INFRA-015 | Sections 1-6, 11-16, 17                                          |

All 51 requirements are addressed by the document structure defined above. No additional artifacts needed.
