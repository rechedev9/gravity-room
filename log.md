# Project Log

Accumulated context, decisions, and constraints for Gravity Room. Append-only.

---

## 2026-04-09 — isvidal stack audit as driver for current refactor wave

The current refactor wave is driven by a compliance audit against the "isvidal 2026 React stack" philosophy (documented in the `rechedev9/react-goodways` analysis repo). Key rules being enforced:

- TypeScript strict mode, never `any`.
- `useEffect` is a code smell — state should always be declarative/derived from data, never imperative.
- React Query covers 99% of server state.
- API types must be auto-generated (OpenAPI → typed client), never hand-written — manual API types are considered technical debt.
- Zod as source of truth for runtime validation at all API boundaries; types derived via `z.infer<>`.
- React Hook Form + zodResolver for all form validation.
- TanStack Router (not react-router-dom).
- TanStack Table for tabular data.
- No Prettier, no Jest/Testing Library (partial — we use Bun test runner + Testing Library as a pragmatic compromise).

The full audit results and deltas are tracked in `roadmap.md`. This log captures only the decisions and discoveries that outlive the current roadmap.

---

## 2026-04-09 — OpenAPI spec is hand-maintained and embedded in Go binary

`apps/go-api/internal/swagger/openapi.json` is a hand-written OpenAPI 3.0.3 spec embedded via `//go:embed` in `swagger.go`. It defines 16 component schemas covering every endpoint the web app consumes. It is served at `/swagger/json` in non-production environments.

**Implications for any future change:**

- The Go API does NOT auto-generate its OpenAPI spec from handlers. Changing a handler's response shape requires manually editing `openapi.json`. There is a drift risk between handler code and spec.
- The web app's codegen pipeline (to be added in the current refactor) will read this file as its source of truth. If the spec drifts from reality, the web validation will surface the mismatch at runtime via Zod `.parse()` failures.
- A follow-up worth considering later: replace the hand-maintained spec with a generator like `swaggo/swag` (annotation-based) or `oapi-codegen` (spec-first where the spec generates handlers). Not in scope for the current wave.

---

## 2026-04-09 — Legacy shell retains two production-used files

`apps/web/src/features/legacy-shell/` is marked for removal but two files still have external consumers:

- `avatar-dropdown.tsx` → imported by `components/layout/app-sidebar.tsx`
- `dashboard-skeleton.tsx` → imported by `main.tsx` as Suspense fallback for `/app`, `/app/dashboard`, `/app/programs`

These must be moved to shared component locations before the directory can be deleted. Everything else in `legacy-shell/` (`app-shell.tsx`, `app-header.tsx`, `dashboard.tsx`, `onboarding-banner.tsx`, and the three test files) has no external consumers and is safe to delete.

`AppShell` itself is not mounted anywhere in `main.tsx` — it was superseded by the route-based `AppLayout` but left in place "for old tests and migration safety" (per its own comment).

---

## 2026-04-09 — Two-layer Zod strategy for API boundary validation

Decision: maintain TWO sets of Zod schemas rather than conflating them.

1. **API layer schemas** — will describe exactly what the Go server returns over the wire. Generated (or mirroring) the OpenAPI spec. Lives at `apps/web/src/lib/api/schemas/` (new) or similar.
2. **Domain layer schemas** — `apps/web/src/lib/shared/schemas/` (existing). Describe the application's domain model with refinements, discriminated unions, and invariants. Some sub-schemas (e.g., `ProgramDefinitionSchema`) are already used transitively for catalog responses.

The API layer parses at the fetch boundary; if the shape needs enrichment for app use, a transform step converts API → domain types. This keeps the generated/API schemas pristine and the domain schemas expressive.

---

## 2026-04-09 — All 7 phases executed in single session

Full isvidal 2026 React stack compliance refactor completed:

- Phase 1: 3 high-severity useEffect violations fixed
- Phase 2: legacy-shell deleted (avatar-dropdown + dashboard-skeleton relocated)
- Phase 3: all hand-rolled API parsers replaced with Zod schemas (8 new schema files)
- Phase 4: openapi-zod-client added, bun run api:types generates generated.ts for drift detection
- Phase 5: 7 forms migrated to react-hook-form + zodResolver
- Phase 6: react-router-dom fully replaced with @tanstack/react-router
- Phase 7: useDocumentTitle hook (10 pages), useDeferredValue in exercise-picker

Final state: 481 tests pass, 0 fail. All phases committed with conventional commits.

---

## 2026-04-09 — Phase 1 started: declarative state fixes

### Step 1.1 — auth-context.tsx (session restore via useQuery)

- `UserResponseSchema` and `UserInfo` type added to `api-functions.ts` (will move to `lib/shared/schemas/user.ts` in Phase 3.8). Handles `name`/`avatarUrl` as `.nullable().optional()` with `?? undefined` transform to preserve the existing `UserInfo` optional-field shape.
- `parseUserSafe(data: unknown): UserInfo | null` exported from `api-functions.ts` — used by `signInWithGoogle`/`signInWithDev` for the nested `data.user` object.
- `fetchMe(): Promise<UserInfo>` exported from `api-functions.ts`.
- `AuthProvider` now uses `useQueryClient()` + `useQuery({ queryKey: ['auth', 'session'], staleTime: Infinity, gcTime: Infinity, retry: false })`.
- `signInWithGoogle`/`signInWithDev` call `queryClient.setQueryData` instead of `setUser`.
- `updateUser` uses `queryClient.setQueryData` functional updater.
- `signOut`/`deleteAccount` set session query data to `null`.
- `parseUserInfo` helper deleted.
- `auth-context.test.tsx` updated: wrapper wraps `AuthProvider` in `QueryClientProvider` with `retry: false`; `fetchMe: mockFetchMe` added to the `@/lib/api-functions` module mock.

### Step 1.2 — definition-wizard/index.tsx (eliminate shadow copy)

- Removed `useEffect` that copied `defQuery.data` to `localDef` once.
- Replaced with `useState` initialized from query data if available at mount time.
- `workingDef` derived as `draft ?? parseDefinition(defQuery.data?.definition) ?? null`.
- `isDirty` becomes `draft !== null` (no separate boolean state).
- `handleUpdate` sets draft based on current working definition.

### Step 1.3 — use-day-navigation.ts (render-phase state derivation)

- Replaced `useEffect([config])` with the React render-phase state update pattern (getDerivedStateFromProps equivalent).
- `prevConfigRef` tracks the previous config reference; when it changes, `selectedDayIndex` is synchronously reset to `firstPendingIdx` during the render pass rather than after paint.
- No behavioral change — preserves exact semantics of the original `useEffect`.
- Added `use-day-navigation.test.ts` (new file — roadmap required it).

---
