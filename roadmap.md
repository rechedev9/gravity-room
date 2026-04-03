# Gravity Room — Roadmap

**Last updated:** 2026-04-03
**Status:** Phase 5 — Test Coverage

---

## Objective

Harden the existing app (fix known bugs, improve reliability), then layer on high-impact
UX improvements (PWA offline, surfacing unused analytics, onboarding) and close test gaps.

---

## Current State

- All SEO on-page fixes are complete (previous roadmap, fully shipped).
- 8 known bugs tracked in `todo.md` — mix of security, correctness, and observability gaps.
- PWA manifest exists and the app is installable, but there is **no service worker** — the
  app fails offline despite being used in gyms with poor connectivity.
- The Python analytics service computes `exercise_summary` per exercise, but the web frontend
  never fetches or displays it — free value sitting unused.
- Only public pages (`/privacy`, `/cookies`, `/programs/:id`) set `document.title`; all
  `/app/*` routes inherit the generic homepage title.
- Unit preference (kg/lb) is `localStorage`-only — lost on device change.
- Onboarding is a single dismissable banner, not a guided flow.
- Calendar export utility (`lib/calendar.ts`) is implemented and tested but has no UI surface.
- Test coverage gaps: 4 of 7 Python analytics modules untested; several web pages and hooks
  lack unit tests.

---

## Constraints

- No breaking changes to the Go API contract without versioning.
- No new runtime dependencies unless they solve a clear problem (e.g., `vite-plugin-pwa`).
- Feature code goes in `src/features/`, shared UI in `src/components/`.
- Tests live next to the file they test.
- Conventional Commits; atomic commits; one concern per commit.
- `bun run ci` must pass after every phase.

---

## Workstreams

1. **Bug Fixes** — Eliminate all 8 known issues from `todo.md`
2. **PWA & Offline** — Service worker with offline caching
3. **Surface exercise_summary** — Display already-computed analytics data
4. **App Route Titles** — `document.title` for all `/app/*` routes
5. **Test Coverage** — Fill gaps in Python analytics and web feature tests
6. **Settings Persistence** — Server-side unit preference
7. **Onboarding Flow** — Guided first-time experience
8. **Calendar Export UI** — Surface the existing calendar utility

---

## Step-by-Step Plan

### Phase 1 — Bug Fixes ✅

Fix all 8 issues from `todo.md`. Grouped by app.

#### Web — React/TypeScript (4 bugs)

**Step 1.1 — Zod validation on program import**
- File: `apps/web/src/hooks/use-program.ts:608-621`
- `JSON.parse(json)` result goes straight to `importProgram()` with no schema check.
- Add a Zod schema (or reuse the existing export format type) to validate before calling the API.
- Reject with a user-facing toast on validation failure.

**Step 1.2 — `isMounted` guard on auth session restore**
- File: `apps/web/src/contexts/auth-context.tsx:68-95`
- The `restore()` async function calls `setUser()` / `setLoading(false)` after the promise
  resolves, with no check that the component is still mounted.
- Add a `useRef(true)` guard; set to `false` in the `useEffect` cleanup. Check before setters.

**Step 1.3 — AMRAP/RPE timer cleanup on unmount**
- File: `apps/web/src/hooks/use-program.ts:512-540`
- `amrapTimers` and `rpeTimers` are `useRef` maps of `setTimeout` IDs. No `useEffect` cleanup
  clears them — mutations fire after unmount.
- Add a `useEffect` that returns a cleanup function clearing all timers in both maps.

**Step 1.4 — `AbortController` on API fetches**
- File: `apps/web/src/lib/api-functions.ts:90-96`
- All requests use `AbortSignal.timeout(30_000)` only. No external signal cancels in-flight
  requests on route change.
- Accept an optional `AbortSignal` and wire it through. TanStack Query's `signal` from
  `queryFn` context should be forwarded to `apiFetch`.

#### Go API (4 bugs)

**Step 1.5 — Reject `+N` workoutIndex in results handler**
- File: `apps/go-api/internal/handler/results.go:72-73`
- `strconv.Atoi("+1")` succeeds and passes the `< 0` guard. Add a prefix check or use
  `strconv.ParseUint` to reject `+` prefixed values explicitly.

**Step 1.6 — Atomic JWKS cache update**
- File: `apps/go-api/internal/googleauth/googleauth.go:64-67`
- Three separate mutex sections create a race between fetch and store.
- Collapse into a single locked critical section, or use `singleflight.Group` keyed by kid
  to deduplicate concurrent fetches.

**Step 1.7 — Log token revocation errors**
- File: `apps/go-api/internal/handler/auth.go:341`
- `_ = service.RevokeToken(...)` silently swallows errors.
- At minimum log a warning with `slog.Warn`. Optionally return 500 on failure.

**Step 1.8 — Rate limiter fail-open metric**
- File: `apps/go-api/internal/ratelimit/redis.go:54-57`
- Redis unavailability bypasses all rate limits with only a log line.
- Increment a Prometheus counter (`ratelimit_redis_fallback_total`) so ops can alert.

#### Verification — Phase 1
- [ ] `bun run ci` passes (typecheck + lint + format + test + build)
- [ ] `cd apps/go-api && go vet ./... && go test ./...` passes
- [ ] All 8 items checked off in `todo.md`

---

### Phase 2 — PWA & Offline ✅

**Step 2.1 — Install `vite-plugin-pwa`**
- Add `vite-plugin-pwa` to `apps/web/` devDependencies.
- Configure in `vite.config.ts` with `registerType: 'prompt'` (prompt user to reload on new
  version) and a Workbox `runtimeCaching` strategy.

**Step 2.2 — Configure caching strategies**
- **App shell** (HTML, CSS, JS chunks): `CacheFirst` with revision hashing.
- **API calls** (`/api/*`): `NetworkFirst` with 5s timeout fallback to cache. Exclude
  `/api/auth/*` from caching.
- **Static assets** (images, fonts, manifest): `CacheFirst`, max 60 entries, 30-day expiry.

**Step 2.3 — Update prompt UI**
- When a new service worker is waiting, show a toast or banner: "Nueva versión disponible —
  Actualizar". On click, call `registration.waiting.postMessage({ type: 'SKIP_WAITING' })`.

**Step 2.4 — Offline fallback page**
- Register a fallback for navigation requests that returns a minimal offline page when cache
  miss + network failure occurs.

**Step 2.5 — Verify installability**
- Confirm Lighthouse PWA audit passes.
- Test: go offline in DevTools, reload — cached app shell loads. API calls degrade gracefully.

#### Verification — Phase 2
- [ ] `bun run ci` passes
- [ ] Lighthouse PWA score passes
- [ ] Offline reload serves cached shell
- [ ] New version prompt appears after deploy

---

### Phase 3 — Surface `exercise_summary` Insight ✅

**Step 3.1 — Create `ExerciseSummaryCard` component**
- File: `apps/web/src/features/insights/exercise-summary-card.tsx`
- Display per-exercise: total sets, successful sets, success rate %, total volume, avg RPE.
- Match existing insight card design (bg-card, border-rule pattern).

**Step 3.2 — Add to analytics page fetch**
- File: `apps/web/src/features/analytics/analytics-page.tsx:14-21`
- Add `'exercise_summary'` to the `INSIGHT_TYPES` array.
- Filter and render a grid of `ExerciseSummaryCard` in a new section after "Resumen".

**Step 3.3 — Optional: add to dashboard**
- If the dashboard has room, show a compact summary for the active program's exercises.

#### Verification — Phase 3
- [x] `bun run typecheck && bun run lint` passes
- [x] Analytics page renders exercise summary cards with real data
- [x] Empty state (no exercise_summary data) handled gracefully

---

### Phase 4 — App Route Document Titles ✅

Add `document.title` via `useEffect` to every `/app/*` route, following the pattern
established in the SEO roadmap for public pages.

**Step 4.1 — Home** (`/app`)
- File: `apps/web/src/features/home/home-page.tsx`
- Title: `"Inicio — Gravity Room"`

**Step 4.2 — Dashboard** (`/app/dashboard`)
- File: `apps/web/src/features/dashboard/dashboard-page.tsx`
- Title: `"Dashboard — Gravity Room"`

**Step 4.3 — Programs** (`/app/programs`)
- File: `apps/web/src/features/programs/programs-page.tsx`
- Title: `"Programas — Gravity Room"`

**Step 4.4 — Tracker** (`/app/tracker/:programId?`)
- File: `apps/web/src/features/tracker/tracker-page.tsx`
- Title: `"{Program Name} — Tracker — Gravity Room"` (dynamic based on active program),
  fallback `"Tracker — Gravity Room"`.

**Step 4.5 — Profile** (`/app/profile`)
- File: `apps/web/src/features/profile/profile-page.tsx`
- Title: `"Perfil — Gravity Room"`

**Step 4.6 — Analytics** (`/app/analytics`)
- File: `apps/web/src/features/analytics/analytics-page.tsx`
- Title: `"Analíticas — Gravity Room"`

**Step 4.7 — Login** (`/login`)
- File: `apps/web/src/features/auth/login-page.tsx`
- Title: `"Iniciar Sesión — Gravity Room"`

All should restore the default title on unmount.

#### Verification — Phase 4
- [x] `bun run typecheck && bun run lint` passes
- [x] Navigate to each route and confirm tab title updates
- [x] Navigate back to `/` and confirm title reverts

---

### Phase 5 — Test Coverage

#### Python analytics (5 new test files)

**Step 5.1** — `apps/analytics/tests/test_volume.py` — test `compute_volume_trend()`
**Step 5.2** — `apps/analytics/tests/test_frequency.py` — test `compute_frequency()`
**Step 5.3** — `apps/analytics/tests/test_e1rm.py` — test `compute_e1rm_progression()`
**Step 5.4** — `apps/analytics/tests/test_summary.py` — test `compute_exercise_summary()`
**Step 5.5** — `apps/analytics/tests/test_compute.py` — test the orchestrator/scheduler logic

#### Web feature tests

**Step 5.6** — `apps/web/src/features/analytics/analytics-page.test.tsx` — loading, error,
  empty, and populated states
**Step 5.7** — `apps/web/src/features/dashboard/dashboard-page.test.tsx` — KPI rendering,
  insight card presence
**Step 5.8** — `apps/web/src/features/home/home-page.test.tsx` — welcome header, quick access
  cards, guest banner
**Step 5.9** — `apps/web/src/features/programs/programs-page.test.tsx` — catalog groups render,
  custom programs panel

#### Web hook tests

**Step 5.10** — `apps/web/src/hooks/use-definitions.test.ts`
**Step 5.11** — `apps/web/src/hooks/use-day-navigation.test.ts`
**Step 5.12** — `apps/web/src/hooks/use-unit-preference.test.ts`
**Step 5.13** — `apps/web/src/hooks/use-online-count.test.ts`

#### Verification — Phase 5
- [ ] `cd apps/analytics && python -m pytest tests/` — all pass
- [ ] `cd apps/web && bun test` — all pass
- [ ] `bun run ci` passes

---

### Phase 6 — Settings Persistence

**Step 6.1 — Go API: add user_settings table**
- Migration: `apps/go-api/migrations/NNNN_add_user_settings.sql`
- Schema: `user_id UUID PK REFERENCES users(id), unit TEXT NOT NULL DEFAULT 'kg', updated_at TIMESTAMPTZ`

**Step 6.2 — Go API: add settings handler**
- `GET /api/settings` — returns `{ unit: "kg" | "lbs" }`
- `PATCH /api/settings` — accepts `{ unit: "kg" | "lbs" }`, validates, upserts.
- Files: `internal/handler/settings.go`, `internal/service/settings.go`

**Step 6.3 — Web: sync `useUnitPreference` with API**
- File: `apps/web/src/hooks/use-unit-preference.ts`
- On mount (authenticated): fetch from API, write to localStorage as cache.
- On toggle: PATCH to API, update localStorage.
- Guest mode: localStorage-only (current behavior).

#### Verification — Phase 6
- [ ] `cd apps/go-api && go test ./...` — settings handler and service tests pass
- [ ] `bun run ci` passes
- [ ] Toggle unit on device A, login on device B — preference synced

---

### Phase 7 — Onboarding Flow

**Step 7.1 — Design the flow**
- 3 steps: (1) Choose a program, (2) Understand the tracker, (3) Record your first set.
- Dismissable at any step. Progress stored in localStorage.
- Renders as a modal or inline overlay — not a separate route.

**Step 7.2 — Create onboarding components**
- Directory: `apps/web/src/features/onboarding/`
- Components: `OnboardingModal`, `StepProgramSelect`, `StepTrackerIntro`, `StepFirstSet`
- Reuse existing `ProgramCard` for step 1; annotated tracker screenshot for step 2.

**Step 7.3 — Trigger logic**
- Replace `isOnboardingDismissed()` check in `apps/web/src/lib/onboarding.ts`.
- Show on first login when user has zero program instances.
- Track completion step so returning users resume where they left off.

**Step 7.4 — Remove legacy onboarding banner**
- File: `apps/web/src/features/legacy-shell/onboarding-banner.tsx`
- Replace references with the new onboarding trigger.

#### Verification — Phase 7
- [ ] New user sees onboarding modal on first login
- [ ] Each step is navigable and dismissable
- [ ] Returning user does not see it again after completion
- [ ] `bun run ci` passes

---

### Phase 8 — Calendar Export UI

**Step 8.1 — Add "Agregar al Calendario" button**
- File: `apps/web/src/features/tracker/toolbar.tsx` or
  `apps/web/src/features/program-view/day-view.tsx`
- Button opens a Google Calendar pre-filled event using `buildGoogleCalendarUrl()` from
  `apps/web/src/lib/calendar.ts`.
- Opens in a new tab (`window.open`).

**Step 8.2 — Optional: date/time picker**
- Let the user choose date and start time before generating the link.
- Default: tomorrow at 07:00 (current behavior in `calendar.ts`).

#### Verification — Phase 8
- [ ] Button visible in tracker for the current day's workout
- [ ] Clicking opens Google Calendar with correct title, exercises, and time
- [ ] `bun run ci` passes

---

## Files Likely Affected

| Phase | Files |
|---|---|
| 1 | `apps/web/src/hooks/use-program.ts`, `apps/web/src/contexts/auth-context.tsx`, `apps/web/src/lib/api-functions.ts`, `apps/go-api/internal/handler/results.go`, `apps/go-api/internal/googleauth/googleauth.go`, `apps/go-api/internal/handler/auth.go`, `apps/go-api/internal/ratelimit/redis.go` |
| 2 | `apps/web/vite.config.ts`, `apps/web/package.json`, new SW config file |
| 3 | New `apps/web/src/features/insights/exercise-summary-card.tsx`, `apps/web/src/features/analytics/analytics-page.tsx` |
| 4 | `home-page.tsx`, `dashboard-page.tsx`, `programs-page.tsx`, `tracker-page.tsx`, `profile-page.tsx`, `analytics-page.tsx`, `login-page.tsx` |
| 5 | New test files in `apps/analytics/tests/` and `apps/web/src/features/*/`, `apps/web/src/hooks/` |
| 6 | New migration, new `internal/handler/settings.go`, `internal/service/settings.go`, `apps/web/src/hooks/use-unit-preference.ts` |
| 7 | New `apps/web/src/features/onboarding/` directory, `apps/web/src/lib/onboarding.ts` |
| 8 | `apps/web/src/features/tracker/toolbar.tsx` or `day-view.tsx` |

---

## Risks

| Risk | Mitigation |
|---|---|
| **Phase 1**: `AbortController` wiring may break retry logic in `apiFetch` | Test auth refresh flow end-to-end after wiring signal through |
| **Phase 1**: JWKS refactor could break Google auth in production | Run existing `auth_test.go` + `auth_stress_test.go`; test with real Google token in staging |
| **Phase 2**: Service worker caching stale API responses | Use `NetworkFirst` for `/api/*` with short timeout; never cache auth endpoints |
| **Phase 2**: SW update prompt UX could confuse users | Keep it simple: one-line toast, auto-dismiss after reload |
| **Phase 6**: Migration on production DB | Use goose; test migration up/down; backfill defaults (`'kg'`) |
| **Phase 7**: Onboarding modal blocking flow for users who just want to explore | Make every step dismissable; respect dismissed state permanently |

---

## Verification — Full Gate

After each phase:
- `bun run ci` (typecheck + lint + format + test + build)
- `cd apps/go-api && go vet ./... && go test ./...`
- `cd apps/analytics && python -m pytest tests/`
- Manual smoke test of affected features

---

## Open Questions

- **Phase 2**: `registerType: 'prompt'` vs `'autoUpdate'` — prompt is safer but adds friction.
  Start with prompt; revisit if users don't click update.
- **Phase 7**: Should onboarding show for guest users or only authenticated? Authenticated-only
  seems right since guests are exploratory.
- **Phase 8**: Should calendar export support Apple Calendar / Outlook (.ics) in addition to
  Google Calendar? Could add later as a follow-up.
