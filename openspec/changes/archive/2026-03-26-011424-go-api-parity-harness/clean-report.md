---
summary: Clean report for go-api-parity-harness — 1 dead export removed, 4 inline duplicates consolidated.
read_when: Reviewing cleanup results for the harness change before archiving.
---

# Clean Report: go-api-parity-harness

**Date**: 2026-03-26
**Status**: SUCCESS

## Files Cleaned

| File                                      | Actions                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `apps/harness/src/schemas/results.ts`     | Removed `RecordResultResponseSchema` — dead export, no consumers        |
| `apps/harness/src/tests/programs.test.ts` | Replaced 4 inline `DEFAULT_WEIGHTS` literals with the imported constant |

## Lines Removed

| File                                      | Lines removed                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/harness/src/schemas/results.ts`     | 13 (schema definition + comment)                                                 |
| `apps/harness/src/tests/programs.test.ts` | 4 × 1 (each `config: { squat: 60, ... }` collapsed to `config: DEFAULT_WEIGHTS`) |

**Total**: ~17 lines removed / simplified

## Actions Taken

### Pass 1 — Dead Code & Stale References

- **Unused exports removed**: 1
  - `RecordResultResponseSchema` (`schemas/results.ts`) — exported but never imported anywhere in the workspace. The apply report (phase 4 grounding deviations #1) explicitly documents that tests validate the actual result-entry shape directly inline rather than via this schema.
- **Dead functions removed**: 0
- **Stale docs fixed**: 0

**Retained exports (intentional stubs):**

- `ExportResponseSchema`, `ImportResponseSchema` (`schemas/programs.ts`) — no tests for export/import flows yet; these document the contract for future coverage.
- `CreateExerciseResponseSchema` (`schemas/exercises.ts`) — no POST /api/exercises test yet; retains contract documentation.

**Comment note (not a code bug):**

- The verify report spec doc says `body.status === "healthy"` but `system.test.ts` correctly asserts `body.status === 'ok'`. The actual API (`create-app.ts:143`) returns `'ok'` or `'degraded'`. The spec doc has a stale value — the test is correct.

### Pass 2 — Duplication & Reuse

- **Duplicates consolidated**: 1
  - `programs.test.ts` repeated the GZCLP config object `{ squat: 60, bench: 40, deadlift: 60, ohp: 30, latpulldown: 30, dbrow: 12.5 }` identically in 4 POST `/api/programs` tests. `DEFAULT_WEIGHTS` already exists in `helpers/seed.ts` with the same values. Added `DEFAULT_WEIGHTS` to the existing `seed` import and replaced all 4 occurrences.
- **Helpers extracted to shared module**: 0

### Pass 3 — Quality & Efficiency

- **Complexity reductions**: 0 (no functions exceed 50 lines; nesting depth ≤ 3 throughout)
- **Efficiency improvements**: 0
- **Reverted changes**: 0

**`as` casts in test files**: All casts narrow `res.json()` (which returns `unknown`) to specific shapes for assertions. This is idiomatic bun:test pattern — not a type-safety concern.

**`_url` parameter in `cookie-jar.ts`**: `captureFromResponse(_url: URL, response: Response)` — `_url` is intentionally unused (underscore prefix). Kept as designed extension point for domain-scoped capture.

## Documentation Synchronization

| File | Function | Fix Type | Description                          |
| ---- | -------- | -------- | ------------------------------------ |
| —    | —        | —        | No stale docs found in changed files |

## Build Status

- Typecheck (harness): PASS
- Typecheck (all workspaces): PASS
- Lint (all workspaces): PASS
- Tests: not runnable offline (requires live API) — typecheck confirms structural correctness
