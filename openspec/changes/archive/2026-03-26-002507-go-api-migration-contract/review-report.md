# Review Report: go-api-migration-contract

**Date**: 2026-03-26
**Reviewer**: sdd-review (automated)
**Status**: PASSED

## Summary

The HTTP contract document is comprehensive, accurate, and well-structured. All 51 spec requirements are addressed. Source spot-checks against 8 TS files confirm high fidelity — exact values match character-for-character where verifiable. Two minor citation imprecisions found (non-blocking). The document is fit to serve as the migration oracle.

---

## Structural Check

| Criterion                                           | Required                                                             | Actual                  | Status |
| --------------------------------------------------- | -------------------------------------------------------------------- | ----------------------- | ------ |
| Single file at `openspec/contract/http-contract.md` | Yes                                                                  | Yes                     | PASS   |
| YAML front-matter with `summary` + `read_when`      | Yes                                                                  | Both present, non-empty | PASS   |
| Pinned commit SHA `bef5a51`                         | Yes                                                                  | Present at line 9       | PASS   |
| RFC 2119 boilerplate                                | Yes                                                                  | Present at line 13      | PASS   |
| H2 sections                                         | 17                                                                   | 17                      | PASS   |
| H4 endpoint entries                                 | >= 28                                                                | 34                      | PASS   |
| Route group order                                   | Auth, Programs, Results, Catalog, Exercises, ProgDefs, Stats, System | Matches                 | PASS   |
| Rate limit table rows                               | >= 25                                                                | 34                      | PASS   |
| Error code inventory rows                           | >= 30                                                                | 40                      | PASS   |
| Null-vs-omit table rows                             | >= 10                                                                | 26                      | PASS   |
| Environment variable table rows                     | 17                                                                   | 17                      | PASS   |
| Redis key space rows                                | 7                                                                    | 7                       | PASS   |
| Risk entries                                        | > 0                                                                  | 15                      | PASS   |
| Unresolved `[VERIFY]` annotations                   | 0                                                                    | 0                       | PASS   |

---

## Requirement Coverage: 51/51

### Contract Structure (REQ-CS-001 through REQ-CS-008)

| REQ        | Status  | Notes                                                                                              |
| ---------- | ------- | -------------------------------------------------------------------------------------------------- |
| REQ-CS-001 | COVERED | Single file at correct path                                                                        |
| REQ-CS-002 | COVERED | Front-matter has `summary` and `read_when`                                                         |
| REQ-CS-003 | COVERED | Header contains `bef5a51`, change ID, branch, date                                                 |
| REQ-CS-004 | COVERED | RFC 2119 keywords used throughout (MUST, MUST NOT, SHOULD, MAY)                                    |
| REQ-CS-005 | COVERED | All 17 sections present in order                                                                   |
| REQ-CS-006 | COVERED | Risk entries cross-reference sections via anchor links (spot-checked 8/15, all resolve)            |
| REQ-CS-007 | COVERED | No unresolved `[VERIFY]` annotations found                                                         |
| REQ-CS-008 | COVERED | Source citations present on exact values (CSP string, cookie maxAge, regex, body size limit, etc.) |

### Endpoint Contract (REQ-EP-001 through REQ-EP-010)

| REQ        | Status  | Notes                                                                                                                                                                                |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| REQ-EP-001 | COVERED | 34 endpoints documented (exceeds 28 minimum)                                                                                                                                         |
| REQ-EP-002 | COVERED | All 10 fields present on spot-checked endpoints (POST /auth/google, GET /programs, DELETE /programs/:id/results/:workoutIndex/:slotId, PATCH /programs/:id/metadata, GET /exercises) |
| REQ-EP-003 | COVERED | Route groups in order: Auth, Programs, Results, Catalog, Exercises, Program Definitions, Stats, System                                                                               |
| REQ-EP-004 | COVERED | `GET /auth/me` explicitly documented as "manual JWT extraction" (line 559). All other protected routes state "resolveUserId guard"                                                   |
| REQ-EP-005 | COVERED | Validation constraints documented inline (e.g., `minLength 1, maxLength 100` for name, `config` key constraints, avatar regex + size limit, `amrapReps` max 99)                      |
| REQ-EP-006 | COVERED | Side effects documented per endpoint (cookie mutations, cache invalidation, undo stack, auto-complete, fire-and-forget operations)                                                   |
| REQ-EP-007 | COVERED | `GET /programs` references cursor-based pagination (line 686). `GET /exercises` and `GET /program-definitions` document offset-based with response shapes                            |
| REQ-EP-008 | COVERED | Caching documented for GET /programs/:id (Redis key, TTL, singleflight, invalidation), GET /catalog (Cache-Control + Redis), GET /exercises (conditional Cache-Control + Redis)      |
| REQ-EP-009 | COVERED | `POST /api/auth/dev` marked dev-only with `NODE_ENV !== 'production'` condition and 404 fallback (line 462)                                                                          |
| REQ-EP-010 | COVERED | DELETE result endpoint explicitly states "none (no `rateLimit()` call in this handler)" with source citation (line 1031)                                                             |

### Serialization Contract (REQ-SER-001 through REQ-SER-009)

| REQ         | Status  | Notes                                                                                                                                                   |
| ----------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-SER-001 | COVERED | "All JSON keys MUST use camelCase" (line 1698)                                                                                                          |
| REQ-SER-002 | COVERED | Format string documented, Go `time.RFC3339Nano` warning present (lines 1700-1708)                                                                       |
| REQ-SER-003 | COVERED | 26-row null-vs-omit table covering all spec-required fields                                                                                             |
| REQ-SER-004 | COVERED | Go consequence column present with `*T` / `omitempty` / value type guidance                                                                             |
| REQ-SER-005 | COVERED | All 5 JSONB pass-through fields documented (config, metadata, definition, customDefinition, set_logs) with `json.RawMessage` guidance (lines 1743-1753) |
| REQ-SER-006 | COVERED | "Numbers use standard JavaScript float64 precision" (line 1757)                                                                                         |
| REQ-SER-007 | COVERED | Full cursor spec: format, `lastIndexOf('_')` parsing, SQL WHERE predicate, generation logic, page size (lines 1768-1812)                                |
| REQ-SER-008 | COVERED | Undo response explicitly notes `prevRpe` and `prevAmrapReps` NOT included (line 1089)                                                                   |
| REQ-SER-009 | COVERED | Empty collections specified: `{}` for results/timestamps, `[]` for undoHistory/data (lines 1759-1764)                                                   |

### Auth Contract (REQ-AUTH-001 through REQ-AUTH-009)

| REQ          | Status  | Notes                                                                                                                                         |
| ------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-AUTH-001 | COVERED | Algorithm (HS256), secret constraints (64+ chars prod), claims (sub, email, exp), transmission (Bearer), cross-server interop (line 311)      |
| REQ-AUTH-002 | COVERED | All 5 cookie attributes with exact values (lines 318-326). Path `/api/auth` present                                                           |
| REQ-AUTH-003 | COVERED | 9-step rotation flow documented (lines 332-342)                                                                                               |
| REQ-AUTH-004 | COVERED | Theft detection: successor lookup via `previous_token_hash`, nuclear revocation (lines 346-353)                                               |
| REQ-AUTH-005 | COVERED | JWKS URL, cache TTL (1 hour), issuer validation (both forms), audience, upsert SQL, new-user heuristic (`\|createdAt - updatedAt\|` < 2000ms) |
| REQ-AUTH-006 | COVERED | Signout: cookie clearing, no-op when absent, 204 response (lines 375-380)                                                                     |
| REQ-AUTH-007 | COVERED | Account deletion: soft-delete, access token window, `findUserById()` filter (lines 384-398)                                                   |
| REQ-AUTH-008 | COVERED | Auth guard soft-delete boundary: `resolveUserId` does NOT check `deleted_at`, only JWT (line 398)                                             |
| REQ-AUTH-009 | COVERED | Avatar regex, 200KB limit, roundtrip validation, null-to-remove (lines 401-407)                                                               |

### Infrastructure Contract (REQ-INFRA-001 through REQ-INFRA-015)

| REQ           | Status  | Notes                                                                                              |
| ------------- | ------- | -------------------------------------------------------------------------------------------------- |
| REQ-INFRA-001 | COVERED | CORS: credentials true, origin source, header mirroring (lines 75-83)                              |
| REQ-INFRA-002 | COVERED | 6 security headers with exact values and conditions (lines 92-106)                                 |
| REQ-INFRA-003 | COVERED | Algorithm (sliding-window), Lua script operations, fail-open, 429 shape (lines 218-250)            |
| REQ-INFRA-004 | COVERED | 34-row rate limit table (lines 254-289)                                                            |
| REQ-INFRA-005 | COVERED | 7 Redis key patterns with TTL and purpose (lines 1856-1864)                                        |
| REQ-INFRA-006 | COVERED | 5 custom metrics with types, labels, buckets, 2 route normalization regexes (lines 1825-1850)      |
| REQ-INFRA-007 | COVERED | 17 env var rows with required/default/purpose (lines 1937-1955)                                    |
| REQ-INFRA-008 | COVERED | Request ID regex, IP extraction logic, log fields (lines 112-144)                                  |
| REQ-INFRA-009 | COVERED | Body size limit: `1 048 576` bytes (line 23)                                                       |
| REQ-INFRA-010 | COVERED | 3 background jobs: token cleanup, presence tracking, telegram notification (lines 1910-1931)       |
| REQ-INFRA-011 | COVERED | SPA: static directory, index.html fallback, security.txt content-type, catch-all (lines 1960-1970) |
| REQ-INFRA-012 | COVERED | Error shape documented, 40-row error code inventory, status mapping rules (lines 149-213)          |
| REQ-INFRA-013 | COVERED | Middleware order in Section 1 (lines 53-68): global + route-level order specified                  |
| REQ-INFRA-014 | COVERED | SIGTERM/SIGINT, 10s grace period, `.unref()` (lines 39-49)                                         |
| REQ-INFRA-015 | COVERED | 15 risk entries with cross-references and Go consequences (lines 1974-2064)                        |

---

## Source Accuracy Spot-Checks

10 values verified against actual TS source at HEAD:

| #   | Claim (contract)                                             | Source File:Line        | Verdict                                                                      |
| --- | ------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------- |
| 1   | CSP string verbatim                                          | `bootstrap.ts:48-49`    | EXACT MATCH                                                                  |
| 2   | `maxRequestBodySize: 1_048_576`                              | `bootstrap.ts:156`      | EXACT MATCH                                                                  |
| 3   | Default port `3001`                                          | `bootstrap.ts:43`       | EXACT MATCH                                                                  |
| 4   | Shutdown timeout `10_000` ms                                 | `bootstrap.ts:168`      | EXACT MATCH                                                                  |
| 5   | Rate limit defaults: `60_000` ms / `20` max                  | `rate-limit.ts:83-84`   | EXACT MATCH                                                                  |
| 6   | Rate limit key format `rl:<endpoint>:<ip>`                   | `rate-limit.ts:94`      | EXACT MATCH                                                                  |
| 7   | UUID normalization regex in metrics                          | `plugins/metrics.ts:14` | EXACT MATCH                                                                  |
| 8   | Pino redaction paths                                         | `logger.ts:10-15`       | EXACT MATCH — 4 paths with censor `[Redacted]`                               |
| 9   | Request ID regex `/^[\w-]{8,64}$/`                           | `request-logger.ts:15`  | EXACT MATCH                                                                  |
| 10  | Cookie attributes (httpOnly, secure, sameSite, maxAge, path) | `routes/auth.ts:55-61`  | EXACT MATCH — including `maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60` = 604800 |

---

## Issues Found

### SUGGESTION (Non-Blocking)

| #   | Severity   | File:Line               | Description                                                                                                                                                                                                                                              |
| --- | ---------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | SUGGESTION | `http-contract.md:98`   | `permissions-policy` source citation says `bootstrap.ts:51-52`. This is where the VALUE is defined, but the header is SET at `create-app.ts:57`. Both files should be cited for full traceability.                                                       |
| 2   | SUGGESTION | `http-contract.md:297`  | JWT plugin source cited as `auth-guard.ts:39-43`, but the export actually starts at line 38. Off-by-one in citation.                                                                                                                                     |
| 3   | SUGGESTION | `http-contract.md:1850` | "httpRequestDuration is NOT recorded on errors" — the contract states this correctly but does not cite the specific line where the start time is deleted without observation (`plugins/metrics.ts:42-43`). Adding a citation would strengthen the claim. |

---

## Normative Language Assessment

The document consistently uses RFC 2119 keywords:

- **MUST** / **MUST NOT** for mandatory behaviors (body size, cookie attributes, error shapes, serialization rules)
- **SHOULD** for recommendations (Go implementation notes, CORS header mirroring)
- **MAY** used sparingly

Uppercase keywords appear only in normative contexts. Lowercase "must" appears in explanatory prose appropriately. No violations found.

---

## Anchor Resolution

Spot-checked 8 of 15 risk cross-references:

- `[Auth Contract](#7-auth-contract)` — resolves to line 293
- `[JSON Serialization Rules](#9-json-serialization-rules)` — resolves to line 1694
- `[Rate Limiting](#6-rate-limiting)` — resolves to line 216
- `[Cursor Pagination](#10-cursor-pagination)` — resolves to line 1768
- `[Security Headers](#3-security-headers)` — resolves to line 87
- `[Error Response Format](#5-error-response-format)` — resolves to line 147
- `[Background Jobs](#14-background-jobs)` — resolves to line 1908
- `[Endpoint Reference](#8-endpoint-reference)` — resolves to line 411

All checked anchors resolve correctly.

---

## Verdict

**PASSED**

The HTTP contract document satisfies all 51 spec requirements. It is structurally complete (17 sections, 34 endpoints, all required tables), factually accurate (10/10 source spot-checks matched exactly), and uses RFC 2119 normative language consistently. The 3 suggestions found are minor citation improvements that do not affect the document's utility as a migration oracle.
