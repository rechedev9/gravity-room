---
summary: Proposal to produce the HTTP contract oracle document for the Go API migration (Lote 0).
read_when: Reviewing or approving the contract-capture change before Go implementation begins.
---

# Proposal: go-api-migration-contract

**Change ID:** go-api-migration-contract
**Lote:** 0 — Bootstrap + contract capture
**Phase:** Propose
**Date:** 2026-03-26

---

## Intent

Produce a single, authoritative contract document (`openspec/contract/http-contract.md`) that captures the complete HTTP surface of the current TypeScript/ElysiaJS API. This document becomes the oracle that every subsequent Go migration lote is validated against.

Why now, before any Go code is written:

- The TS API encodes dozens of non-obvious behavioral details (null-vs-omit semantics, cursor format, cookie path scope, rate-limiter key identities, JSONB pass-through, etc.) that are invisible from the type signatures alone. They exist only in the service layer and middleware implementations.
- A contract written after the Go port risks being reverse-engineered from the Go code rather than from the canonical TS behavior — turning the oracle into a mirror of the thing it is supposed to validate.
- Capturing the contract first forces every ambiguity to be resolved against the running TS source before it can silently propagate into the Go implementation.

The deliverable is documentation, not code. No Go files, no TS changes, no schema migrations.

---

## Scope

**In scope:**

- One Markdown contract document covering all 28+ HTTP endpoints across the six route groups (`/api/auth`, `/api/programs`, `/api/programs/:id/results`, `/api/catalog`, `/api/exercises` + `/api/muscle-groups`, `/api/program-definitions`, `/api/stats/online`, `/health`, `/metrics`).
- Per-endpoint specification: method, path, auth requirement, rate-limit (window, max, key identity), request body shape, query parameters, response body shape for every status code, side effects (cookie mutations, cache invalidation, background jobs), and all known error codes.
- Cross-cutting contract sections:
  - CORS configuration (origins, `credentials: true`, reflected headers)
  - Security headers (exact CSP string, HSTS conditionality, all header names and values)
  - JWT contract (algorithm, secret constraints, payload claims, expiry, transmission)
  - Refresh-token cookie contract (name, attributes, `path=/api/auth` scope, rotation semantics, theft detection)
  - Error response shape (`{ "error": "...", "code": "..." }`) and full error code inventory
  - JSON serialization rules (camelCase, ISO 8601 with ms + Z, null-vs-omit table per field, JSONB pass-through)
  - Cursor pagination format and parsing algorithm
  - Rate-limiter behavior (sliding window, key formats, Redis Lua script, fail-open)
  - Redis key space (all key patterns, TTLs, purposes)
  - Prometheus metrics (metric names, label sets, histogram buckets, route normalization regex)
  - Request/response header inventory (consumed and emitted)
  - Background jobs (token cleanup every 6 h, presence fire-and-forget)
  - Environment variable table (name, required, default, purpose)
  - Body size limit (1 MB)
  - SPA serving routes
- Risks and known pitfalls section derived from the exploration document, annotated with the Go implementation consequence of each risk.

**Out of scope:**

- Any Go source files, directory scaffolding, or `go.mod` entries.
- Changes to existing TS source code.
- Database migrations.
- Test files of any kind.
- CI/CD configuration.
- The exploration document itself (already produced; this proposal builds on it).
- Any "recommended approach" for the Go implementation beyond what is necessary to specify the contract precisely.

---

## Approach

1. **Single artifact.** Write `openspec/contract/http-contract.md`. Create the `openspec/contract/` directory if it does not exist.

2. **Source of truth is the TS source, not the exploration.** The exploration document (1 261 lines, already verified against the source tree at commit `bef5a51`) provides the structured summary. Where the contract document needs to cite an exact value (e.g., CSP string, cookie `maxAge`, regex patterns), verify against the actual source file and line cited in the exploration table.

3. **Structure the contract for Go implementors, not TS readers.** Each section should be phrased as a normative requirement ("MUST", "MUST NOT", "SHOULD") so a Go author can tick off compliance without re-reading the exploration narrative.

4. **Null-vs-omit table.** Produce an explicit per-field table distinguishing the three serialization behaviors: always-present-possibly-null, omitted-when-null, always-present-never-null. This is the highest-risk serialization difference between TS spread conditionals and Go `json:",omitempty"`.

5. **Rate-limiter key table.** Produce a compact table with columns: endpoint, window (ms), max requests, key identity. This is the canonical reference for all 25+ per-endpoint overrides.

6. **Cursor algorithm.** Specify the exact parsing algorithm (`lastIndexOf('_')`) and the SQL `WHERE` predicate used for keyset pagination — not just the format.

7. **Risk annotations.** Each identified risk from the exploration is surfaced in a dedicated risks section, cross-referenced to the relevant contract section.

8. **Front-matter.** The document gets YAML front-matter (`summary`, `read_when`) per project docs convention.

---

## Risks

| Risk                                                                                                                                                                                            | Impact                                                                                                      | Mitigation                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Contract diverges from TS source** if a TS code change is merged to `go-api` branch after `bef5a51` before the contract is written.                                                           | Go implementation validated against a stale oracle.                                                         | Pin the contract to commit SHA `bef5a51` in the document header; any TS changes after that point must trigger a contract amendment before the affected lote ships.                                   |
| **Ambiguities survive into the contract** for edge cases not exercised in the exploration (e.g., empty `config` object, zero-item `undoHistory`, concurrent refresh-token rotation under test). | Silent behavioral differences in the Go port.                                                               | Flag any field or behavior where the exploration uses "likely", "unclear", or derives behavior from inference rather than direct source reading. Mark these as "VERIFY" annotations in the contract. |
| **Go `json:",omitempty"` silently null-ifies omitted fields** if the implementor uses the wrong struct tag.                                                                                     | Client receives `null` where the field should be absent; clients that use `"key" in obj` checks will break. | The null-vs-omit table in the contract makes this explicit. The contract's risks section specifies that custom `MarshalJSON` or pointer-with-omitempty is required for affected fields.              |
| **Cookie `Path=/api/auth` scope** misunderstood: if the Go server sets `Path=/` the browser will still send it, but if it sets no `Path` the behavior is browser-dependent.                     | Refresh token not sent on auth routes in some browsers.                                                     | Contract specifies the attribute value exactly; risks section calls this out as a MUST.                                                                                                              |
| **HSTS conditionality** (`NODE_ENV === 'production'`): if Go uses a different env var name or logic, HSTS may appear in dev or disappear in production.                                         | Security regression in production; double-header in dev.                                                    | Contract specifies the exact condition and the env var.                                                                                                                                              |
| **Prometheus route normalization regex** uses a JS regex with `gi` flags. Go `regexp` package is RE2 (no backreferences, same effect here, but case-insensitivity flag differs).                | Metric label cardinality explodes if UUIDs are not normalized.                                              | Contract reproduces the two regexes and specifies the Go-equivalent pattern.                                                                                                                         |
| **`isNewUser` heuristic** (`\|createdAt - updatedAt\|` < 2000ms) is a timing heuristic that can misfire under DB load.                                                                          | Telegram notification sent for returning users, or suppressed for new users.                                | Contract documents this as a known imprecision, not a defect to fix.                                                                                                                                 |

---

## Rollback Plan

This change produces only a documentation artifact under `openspec/contract/`. It introduces no runtime behavior changes.

To roll back:

1. Delete `openspec/contract/http-contract.md` (or `trash openspec/contract/http-contract.md`).
2. If the directory `openspec/contract/` was created by this change and is now empty, remove it.

No database migrations, no dependency changes, no TS or Go source modifications are involved. Rollback has zero production risk.

If the contract document is found to contain errors after Go lotes have begun consuming it, the correct action is to issue a contract amendment (a new change in `openspec/changes/`) rather than rolling back this change. The amendment must identify which lotes are affected and require re-validation of the corresponding Go code.
