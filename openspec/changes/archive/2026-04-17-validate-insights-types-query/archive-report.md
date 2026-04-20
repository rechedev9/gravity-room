# Archive report — validate insights `types` query

**Archived**: 2026-04-17
**Archive path**: `openspec/changes/archive/2026-04-17-validate-insights-types-query/`
**Capabilities touched**: `insights`

## Delta → main spec merge

- Source: `openspec/changes/validate-insights-types-query/specs/insights/spec.md` (delta, `## ADDED Requirements`).
- Target: `openspec/specs/insights/spec.md` (newly created — first spec for this capability).
- Merge operation: the two ADDED requirements and their scenarios were promoted into the main spec as permanent requirements. No modifications or removals to pre-existing requirements (there were none).

## Final test counts

- API suite: `282 / 282` passing (17 net new tests: 11 unit + 6 route integration + 3 error-handler)
- Typecheck: clean
- Format: clean
- Lint: clean on all files touched; one unrelated pre-existing error remains in `apps/api/src/bootstrap.ts:150`.

## Code shipped

Created:

- `apps/api/src/lib/insight-types.ts`
- `apps/api/src/lib/insight-types.test.ts`
- `apps/api/src/routes/insights.test.ts`

Modified:

- `apps/api/src/middleware/error-handler.ts` — `ApiError.details` field
- `apps/api/src/middleware/error-handler.test.ts` — 3 new tests
- `apps/api/src/create-app.ts` — spread `details` in `onError`
- `apps/api/src/routes/insights.ts` — validator wired in, reordered before rate-limit
- `apps/api/src/services/insights.ts` — signature widened to `readonly string[]`

## Follow-ups (deliberately out of scope)

- **`sdd-new dedupe-insight-types-catalog`** — extract `INSIGHT_TYPES` to `@gzclp/domain/catalog/insight-types` and rewire `apps/web/src/features/profile/profile-page.tsx:37-42` and `apps/web/src/features/home/home-page.tsx:18` to import from it. See design.md §D1 for why this was deferred.
- **OpenAPI `detail.responses` for 400** — the Elysia `detail.description` mentions the new shape but the `responses` block could be expanded with an explicit `400` schema for client code generators. Small, purely documentary.
