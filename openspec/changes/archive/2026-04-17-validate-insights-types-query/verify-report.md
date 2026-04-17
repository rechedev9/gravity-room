# Verify report — validate insights `types` query

**Date**: 2026-04-17
**Suite**: `cd apps/api && bun run test` — 282/282 pass
**Typecheck**: clean
**Format**: clean
**Lint**: clean on all files touched by this change (one pre-existing error in `bootstrap.ts:150` is out of scope)

---

## Compliance matrix

### Requirement 1 — closed-set validation

#### Scenario 1.1 — client requests all known types explicitly

**COMPLIANT**

- Test: `apps/api/src/routes/insights.test.ts` — _"returns 200 and filtered rows when all types are known"_
- Assertions: status `200`; `getInsights` called once with `['volume_trend', 'frequency']`.

#### Scenario 1.2 — client omits the `types` parameter

**COMPLIANT**

- Test: `apps/api/src/routes/insights.test.ts` — _"returns 200 and all rows when types param is omitted"_
- Assertions: status `200`; `getInsights` called with `[]` (no filter).

#### Scenario 1.3 — client sends an empty `types` value

**COMPLIANT**

- Test: `apps/api/src/routes/insights.test.ts` — _"treats types= (empty value) as omitted"_
- Assertions: status `200`; `getInsights` called with `[]`.

#### Scenario 1.4 — client sends a single unknown type

**COMPLIANT**

- Test: `apps/api/src/routes/insights.test.ts` — _"returns 400 with structured body for a single unknown type"_
- Assertions: status `400`; body has `code === 'INVALID_INSIGHT_TYPE'`, `invalidValues === ['bogus']`, `validValues === [...INSIGHT_TYPES]`; `getInsights` **not** called (spec's "no database query issued").

#### Scenario 1.5 — client mixes a valid and an unknown type

**COMPLIANT**

- Test: `apps/api/src/routes/insights.test.ts` — _"returns 400 when a valid type is mixed with an unknown type"_
- Assertions: status `400`; body has `code === 'INVALID_INSIGHT_TYPE'`, `invalidValues === ['bogus']`; `getInsights` **not** called (spec's "no partial results").

#### Scenario 1.6 — client sends a known type with surrounding whitespace

**COMPLIANT**

- Test: `apps/api/src/routes/insights.test.ts` — _"accepts whitespace around known type names"_
- Assertions: status `200`; `getInsights` called with `['frequency']`.

### Requirement 2 — machine-readable 400 payload

#### Scenario 2.1 — error payload shape

**COMPLIANT**

- Test coverage: Scenarios 1.4 and 1.5 both assert the three payload fields that the requirement demands:
  - stable error identifier → `body.code === 'INVALID_INSIGHT_TYPE'`
  - offending value(s) → `body.invalidValues`
  - full valid list → `body.validValues` deep-equals `[...INSIGHT_TYPES]`
- No dedicated test; the requirement is fully covered by the Scenario 1.4/1.5 assertions.

---

## Unit-level coverage (not strictly spec'd, but supports the design)

`apps/api/src/lib/insight-types.test.ts` — 11 tests covering the pure validator in isolation:

- undefined / empty → `ok([])`
- known single, known multiple → `ok([...])` with input order
- whitespace → trimmed
- consecutive commas → empty entries skipped
- duplicates → preserved (dedup is not a validation concern)
- unknown single, mixed, multiple-unknown → `err({ invalidValues })` preserving input order

These give `sdd-apply` a tighter inner-loop and catch regressions in the parser layer before they reach a route test.

## ApiError details extension (design D3)

`apps/api/src/middleware/error-handler.test.ts` — 3 new tests:

- `details` exposed when constructed with options
- `details` undefined when omitted (guards existing 75 throwers — confirmed in task 2.4)
- `details` coexists with `headers`

---

## Spec ↔ implementation matrix

| Spec requirement                  | Test file                                              | Verdict                   |
| --------------------------------- | ------------------------------------------------------ | ------------------------- |
| Closed-set validation (R1)        | `apps/api/src/routes/insights.test.ts`                 | COMPLIANT (6/6 scenarios) |
| Machine-readable 400 payload (R2) | `apps/api/src/routes/insights.test.ts` (via 1.4 + 1.5) | COMPLIANT                 |

---

## Out-of-scope items checked for non-regression

- **Existing `ApiError` throwers (75 call sites, 13 files).** `mem` grep confirmed none pass `details`. Their response shape is unchanged by the spread-with-fallback.
- **Service test suite** (`apps/api/src/services/insights.test.ts`) — still passes with the widened signature (`string[]` → `readonly string[]`).
- **Web consumers** (`profile-page.tsx`, `home-page.tsx`) — untouched per non-goals; both send only valid types so the 400 path is not reachable from them.

## Final verdict

**All spec scenarios COMPLIANT. Ready to archive.**
