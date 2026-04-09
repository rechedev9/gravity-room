# Gravity Room — Roadmap

**Last updated:** 2026-04-09
**Status:** All phases complete — roadmap fully executed

---

## Objective

Bring `apps/web/` into compliance with the isvidal 2026 React stack philosophy: eliminate `useEffect`-driven imperative state, extend Zod validation to every API boundary, automate API type generation from the existing OpenAPI spec, migrate all forms to React Hook Form + zodResolver, delete the legacy shell, and migrate routing from `react-router-dom` to `@tanstack/react-router`.

Each phase below is a committable checkpoint. CI must be green (`bun run ci`) at the end of every phase before moving on.

---

## Current State

- **Stack today:** React 19 + Vite 7 + TS strict + Tailwind v4 + TanStack Query v5 + Zod v4 + `react-router-dom@7` + hand-rolled shadcn/ui components (no `components.json`).
- **Missing libs:** `@tanstack/react-router`, `react-hook-form`, `@hookform/resolvers`, `@tanstack/react-table`, any OpenAPI codegen tool.
- **Anti-patterns found in audit:**
  - 47 `useEffect` call sites. 3 high-severity violations (`auth-context.tsx`, `definition-wizard/index.tsx`, `use-day-navigation.ts`), 10 repeated `document.title` effects, several avoidable navigation effects.
  - 133 `useState` call sites. `legacy-shell/app-shell.tsx` alone holds 7 pieces of state that belong in the URL (7 are inside a dead-code file).
  - 1 TS `any` in `lazy-with-retry.ts` (unavoidable generic constraint for `React.lazy`).
- **Zod coverage:** 3 of ~25 API functions use `.parse()` at the boundary (`fetchCatalogDetail`, `fetchExercises`, `importProgram` request only). The other 22 use hand-rolled parsers (`parseSummary`, `parseGenericResults`, `parseDefinitionResponse`, etc.).
- **Orphaned schemas:** `ProgramInstanceSchema`, `GenericResultsSchema`, `GenericUndoHistorySchema` exist in `src/lib/shared/schemas/instance.ts` but are never used at the API boundary — the endpoints that fetch these shapes (`fetchGenericProgramDetail`, `updateProgramMetadata`) hand-roll their own parsers.
- **OpenAPI spec:** `apps/go-api/internal/swagger/openapi.json` exists, hand-maintained, covers 16 component schemas. This is the source of truth we'll feed into codegen.
- **Forms:** 9 real forms (login is OAuth-only so excluded). None use `react-hook-form`. One (`progression-step.tsx`) already uses `ProgramDefinitionSchema.safeParse()` for validation.
- **Routing:** 29 production files import from `react-router-dom`. `Link` in 16 files, `useNavigate` in 11. No loaders/actions used. Auth guards are imperative `useEffect` redirects (login-page, program-app). `createBrowserRouter` style.
- **Legacy shell:** `src/features/legacy-shell/` contains `app-shell.tsx` (dead — not mounted in router), but `avatar-dropdown.tsx` and `dashboard-skeleton.tsx` are actively imported by production code and must move before the directory can be deleted.

---

## Approach

**Chosen strategy:** order phases by dependency and risk — declarative state fixes first (smallest blast radius, unblocks thinking), then legacy-shell cleanup (reduces surface area before bigger migrations), then Zod boundary coverage (foundation for codegen), then OpenAPI codegen (builds on Zod work), then React Hook Form (independent vertical), then TanStack Router migration last (biggest blast radius, benefits from clean code preceding it).

**Alternatives considered and rejected:**
- *Router migration first:* rejected — touches 29 files, and doing it before the legacy-shell cleanup means migrating code that will immediately be deleted.
- *Codegen before manual Zod coverage:* rejected — codegen tool choice depends on which schemas we actually need. Writing them by hand first clarifies the exact shape and surfaces OpenAPI drift before automating.
- *Horizontal layer-by-layer (all schemas → all wire-ups → all hand-rolled parser deletions):* rejected per repo policy §2.8. Each phase is a vertical slice: the schema, the wire-up, and the parser deletion ship together for each endpoint group.
- *Single mega-PR:* rejected — user explicitly asked for per-checkpoint commits with context clearing.

---

## Constraints

- `bun run ci` (typecheck + lint + format + test + build) must be green at every checkpoint.
- Conventional Commits, atomic commits, one concern per commit, explicit file paths via `scripts/committer`.
- TypeScript: never `any`, never `@ts-ignore`, never `!.`, explicit return types on exported functions, `readonly` by default.
- No new runtime dependencies unless they solve a clear problem.
- Feature code in `src/features/`, shared UI in `src/components/`.
- Tests co-located (`foo.tsx` → `foo.test.tsx` next door).
- No breaking changes to the Go API contract in this wave — all work is frontend-only except reading `openapi.json`.
- **`any` policy:** no new `any` introductions. The single existing instance (`ComponentType<any>` in `lazy-with-retry.ts`) stays as-is — it's a generic constraint that cannot be expressed otherwise.

---

## Workstreams

The phases below are mostly sequential (each unblocks the next or reduces surface area for it), with one exception: **Phase 5 (React Hook Form)** is independent of Phase 3–4 (Zod/codegen) at the form level but depends on them for the schemas used by `zodResolver`. Phase 6 (TanStack Router) is independent of Phases 3–5 and could theoretically run in parallel, but its blast radius makes serial execution safer.

---

## Step-by-Step Plan

### Phase 1 — Declarative state fixes (high-severity `useEffect` + `useState`)

Fix the 3 high-severity imperative-state violations identified in the audit. Each is isolated, low-risk, and unblocks clearer thinking for later phases. Keep the medium/low-severity fixes (document.title DRY, debounce effects, sidebar close) out of scope — they're refinements, not anti-patterns.

**Step 1.1 — `contexts/auth-context.tsx`: session restore via `useQuery`**
- **File:** `apps/web/src/contexts/auth-context.tsx:64-102`
- **Current:** `useState` for `user`/`loading` + `useEffect` that calls `refreshAccessToken()` then `apiFetch('/auth/me')` and calls setters imperatively. `parseUserInfo` hand-rolled.
- **Change:**
  1. Add a new hook `useSessionRestore()` that uses `useQuery` with `queryKey: ['auth', 'session']` and `queryFn` that calls `refreshAccessToken()` then `fetchMe()` (see below). `staleTime: Infinity`, `retry: false`, `gcTime: Infinity`.
  2. Add `fetchMe()` to `api-functions.ts` returning a typed `UserInfo`.
  3. `AuthProvider` becomes: `const session = useSessionRestore(); const user = session.data ?? null; const loading = session.isLoading;`.
  4. `signInWithGoogle` / `signInWithDev` / `signOut` / `deleteAccount` must invalidate or setQueryData on the session key instead of calling local setters.
  5. `updateUser` becomes `queryClient.setQueryData(['auth', 'session'], (prev) => ({ ...prev, ...info }))`.
  6. Delete `parseUserInfo` helper — replaced by `UserResponseSchema.parse()` (introduced in Phase 3.1 tracer bullet or inlined here as the first usage).
- **Verification:** existing auth tests (`features/auth/login-page-guest.test.tsx`, any auth-context tests) must pass. Manual check: refresh page while logged in → still logged in without flicker.

**Step 1.2 — `features/programs/definition-wizard/index.tsx`: remove shadow copy**
- **File:** `apps/web/src/features/programs/definition-wizard/index.tsx:33,45-52`
- **Current:** `const [localDef, setLocalDef] = useState<ProgramDefinition | null>(null)` + `useEffect` that copies `defQuery.data` into `localDef` once.
- **Change:**
  1. Replace `localDef` state + sync effect with `useState` that starts from a ref-backed initial value pattern OR, simpler: keep the local edit state but initialize it with the query's data via `useQuery`'s `select` option that returns the parsed definition.
  2. Refactor approach: introduce `const [draft, setDraft] = useState<ProgramDefinition | null>(null)` with an `useEffect`-free pattern:
     - `defQuery.data` is the committed server state.
     - `draft` holds user edits since opening the wizard.
     - Derive the working def: `const workingDef = draft ?? parseDefinition(defQuery.data?.definition) ?? null;`
     - `handleUpdate(partial)` becomes `setDraft((prev) => ({ ...(prev ?? parseDefinition(defQuery.data?.definition)!), ...partial }))`.
  3. Delete the `useEffect` at lines 45-52.
  4. `isDirty` becomes `draft !== null`.
- **Gotcha:** the non-null assertion (`!`) is forbidden by repo rules. Use a type guard or early return if `defQuery.data` isn't parseable.
- **Verification:** open wizard on an existing definition → current fields render → edit one field → save → persisted. Open → cancel → no draft saved.

**Step 1.3 — `hooks/use-day-navigation.ts`: derived selected index**
- **File:** `apps/web/src/hooks/use-day-navigation.ts:27`
- **Current:** `useState` for `selectedDayIndex` + `useEffect` that resets it when `config` changes (`if (firstPendingIdx >= 0) setSelectedDayIndex(firstPendingIdx)`).
- **Change:** read the file first to confirm the shape, then derive `selectedDayIndex` using a `useState` initializer function OR replace with a `useMemo` if the selection is purely computed. If users can override the selection, keep state but use a reset-via-key pattern: pass the config's identity as a `key` to the consuming component so React remounts the component rather than syncing state.
- **Verification:** tests for `use-day-navigation` must pass; create one if missing (see Phase 5 of previous roadmap left item 5.11 — now a prerequisite for this change).

#### Checkpoint 1 — Commit boundary
- [x] `bun run ci` green
- [x] Commits done:
  - `refactor(auth): replace useEffect session restore with useQuery`
  - `refactor(programs): derive wizard draft state from query data`
  - `refactor(hooks): derive day selection instead of syncing via useEffect`

---

### Phase 2 — Delete legacy shell

Remove `src/features/legacy-shell/` entirely. Two files must relocate first; the rest is dead code.

**Step 2.1 — Move `avatar-dropdown.tsx` to a shared location**
- **Source:** `apps/web/src/features/legacy-shell/avatar-dropdown.tsx`
- **Destination:** `apps/web/src/components/layout/avatar-dropdown.tsx` (sibling of `app-sidebar.tsx` which imports it).
- **Update import in:** `apps/web/src/components/layout/app-sidebar.tsx:5`.
- **Move sibling tests if any.** There's no `avatar-dropdown.test.tsx`, skip.

**Step 2.2 — Move `dashboard-skeleton.tsx` to a shared location**
- **Source:** `apps/web/src/features/legacy-shell/dashboard-skeleton.tsx`
- **Destination:** `apps/web/src/components/dashboard-skeleton.tsx` (sits next to `content-page-skeleton.tsx`, `landing-skeleton.tsx`, `app-skeleton.tsx`).
- **Update import in:** `apps/web/src/main.tsx:15`.

**Step 2.3 — Delete the legacy shell directory**
- `trash apps/web/src/features/legacy-shell`
- Verify no references remain: `grep -r "legacy-shell"` across `src/`, `test/`, `e2e/`.
- Test files to be deleted with the directory:
  - `app-shell.tsx`, `app-header.tsx`, `dashboard.tsx`, `onboarding-banner.tsx`
  - `app-header-guest.test.tsx`, `app-shell-guest.test.tsx`, `dashboard.test.tsx`

**Step 2.4 — Remove any orphaned onboarding code**
- `apps/web/src/lib/onboarding.ts` — check if it's still used after deleting `onboarding-banner.tsx`. If only referenced by the deleted banner, delete it too. If referenced elsewhere (e.g., the in-progress new onboarding from the previous roadmap's Phase 7), leave it.

#### Checkpoint 2 — Commit boundary
- [x] `bun run ci` green
- [x] `grep -r "legacy-shell" apps/web/src apps/web/test apps/web/e2e` returns nothing
- [x] Commits done:
  - `refactor(layout): relocate avatar-dropdown and dashboard-skeleton out of legacy-shell`
  - `refactor(web): delete unused legacy-shell feature directory`

---

### Phase 3 — Zod at every API boundary (vertical slices per endpoint group)

Goal: every function in `apps/web/src/lib/api-functions.ts` that returns data must validate with a Zod schema via `.parse()`. All hand-rolled parsers (`parseSummary`, `parseGenericResults`, etc.) must be deleted. Use the existing domain schemas in `src/lib/shared/schemas/` as the starting point; create new ones where needed.

Each sub-step is a vertical slice: write/extend the schema, wire it into the fetch function, delete the hand-rolled parser, update any callers that depended on the old shape. Ship one slice at a time — do not write all schemas first.

**Step 3.1 — Tracer bullet: `fetchGenericProgramDetail` + `updateProgramMetadata`**
- **Why first:** this is the heaviest endpoint (`parseGenericResults` + `parseGenericUndoHistory` + `parseMixedConfigRecord` + `parseStringRecord` = four hand-rolled parsers) and it has an existing `ProgramInstanceSchema` that's unused. Proving the pattern here validates it for everything else.
- **Files:**
  - `apps/web/src/lib/shared/schemas/instance.ts` — extend `ProgramInstanceSchema` with missing fields: `metadata`, `resultTimestamps`, `completedDates`, `definitionId`, `customDefinition`. Cross-reference the hand-rolled parsers in `api-functions.ts` to enumerate exact fields and types.
  - `apps/web/src/lib/api-functions.ts` — import the extended schema. Replace `parseGenericResults`, `parseGenericUndoHistory`, `parseMixedConfigRecord`, `parseStringRecord` hand-rolled parsers with a single `ProgramInstanceSchema.parse(raw)` call in `fetchGenericProgramDetail` and `updateProgramMetadata`. Delete the 4 parser functions.
- **Verification:**
  - Type derivation: `type GenericProgramDetail = z.infer<typeof ProgramInstanceSchema>` replaces the hand-written interface if one exists.
  - Load an existing program in the tracker → verify no runtime parse errors.
  - Run `cd apps/web && bun test` on any tracker-adjacent tests.

**Step 3.2 — `ProgramSummarySchema` + fetchPrograms group**
- **New file:** `apps/web/src/lib/shared/schemas/program-summary.ts`
- **Schema:** mirror `ProgramListResponse` / `ProgramInstanceListItem` from `openapi.json` (read the component schemas there first).
- **Wire into:**
  - `fetchPrograms` (GET `/programs`)
  - `createProgram` (POST `/programs`)
  - `importProgram` response (POST `/programs/import`)
  - `createCustomProgram` (POST `/programs`)
- **Delete:** `parseSummary` hand-rolled parser.
- **Type:** `export type ProgramSummary = z.infer<typeof ProgramSummarySchema>`. Delete any duplicate hand-written interface.

**Step 3.3 — `CatalogEntrySchema` + catalog list**
- **New file:** `apps/web/src/lib/shared/schemas/catalog.ts`
- **Schema:** mirror OpenAPI `CatalogEntry`.
- **Wire into:** `fetchCatalogList` (GET `/catalog`).
- **Delete:** `parseCatalogEntry` hand-rolled parser.

**Step 3.4 — `ExerciseEntrySchema` + `MuscleGroupEntrySchema`**
- **New file:** `apps/web/src/lib/shared/schemas/exercises.ts`
- **Schemas:**
  - `ExerciseEntrySchema` — mirror OpenAPI `ExerciseEntry`.
  - `MuscleGroupEntrySchema` — mirror OpenAPI `MuscleGroupEntry`.
  - Move `PaginatedExercisesResponseSchema` out of `api-functions.ts` into this file, rebuild it to use the new `ExerciseEntrySchema` instead of hand-rolled items.
- **Wire into:** `fetchExercises`, `fetchMuscleGroups`.
- **Delete:** `parseExerciseEntry`, `parseMuscleGroupEntry` (also exported as utility — verify no external consumers first with grep).

**Step 3.5 — `ProgramDefinitionResponseSchema` + definitions group**
- **New file:** `apps/web/src/lib/shared/schemas/program-definition-response.ts`
- **Schema:** mirror OpenAPI `ProgramDefinitionResponse` and `ProgramDefinitionListResponse`. The inner `definition` field is already covered by existing `ProgramDefinitionSchema` — compose, don't duplicate.
- **Wire into:** `fetchDefinition`, `fetchDefinitions`, `updateDefinition`, `forkDefinition`.
- **Delete:** `parseDefinitionResponse`.

**Step 3.6 — `InsightItemSchema` + insights**
- **New file:** `apps/web/src/lib/shared/schemas/insights.ts`
- **Schema:** write to match what `parseInsight` currently accepts. Cross-reference with Go API `/insights` response if needed.
- **Wire into:** `fetchInsights`.
- **Delete:** `parseInsight`.

**Step 3.7 — `GenericWorkoutRowSchema` + preview**
- **New file:** `apps/web/src/lib/shared/schemas/workout-rows.ts`
- **Schema:** write based on `parsePreviewRows` and `parseSlotRow` shapes. This is the most complex new schema (nested rows with slot details).
- **Wire into:** `previewDefinition` (POST `/catalog/preview`).
- **Delete:** `parsePreviewRows`, `parseSlotRow`.

**Step 3.8 — `UserResponseSchema` + profile/auth**
- **New file:** `apps/web/src/lib/shared/schemas/user.ts`
- **Schema:** `z.object({ id: z.string().uuid(), email: z.string().email(), name: z.string().nullable(), avatarUrl: z.string().nullable() })` — mirror OpenAPI `UserResponse`.
- **Wire into:**
  - `updateProfile` (PATCH `/auth/me`)
  - `fetchMe` (from Phase 1.1, if not already added — add now if missing)
  - `signInWithGoogle` / `signInWithDev` response parsing in `auth-context.tsx`
- **Delete:** `parseUserInfo` in `auth-context.tsx` (if still present from Phase 1.1), inline `isRecord` checks in `updateProfile`.

**Step 3.9 — `StatsOnlineResponseSchema` + online count**
- **New file (or add to an existing stats file):** small enough to inline in `api-functions.ts` temporarily, or create `apps/web/src/lib/shared/schemas/stats.ts`.
- **Schema:** `z.object({ count: z.number().int().nonnegative() })`.
- **Wire into:** `fetchOnlineCount`.
- **Delete:** inline `isRecord` check.

#### Checkpoint 3 — Commit boundary
- [x] `bun run ci` green
- [x] All hand-rolled parsers deleted from `api-functions.ts`
- [x] Every API function that returns data uses `.parse()` from a Zod schema
- [x] Commits done:
  - `feat(schemas): add Zod schemas for all API response shapes`
  - `refactor(api): validate all API responses with Zod, delete hand-rolled parsers`

---

### Phase 4 — OpenAPI codegen pipeline

Now that Zod is wired at every boundary by hand, automate the schema generation from `openapi.json`. This removes the manual step of keeping schemas in sync with the spec.

**Step 4.1 — Tool evaluation and selection**
- **Candidates:**
  - `openapi-zod-client` (Astahmer) — generates Zod schemas + an optional Zodios client from OpenAPI. We'd use the schemas only.
  - `@hey-api/openapi-ts` — generates TS types + client. No Zod schemas natively.
  - `ts-to-zod` — converts TS types to Zod (wrong direction).
- **Decision:** start with `openapi-zod-client` because it generates Zod schemas directly, matching the isvidal rule of "Zod as source of truth for runtime typing". Fallback: if the generated schemas don't compose cleanly with our domain schemas, drop to `@hey-api/openapi-ts` for types and keep writing Zod manually for validation.

**Step 4.2 — Install and configure**
- Add `openapi-zod-client` to `apps/web/` devDependencies.
- Create `apps/web/scripts/generate-api-types.ts` (or inline as a one-liner in `package.json`):
  - Reads `../../apps/go-api/internal/swagger/openapi.json`
  - Outputs `apps/web/src/lib/api/generated.ts`
- Add script to `apps/web/package.json`: `"api:types": "bun run scripts/generate-api-types.ts"`
- Add `apps/web/src/lib/api/generated.ts` to `.gitignore`? No — commit the generated file so CI can detect drift.

**Step 4.3 — Tracer bullet: regenerate one endpoint family from codegen**
- Pick `fetchGenericProgramDetail` (the Phase 3.1 tracer bullet).
- Run `bun run api:types`.
- In `api-functions.ts`, swap the import from `@/lib/shared/schemas/instance` to the generated schema for `ProgramInstanceResponse`.
- Verify: `bun run ci` green; tracker still loads correctly.
- **If the generated schema differs from the hand-written one**, that's a spec ↔ reality drift — document in `log.md`, fix `openapi.json` in the Go API, regenerate, and verify.

**Step 4.4 — Migrate remaining schemas to generated**
- For each endpoint family from Phase 3, swap the imported Zod schema from the hand-written domain schema to the generated API schema. Keep domain schemas for fields that have refinements the OpenAPI spec can't express (e.g., discriminated unions in `ProgramDefinitionSchema`). Compose generated API schemas with domain schemas where needed (API schema → transform → domain type).
- Endpoints that need to keep hand-written schemas because of refinements:
  - `fetchCatalogDetail` — `ProgramDefinitionSchema` has discriminated unions for stages + progression rules that the OpenAPI spec encodes loosely. Keep the hand-written one.
  - `previewDefinition` — `GenericWorkoutRowSchema` has complex conditional fields. Evaluate after generating.

**Step 4.5 — CI guard against drift**
- Add a CI check: run `bun run api:types` and `git diff --exit-code apps/web/src/lib/api/generated.ts`. If the diff is non-empty, the Go API's OpenAPI spec has drifted since the last regen.
- Add to `lefthook.yml` pre-push hook if lefthook is configured for web.
- Document in `CLAUDE.md` (repo, not global): "When Go API handlers change response shapes, update `openapi.json` AND run `bun run api:types` in apps/web."

#### Checkpoint 4 — Commit boundary
- [x] `bun run ci` green
- [x] `bun run api:types` is reproducible (running twice produces zero diff)
- [x] CI drift guard in lefthook pre-push
- [x] Decision logged: hand-written schemas kept as primary; generated file used only for drift detection (codegen generates Zod v3 API patterns and Zodios client that don't compose with our domain schemas)
- [x] Commits done:
  - `build(web): add openapi-zod-client and api:types generation script`
  - `ci(web): guard against OpenAPI spec drift with lefthook pre-push check`

---

### Phase 5 — React Hook Form + zodResolver for forms

Migrate all 9 real forms (login is excluded — it's OAuth only). Progress from trivial to complex so the pattern stabilizes before tackling the dynamic/nested forms.

**Prerequisites:** Phase 3 or 4 complete (schemas exist and are canonical).

**Step 5.1 — Install dependencies**
- Add `react-hook-form` and `@hookform/resolvers` to `apps/web/` dependencies.

**Step 5.2 — Migrate `test-weight-modal.tsx` (trivial — reference implementation)**
- **File:** `apps/web/src/features/tracker/test-weight-modal.tsx`
- **New schema:** inline in the file or add to `schemas/forms.ts`: `const TestWeightFormSchema = z.object({ weight: z.number().min(20).max(500) })`.
- **Refactor:**
  - `useForm<z.infer<typeof TestWeightFormSchema>>({ resolver: zodResolver(TestWeightFormSchema), defaultValues: { weight: defaultWeight } })`
  - Replace `useState` for weight + `isValidWeight` helper with `register('weight', { valueAsNumber: true })` + `formState.isValid`.
  - Keep the existing `<form>` tag but use `handleSubmit(onConfirm)`.
  - Reset form state on modal reopen via `useForm`'s `values` prop (declarative reset) instead of a `useEffect` — also kills the Category E effect flagged in the audit.
- **Tests:** add `test-weight-modal.test.tsx` if missing.

**Step 5.3 — Migrate `delete-account-dialog.tsx` (trivial)**
- **File:** `apps/web/src/components/delete-account-dialog.tsx`
- **Schema:** `z.object({ input: z.literal('ELIMINAR') })`.
- **Refactor:** same pattern as 5.2. Enables the button via `formState.isValid`.

**Step 5.4 — Migrate `basic-info-step.tsx` (moderate — wizard step 1)**
- **File:** `apps/web/src/features/programs/definition-wizard/basic-info-step.tsx`
- **Schema:** derive from `ProgramDefinitionSchema`: `ProgramDefinitionSchema.pick({ name: true, description: true })` plus max-length refinements.
- **Refactor:** `useForm` with the picked schema. Error messages render from `formState.errors.name`/`description`. `handleSubmit` calls `onUpdate` + `onNext`.
- **Wizard state integration:** either pass initial values from parent `localDef`/`draft`, or use a wizard-level `FormProvider` (defer to Step 5.8). Start with per-step instance.

**Step 5.5 — Migrate `profile-account-card.tsx` (moderate — inline blur-save)**
- **File:** `apps/web/src/features/profile/profile-account-card.tsx`
- **Schema:** `z.object({ name: z.string().trim().min(1, 'Nombre requerido').max(64) })`.
- **Refactor:** the blur-save pattern maps to `handleSubmit` triggered on blur. Use `handleSubmit(onValid)()` in the blur handler. The existing `cancelRef` guard against unmount-blur should be preserved.

**Step 5.6 — Migrate `setup-form.tsx` (complex — dynamic fields)** ✓ Done
- **File:** `apps/web/src/features/tracker/setup-form.tsx`
- **Dynamic schema:** build the Zod schema at runtime from `definition.configFields`:
  ```ts
  const schema = z.object(
    Object.fromEntries(
      definition.configFields.map((f) =>
        f.type === 'weight'
          ? [f.key, z.number().min(f.min).max(500)]
          : [f.key, z.string().min(1)]
      )
    )
  );
  ```
- **Refactor:** `useForm` with the dynamic schema. Use `register(field.key, { valueAsNumber: field.type === 'weight' })`. Keep `touched` behavior via RHF's `formState.touchedFields`.
- **Gotcha:** the existing confirm-dialog flow (`SetupForm` → pending config → confirm) stays — RHF's `handleSubmit` receives parsed values, passes them to the confirm flow.

**Step 5.7 — Migrate `days-exercises-step.tsx` (complex — nested arrays)** ✓ Done
- **File:** `apps/web/src/features/programs/definition-wizard/days-exercises-step.tsx`
- **Use `useFieldArray`** for `days`. The exercise picker mutates `days[i].slots` via RHF's `update` instead of direct state.
- **Schema:** `ProgramDaySchema` already exists — use `z.object({ days: z.array(ProgramDaySchema).min(1) })` for the form.

**Step 5.8 — Refactor `progression-step.tsx` to use `zodResolver`** ✓ Done
- **File:** `apps/web/src/features/programs/definition-wizard/progression-step.tsx`
- **Current:** already uses `ProgramDefinitionSchema.safeParse()` manually. Convert to `zodResolver(ProgramDefinitionSchema)` and let RHF handle the state + errors.
- **Optional:** promote to a wizard-level `FormProvider` at this point and share the form instance across all three wizard steps. This lets "save draft" and "save and start" work off a single validated state.

**Step 5.9 — Skip: `login-page.tsx`, `profile-banner.tsx` selector**
- Not real forms; document the decision to leave them alone in a comment at the top of each file (2-line note) so future audits don't flag them.

#### Checkpoint 5 — Commit boundary
- [x] `bun run ci` green (481 pass, 0 fail)
- [x] Commits done:
  - `build(web): add react-hook-form and hookform resolvers`
  - `refactor(tracker): migrate test-weight-modal to react-hook-form`
  - `refactor(components): migrate delete-account-dialog to react-hook-form`
  - `refactor(programs): migrate wizard basic-info step to react-hook-form`
  - `refactor(profile): migrate profile account name edit to react-hook-form`
  - `refactor(tracker): migrate setup-form to react-hook-form with dynamic schema`
  - `refactor(programs): migrate wizard days-exercises step to react-hook-form`
  - `refactor(programs): wire progression-step to zodResolver`
- Notes:
  - `test-weight-modal`: RHF's async handleSubmit causes test failures when fireEvent.change/click are called without awaiting; used sync handleFormSubmit + watch-derived validity instead
  - zodResolver not used for dynamic-schema forms (setup-form, days-exercises); custom resolver approach gives better type safety
  - progression-step: isValid derived from useMemo(safeParse) not formState.isValid, because formState.isValid=false on initial render before first interaction

---

### Phase 6 — Migrate from `react-router-dom` to `@tanstack/react-router`

Largest blast radius. Saved for last so everything preceding is stable before touching routing. Use code-based routing (not file-based) to minimize migration surface — file-based can come in a follow-up.

**Step 6.1 — Install dependencies**
- Add `@tanstack/react-router` to `apps/web/` dependencies.
- Add `@tanstack/router-devtools` to devDependencies.
- Do NOT yet remove `react-router-dom` — it stays installed until the migration is complete.

**Step 6.2 — Define the root router (parallel import path)**
- Create `apps/web/src/router.tsx` (new file) with:
  - `createRootRoute` → wraps `RootLayout`
  - Child routes mirroring the current tree from `main.tsx:74-183`
  - Use `createRoute` for each leaf, specifying `getParentRoute`, `path`, `component`
  - Use `lazyRouteComponent` for code splitting (TanStack Router's equivalent of `lazyWithRetry`). Verify whether `lazyWithRetry`'s stale-chunk recovery still works with TanStack Router's lazy loader — if not, wrap the TanStack loader with our retry logic.
- Define:
  - `RootRoute` (/)
  - `LandingRoute` (/)  — index
  - `LoginRoute` (/login)
  - `PrivacyRoute` (/privacy), `CookiePolicyRoute` (/cookies), `ProgramPreviewRoute` (/programs/:programId), `NotFoundRoute` (*)
  - `AppLayoutRoute` (/app) with `children`:
    - `HomeRoute` (index), `DashboardRoute` (/dashboard), `ProgramsRoute` (/programs), `TrackerRoute` (/tracker/$programId), `ProfileRoute` (/profile), `AnalyticsRoute` (/analytics)
- **Critical:** `tracker/:programId?` uses an optional param in react-router-dom. TanStack Router does not support optional path params the same way — split into two routes (`/tracker` + `/tracker/$programId`) or use a search param. Pick the two-route approach; both components call into the same page with `programId` falling back to `undefined` for the bare path.

**Step 6.3 — Swap the router in `main.tsx`**
- Replace `createBrowserRouter` + `RouterProvider` from `react-router-dom` with TanStack's `RouterProvider` + `createRouter`.
- Register the router with TypeScript: `declare module '@tanstack/react-router' { interface Register { router: typeof router } }` for type-safe routes.

**Step 6.4 — Vertical slice: migrate ONE simple route end-to-end**
- Pick `/privacy`. Update its component's `Link` imports to TanStack, render the page, manually verify navigation from the landing page to `/privacy` and back.
- **Checkpoint mini-verify:** `/privacy` works with TanStack; `/` and others still work with the old system (if split) or TanStack if fully swapped.

**Step 6.5 — Swap all 16 `Link` imports**
- Files (from the routing audit): `home-page.tsx`, `not-found.tsx`, `privacy-page.tsx`, `cookie-policy-page.tsx`, `hero-section.tsx`, `final-cta-section.tsx`, `shared.tsx`, `programs-section.tsx`, `nav-bar.tsx`, `dashboard-page.tsx`, `program-card.tsx`, `program-preview-page.tsx`, `cookie-banner.tsx`, `avatar-dropdown.tsx` (now under `components/layout/` after Phase 2), `app-header.tsx` (DELETED in Phase 2 — skip), `app-sidebar.tsx`.
- One grep-and-replace pass: `from 'react-router-dom'` → `from '@tanstack/react-router'` for files that only import `Link`.
- The `to` prop stays the same for absolute paths. For dynamic paths: `to="/app/tracker/$programId"` + `params={{ programId }}`.

**Step 6.6 — Swap all 11 `useNavigate` call sites**
- Files: `login-page.tsx`, `active-program-card.tsx`, `programs-page.tsx`, `program-app.tsx`, `profile-page.tsx`, `profile-banner.tsx`, `tracker-page.tsx`, `guest-banner.tsx`, `app-header.tsx` (DELETED — skip), `app-sidebar.tsx`, `app-shell.tsx` (DELETED in Phase 2 — skip).
- Call signature change: `navigate('/app')` → `navigate({ to: '/app' })`. Dynamic: `navigate('/app/tracker/' + id)` → `navigate({ to: '/app/tracker/$programId', params: { programId: id } })`.
- **Do NOT automate the replace** — dynamic navigation calls have to be rewritten per-site to satisfy TanStack Router's typed `to`/`params` API.

**Step 6.7 — Swap remaining router primitives**
- `NavLink` in `app-sidebar.tsx` → TanStack `Link` with `activeProps={{ className: '...' }}` and `inactiveProps={{ className: '...' }}`. Read the file to replicate the active/inactive styling exactly.
- `useParams` in `tracker-page.tsx` and `program-preview-page.tsx` → `useParams({ from: '/app/tracker/$programId' })` / `useParams({ from: '/programs/$programId' })`.
- `useLocation` in `app-layout.tsx` → `useLocation()` from TanStack (same name, similar shape; the pathname-based sidebar close effect can become a direct subscription via `useRouterState`).
- `Navigate` in `tracker-page.tsx` → `<Navigate to="/app" replace />` from TanStack or imperative `router.navigate` in a `beforeLoad`.
- `useRouteError` in `route-error-fallback.tsx` → TanStack uses `errorComponent` prop on each route + `useRouter().state.error` or a route-level `errorComponent`.
- `useSearchParams` — no remaining consumers after legacy-shell deletion.

**Step 6.8 — Refactor auth guards as `beforeLoad`**
- **Login page redirect (`login-page.tsx:23`):** move the "if user is logged in, redirect" logic into a `beforeLoad` on the `/login` route: `beforeLoad: ({ context }) => { if (context.auth.user) throw redirect({ to: '/app' }); }`. Requires threading an auth context into the router context.
- **Tracker auth guard (`program-app.tsx`):** move "if !user && !isGuest, redirect to /login" into a `beforeLoad` on the `/app` parent route. This centralizes auth guarding.
- **Router context:** create a `RouterContext` type that includes `auth: { user: UserInfo | null; loading: boolean; isGuest: boolean }` and pass it from `AuthProvider` at the top level. Use `createRootRouteWithContext<RouterContext>()`.
- **Remove the `useEffect`-based redirects** in `login-page.tsx` and `program-app.tsx` — they're now unnecessary.

**Step 6.9 — Migrate 5 tests that use `MemoryRouter`**
- Files: `login-page-guest.test.tsx`, `guest-banner.test.tsx`. (The three `legacy-shell` tests were deleted in Phase 2.)
- Replace `MemoryRouter` with TanStack Router's memory history: `createRouter({ routeTree, history: createMemoryHistory() })` and wrap the rendered tree in `<RouterProvider router={router} />`.
- Alternative: create a test helper `renderWithRouter()` in `test/test-utils.ts`.

**Step 6.10 — Remove `react-router-dom`**
- `grep -r "react-router-dom"` returns nothing in `src/`, `test/`, `e2e/`.
- Remove from `apps/web/package.json` dependencies.
- Run `bun install`.

**Step 6.11 — Full E2E verification**
- `bun run e2e` (Playwright) — all tests must pass. This is the definitive check for routing regressions since Playwright exercises real navigation.
- Manual smoke: log in, navigate to every top-level route, deep link into `/app/tracker/:programId`, hit refresh, navigate back.

#### Checkpoint 6 — Commit boundary (multiple commits inside)
- [x] `bun run ci` green (481 pass, 0 fail)
- [x] `grep -r "react-router-dom" apps/web/src apps/web/test apps/web/e2e` returns nothing
- [x] Commits done:
  - `build(web): add @tanstack/react-router and router-devtools`
  - `feat(router): define TanStack router tree and RouterShell with auth context`
  - `refactor(router): migrate Link imports to TanStack Router`
  - `refactor(router): migrate useNavigate call sites to TanStack Router`
  - `refactor(router): migrate params/location/navigate primitives to TanStack`
  - `test(router): migrate MemoryRouter tests to TanStack memory history`
  - `build(web): remove react-router-dom`
- Notes:
  - auth guards implemented as `beforeLoad` on `/app` layout route and `/login` route
  - GuestProvider + AuthProvider moved to Providers component so auth state is available for RouterShell context
  - `tracker/:programId?` optional param → two routes: `/app/tracker` and `/app/tracker/$programId`
  - `useRouteError` replaced with `errorComponent` prop pattern

---

### Phase 7 — Housekeeping (optional, low-priority cleanups)

Only tackle these if time/energy remains after Phase 6. None of them are compliance-blocking.

**Step 7.1 — shadcn/ui `components.json` scaffold** (skipped — low ROI vs blast radius)
- Run `bunx shadcn@latest init` inside `apps/web/` to generate `components.json`.
- Align existing manual shadcn components (button, card, collapsible, dialog, dropdown-menu, tabs, tooltip) with the CLI's expected shape. Mostly this is just the config file; the components themselves are already using Radix + `cn()`.
- Benefit: future components can be added via `bunx shadcn@latest add <component>`.

**Step 7.2 — `document.title` DRY helper**
- 10 pages currently hand-roll `useEffect(() => { document.title = X; return () => { document.title = DEFAULT; }; }, [])`.
- Create `hooks/use-document-title.ts`: one `useEffect` wrapped in a hook.
- Migrate all 10 pages.
- Note: this is still a `useEffect`, but a legitimate one (document title is a cross-cutting side effect React doesn't own declaratively). The goal is DRY, not eliminating the effect.

**Step 7.3 — Debounce in `exercise-picker.tsx`**
- Replace the `useEffect`-based debounce with `useDeferredValue` from React 18/19.
- File: `apps/web/src/features/programs/definition-wizard/exercise-picker.tsx:15`.

**Step 7.4 — Sidebar close on route change**
- File: `apps/web/src/components/layout/app-layout.tsx:35`.
- Currently uses `useEffect([location.pathname])` to close the mobile sidebar. Post-TanStack-Router migration, this can become a `router.subscribe('onBeforeNavigate', ...)` subscription or stay as-is. Low priority.

**Step 7.5 — TanStack Table (only if any tables need it)** (skipped — no data tables found)
- Audit didn't find any real tables using react-table. `detailed-day-view.tsx` has a `SlotTable` (per-row input grid) but it's a workout tracker, not a data table — RHF + list rendering is a better fit.
- **Decision:** skip unless a new requirement introduces a real data table.

---

## Checkpoints (summary)

| # | Phase | Description | Ship when |
|---|---|---|---|
| 1 | Declarative state fixes | 3 high-severity useEffect violations fixed | CI green + manual auth/wizard/day-nav smoke |
| 2 | Legacy shell deleted | `legacy-shell/` directory gone, 2 files relocated | CI green + no references remain |
| 3 | Zod at every API boundary | All hand-rolled parsers removed, all endpoints `.parse()` | CI green + tracer bullet re-verified |
| 4 | OpenAPI codegen pipeline | `bun run api:types` regenerates, CI guards drift | CI green + tracer bullet works with generated schemas |
| 5 | React Hook Form migration | 7 forms on RHF + zodResolver | CI green + manual form smoke across wizard/tracker/profile |
| 6 | TanStack Router migration | `react-router-dom` uninstalled | CI green + Playwright E2E green |
| 7 | Housekeeping (optional) | shadcn init, document.title DRY, etc. | CI green |

Each checkpoint is a committable boundary suitable for context clearing.

---

## Files Likely Affected

| Phase | Files |
|---|---|
| 1 | `contexts/auth-context.tsx`, `features/programs/definition-wizard/index.tsx`, `hooks/use-day-navigation.ts`, new `hooks/use-day-navigation.test.ts` |
| 2 | `features/legacy-shell/*` (delete), `components/layout/avatar-dropdown.tsx` (new), `components/dashboard-skeleton.tsx` (new), `components/layout/app-sidebar.tsx` (import update), `main.tsx` (import update), possibly `lib/onboarding.ts` (delete if orphaned) |
| 3 | `lib/api-functions.ts` (heavy), `lib/shared/schemas/instance.ts` (extend), new schema files in `lib/shared/schemas/`: `program-summary.ts`, `catalog.ts`, `exercises.ts`, `program-definition-response.ts`, `insights.ts`, `workout-rows.ts`, `user.ts`, `stats.ts` |
| 4 | `package.json`, new `scripts/generate-api-types.ts`, new `src/lib/api/generated.ts`, `.lefthook.yml` (drift guard), repo `CLAUDE.md` (workflow note) |
| 5 | `package.json`, `features/tracker/test-weight-modal.tsx`, `components/delete-account-dialog.tsx`, `features/programs/definition-wizard/basic-info-step.tsx`, `features/profile/profile-account-card.tsx`, `features/tracker/setup-form.tsx`, `features/programs/definition-wizard/days-exercises-step.tsx`, `features/programs/definition-wizard/progression-step.tsx` |
| 6 | `package.json`, new `src/router.tsx`, `main.tsx`, ~28 files importing from `react-router-dom` (16 `Link` sites + 11 `useNavigate` + `useParams`/`useLocation`/`Navigate`/`useRouteError`), tests: `login-page-guest.test.tsx`, `guest-banner.test.tsx` |
| 7 | `apps/web/components.json` (new), `hooks/use-document-title.ts` (new), 10 page files (title migration), `features/programs/definition-wizard/exercise-picker.tsx`, `components/layout/app-layout.tsx` |

---

## Risks

| Risk | Phase | Mitigation |
|---|---|---|
| Auth session flicker regression from Phase 1.1 refactor | 1 | Keep `staleTime: Infinity` on the session query; manual test refresh-while-logged-in |
| Wizard draft state gets stale after API update | 1 | Invalidate the definition query on save; verify wizard reopen shows updated state |
| Zod `.parse()` fails on fields the hand-rolled parsers tolerated | 3 | Use `.safeParse()` with logging for the first deploy; flip to `.parse()` after observing zero failures in dev. Or: write schemas with `.passthrough()` until confident |
| OpenAPI spec drifts from Go handler reality | 3,4 | Phase 4.5 CI guard surfaces drift early. Also: Phase 3's manual schemas serve as a one-time cross-check against the hand-rolled parsers |
| `openapi-zod-client` generates schemas that don't compose with domain schemas | 4 | Fallback plan: use `@hey-api/openapi-ts` for TS types and keep Zod schemas hand-written. Evaluate after Phase 4.3 tracer bullet |
| `lazyWithRetry` stale-chunk recovery breaks under TanStack Router's lazy loader | 6 | Test route navigation after a deployed build before removing react-router-dom; if broken, wrap TanStack's `lazyRouteComponent` with the retry logic |
| Optional path param (`tracker/:programId?`) has no 1:1 TanStack equivalent | 6 | Split into two routes: `/tracker` and `/tracker/$programId`, both pointing to `TrackerPage`. Verified plan in Step 6.2 |
| TanStack Router's `beforeLoad` auth guard interacts badly with TanStack Query's cache | 6 | Test auth flow end-to-end; guest mode + authenticated mode separately |
| Dynamic form schemas in Phase 5.6 produce runtime type-inference headaches | 5 | Accept a narrower `Record<string, number \| string>` static type and runtime-validate with the dynamic schema. Avoid trying to type the dynamic form's `FieldValues` precisely |

---

## Verification — full gate per checkpoint

After each phase:
- `bun run ci` (typecheck + lint + format + test + build)
- Manual smoke test of the phase's acceptance criteria (listed inline above)
- After Phase 6 specifically: `bun run e2e` (Playwright)

---

## Open Questions

- **Phase 4.1 tool choice final answer:** do we want the generated Zod schemas to replace the domain schemas entirely, or keep them as two layers (generated API schemas → transform → domain schemas with refinements)? The `log.md` entry leans toward the two-layer approach. Confirm at the start of Phase 4 after seeing one endpoint regenerated.
- **Phase 5.8 wizard `FormProvider`:** one shared form across all three wizard steps vs. per-step instances. Decide after Step 5.4 migrates step 1 — if the wizard-level state we touched in Phase 1.2 already provides a clean integration point, lean toward per-step; if not, lift to `FormProvider`.
