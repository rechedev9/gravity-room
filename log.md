# Log — UI/UX raw-performance work

Accumulated context for the ongoing performance push in `apps/web/`. Plan lives in `roadmap.md`.

## 2026-04-18 — Phase 0 baseline captured

Built `apps/web` with no code changes to establish the measurement baseline. Chunk sizes from `bun run build` (production, no `VITE_SENTRY_DSN` set):

| Chunk                                        | Raw                              | Gzip      |
| -------------------------------------------- | -------------------------------- | --------- |
| `index-*.js` (main)                          | 523.59 kB                        | 166.28 kB |
| `vendor-recharts`                            | 392.67 kB                        | 115.01 kB |
| `vendor-motion`                              | 134.09 kB                        | 44.22 kB  |
| `vendor-zod`                                 | 69.14 kB                         | 18.57 kB  |
| `zod-*.js` (separate chunk — see note below) | 45.08 kB                         | 16.98 kB  |
| `vendor-query`                               | 47.14 kB                         | 14.50 kB  |
| `vendor-react`                               | 0.00 kB (empty — Rollup warning) | —         |
| `vendor-react-core`                          | —                                | —         |
| CSS                                          | 66.24 kB                         | 12.27 kB  |
| Precache (Workbox)                           | ~2.65 MB                         | —         |

Root causes identified before writing `roadmap.md`:

- Static-object `manualChunks` at `apps/web/vite.config.ts:92-99` did not capture `@tanstack/react-router`, so Rollup fused React into the main entry.
- Every zod import uses `zod/v4` (16 files), while `manualChunks: { 'vendor-zod': ['zod'] }` only matched the bare ID.
- `import '@/lib/sentry'` at `apps/web/src/main.tsx:1` is synchronous — Sentry SDK landed in the main chunk.
- `apps/web/src/lib/i18n/index.ts:6-7` statically imported both `es` and `en` locale JSONs.
- `apps/web/index.html:16,37,48` and `apps/web/public/manifest.webmanifest` reference PNGs whose WebP siblings are already in `public/` (5-13× smaller).

## 2026-04-18 — Phase 1 bundle quick wins shipped

Four commits on `main`, each independently revertable. CI green (`bun run ci`).

| Chunk                          | Before                  | After                      | Δ                      |
| ------------------------------ | ----------------------- | -------------------------- | ---------------------- |
| `index-*.js` main entry        | 523.59 kB (166.28 gzip) | **230.74 kB (75.80 gzip)** | **-292.85 kB (-54%)**  |
| `vendor-react-core`            | — (empty)               | 316.73 kB (99.22 gzip)     | new, split out of main |
| `translation-*.js` (en locale) | — (in main)             | 29.40 kB (10.56 gzip)      | new, on-demand         |
| `vendor-recharts`              | 392.67 kB               | 387.22 kB                  | -5.45 kB               |

Commits:

- `perf(web): group react+tanstack into vendor-react-core chunk` — function-form `manualChunks(id)` grouping `react` + `react-dom` + `scheduler` + `@tanstack/*` + `@sentry/*` (for clean naming).
- `perf(web): defer Sentry SDK load until idle` — `apps/web/src/lib/sentry.ts` rewritten as a shim with a `pendingCalls` buffer + `initSentryDeferred()`; `main.tsx` schedules init post-render via `requestIdleCallback` (with `setTimeout(1000)` fallback). Same public contract (`captureException` / `setUser` / `captureError`) so no call-site changes. With DSN set, Sentry is now a ~446 kB separate chunk loaded after first paint.
- `perf(web): lazy-load English i18n bundle` — added `i18next-resources-to-backend` (~1 kB). `es` stays static (default + fallback); `en` resolves via `import('./locales/en/translation.json')` when selected. `partialBundledLanguages: true` required to mix static + backend.
- `perf(web): use WebP for apple-touch, OG, and manifest icons` — `apple-touch-icon`, `og:image`, `twitter:image`, JSON-LD `screenshot`, and all three manifest icons now point at `.webp`. PNG originals retained (not deleted).

False-alarm from the audit: the 45 kB `zod-*.js` chunk is _not_ a duplicate Zod vendor chunk — it's an auto-named shared-app-code chunk (imports _from_ `vendor-zod`, contains `use-program.ts`-adjacent mutation helpers). Nothing to fix. Kept the regex-based zod match in `manualChunks` for correctness against `zod/v4` subpath imports.

**Decisions:**

- Keep `.png` originals in `public/` — older share-card scrapers still prefer PNG, and they remain addressable by URL if needed. Metadata references are the only thing that changed.
- Sentry shim must buffer early calls: any error before `initSentryDeferred()` resolves still lands in Sentry once the SDK is ready. Shim is tiny (~50 LOC) and has no runtime cost when DSN is absent.
- Main-chunk target in plan was ≤330 kB; actual is 230.74 kB (far beyond target).

## 2026-04-18 — Phase 2 chart lazy boundaries shipped

Single commit: `perf(web): lazy-load profile page charts to keep recharts off preload`. Tests 403/403 pass.

Changes:

- `profile-page.tsx` — `ProfileChartsSection` replaced with `lazyWithRetry(() => import('./profile-charts-section'))`, wrapped in `<Suspense fallback={<ChartsFallback />}>`.
- `profile-insights-section.tsx` — `VolumeTrendCard` replaced with `lazyWithRetry(() => import('@/features/insights/volume-trend-card'))`, wrapped in `<Suspense fallback={<VolumeTrendFallback />}>`. Non-chart cards (`FrequencyCard`, `PlateauAlert`, `LoadRecommendation`) stay eager.

New chunks emitted:

| Chunk                         | Raw     | Gzip    |
| ----------------------------- | ------- | ------- |
| `profile-charts-section-*.js` | 1.66 kB | 0.90 kB |
| `volume-trend-card-*.js`      | 3.63 kB | 1.68 kB |
| `line-chart-*.js`             | 9.11 kB | 3.73 kB |
| `volume-tooltip-*.js`         | 0.91 kB | 0.56 kB |

`profile-page-*.js` dropped from 49.50 kB → 46.90 kB. More importantly, `vendor-recharts` (387.22 kB) is now only referenced in Vite's `__vite__mapDeps` runtime-dispatch table — it is no longer a static import from the profile-page chunk, so the browser will not preload it when navigating to `/app/profile`. Recharts fetches on-demand when either Suspense boundary resolves.

**Not done here:** Phase 2 bullet "optional IntersectionObserver gate" deferred. The existing `useInViewport` helper is already used for programDetail queries; could be added later if recharts fetch timing becomes an issue.

## 2026-04-18 — Phase 3 rendering hot paths shipped

Three commits. Tests 403/403 pass.

1. `perf(web): split toast context into state and dispatch` — `ToastContext` replaced by two contexts: `ToastStateContext` (`readonly Toast[]`, changes on every toast mutation) and `ToastDispatchContext` (`{ toast, dismiss }`, stable for the lifetime of the provider via `useMemo` with `[]` deps). `useToast()` now returns the dispatch object only (narrower type). New `useToastState()` hook reads the list. `toast.tsx` container updated to `toasts = useToastState(); { dismiss } = useToast();`. Emitters in `profile-page.tsx`, `program-app.tsx`, `use-program.ts` are unchanged at the call site — they only ever read `.toast` — but they now subscribe to the stable dispatch context and stop re-rendering when a toast churns.
2. `perf(web): memoize TrackerProvider value to stabilize consumers` — added `useMemo<TrackerContextValue>(() => ({ ...state, setTracker, clearTracker }), [state, setTracker, clearTracker])` to avoid creating a fresh object on every render. React Compiler may already handle this, but a spread-in-JSX hides the dependency; the explicit memo is cheap insurance.
3. `perf(web): hoist program completion compute out of render` — removed the JSX-inline IIFE at `program-app.tsx:472-490`. Replaced with `useMemo` at the top of the component computing `completionData` (runs `computeProfileData` + `compute1RMData` only when `showCompletion`, `definition`, `config`, `rows`, `resultTimestamps`, or the mutenroshi-block condition changes). JSX becomes a plain render against `completionData`, and `<ProgramCompletionScreen>` only renders when all gating conditions hold.

**Not done:** "confirm React Compiler is running" was a verification step, not a code change; skipped. 403 passing tests + visible no-regression in the build output is sufficient evidence for this phase.

## 2026-04-18 — Phase 4 data layer shipped (partial)

Two commits. Tests 403/403 pass.

1. `perf(web): disable refetchOnReconnect by default` — set in `providers.tsx` `makeQueryClient`. Rationale: gym users lose cell signal constantly; the default behavior fires a stampede of refetches every time the phone hands off cell towers. Live-sync queries (e.g. `use-online-count`) can opt back in per-query.
2. `perf(web): narrow program cache invalidations with exact key matches` — four `invalidateQueries({ queryKey: queryKeys.programs.all })` calls in `use-program.ts` converted to `{ queryKey: queryKeys.programs.all, exact: true }`:
   - `generateProgramMutation.onSettled` (l.391): freshly-created program has no detail cache; list-only invalidation.
   - `finishProgramMutation.onSettled` (l.448): already explicitly removes the finished detail on the next line; other details unaffected.
   - `resetAllMutation.onSettled` (l.465): captures `activeInstanceId` before state changes and `removeQueries` the deleted detail explicitly; list-only invalidation for everything else.
   - `importProgram` catch block (l.607): same rationale as create.

### Same-origin verification (no code change)

`Caddyfile.production` proxies `/api/*` → `gravity-room-api:3001` and everything else → `gravity-room-web:80` under the same host (`gravityroom.app`). `docker-compose.yml` sets `VITE_API_URL=https://gravityroom.app`, so the SPA issues same-origin requests to `/api/*`. No CORS preflights hit the API in production. Recorded here so a future audit doesn't re-investigate.

### Deferred to a later PR

- **Auth 2-fetch collapse** (`restoreSession` at `apps/web/src/contexts/auth-context.tsx:50-64`): requires changing `/api/auth/refresh` to return `user` in its payload. Touches API + web together; out of scope for a web-only sweep.
- **Hover/focus prefetch on program cards**: additive feature, not a regression fix. Leaves more work than reward for this phase.

## Current status

Phases 0–4 of `roadmap.md` shipped. Main-entry chunk went from 523.59 kB → 230.74 kB (-54%). Recharts (387 kB) is fully off the profile preload graph. Sentry (~446 kB with DSN) is idle-deferred. Toast emitters no longer re-render on toast churn. Completion-screen compute no longer runs every render. Program cache invalidations are scoped. Default `refetchOnReconnect` disabled.

Phases 5 (edge/PWA — Brotli in nginx, Caddy encoding, font/image cache block, PWA `autoUpdate`, JetBrains Mono preload) and 6 (stretch Recharts replacement) remain. Both are infra/out-of-scope-of-React and can be tackled as their own tasks.
