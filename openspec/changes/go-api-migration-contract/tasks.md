---
summary: Apply artifact for go-api-migration-contract
phase: apply
status: complete
date: 2026-03-26
source_commit: bef5a51
---

# Apply: go-api-migration-contract

## Deliverables

1. **`openspec/contract/http-contract.md`** — Complete HTTP contract document (2064 lines)
2. **`openspec/changes/go-api-migration-contract/tasks.md`** — All 10 tasks + 15 success criteria marked `[x]`

## What Was Done

Wrote the full HTTP contract by reading every route, service, middleware, and lib file in `apps/api/src/` (28 source files total). The document captures:

- **34 endpoint entries** across 7 route groups (auth, programs, results, catalog, exercises, program-definitions, stats) plus infrastructure endpoints (health, metrics, SPA fallback)
- **34-row rate limit table** with exact window/max/key-template per endpoint, derived from both Redis sliding-window and in-memory stores
- **40-row error code inventory** covering every `ApiErrorCode` and HTTP status mapping
- **26-row null-vs-omit table** documenting JSON serialization differences relevant to Go's `omitempty`
- **17-row environment variable table** with types, defaults, and validation rules
- **7-row Redis key space** with TTLs and eviction patterns
- **15 risk entries** with severity ratings and cross-references to spec sections

All 17 H2 sections present in required order. RFC 2119 normative language throughout. Zero unresolved `[VERIFY]` annotations. All internal anchor links resolve.

## Tasks Completed

- [x] **1.1 Create** — Scaffolding: YAML frontmatter, header block with SHA, RFC 2119 boilerplate, 17 H2 section stubs
- [x] **2.1 Add** — Server Configuration, CORS Configuration, Security Headers
- [x] **2.2 Add** — Request Logger & Request ID, Error Response Format
- [x] **2.3 Add** — Rate Limiting (34-row table, fail-open, Lua script, 429 shape)
- [x] **2.4 Add** — Auth Contract (JWT, cookies, rotation, theft detection, Google OAuth)
- [x] **3.1 Add** — Endpoint Reference: Auth Routes, Program Routes, Result Routes (16 endpoints)
- [x] **3.2 Add** — Endpoint Reference: Catalog, Exercise, Program Definition, Stats, System Routes (14+ endpoints)
- [x] **4.1 Add** — JSON Serialization, Cursor Pagination, Prometheus Metrics, Redis Key Space
- [x] **4.2 Add** — Header Inventory, Background Jobs, Env Vars, SPA Serving, Middleware Order
- [x] **5.1 Add + Verify** — Risks section, verification pass, anchor resolution

## Verification

| Criterion               | Required | Actual  | Pass |
| ----------------------- | -------- | ------- | ---- |
| H2 sections             | 17       | 17      | Yes  |
| H4 endpoint entries     | >= 28    | 34      | Yes  |
| Rate limit rows         | >= 25    | 34      | Yes  |
| Error code rows         | >= 30    | 40      | Yes  |
| Null-vs-omit rows       | >= 10    | 26      | Yes  |
| Env var rows            | 17       | 17      | Yes  |
| Redis key rows          | 7        | 7       | Yes  |
| Risk entries            | > 0      | 15      | Yes  |
| Unresolved [VERIFY]     | 0        | 0       | Yes  |
| Source commit in header | bef5a51  | Present | Yes  |
