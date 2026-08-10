# Frontend latency baseline — before fixes

Measured with chrome-devtools MCP against `bun run build:no-prerender` + `bun run preview`
(`127.0.0.1:5173`), under **4× CPU throttle + Slow 4G + mobile viewport (390×844×3)**.

> Note: the `no-prerender` build is used so chunk graph + network are representative
> without needing Chromium+API for the prerender step. Prerendered HTML would improve
> FCP on the public landing only; it does not change the chunk findings below.

## Lab metrics

| Route    | LCP    | CLS  | TTFB | Notes                                                       |
| -------- | ------ | ---- | ---- | ----------------------------------------------------------- |
| `/`      | 826 ms | 0.00 | 7 ms | LCP breakdown: load-delay 528ms, render-delay 290ms         |
| `/login` | —      | —    | —    | same eager chunk set as `/`; + Google GSI client (external) |

## Eager payload (preloaded on EVERY route via index.html modulepreload)

20 chunks, **~353 KB gzipped total**. The biggest contributors:

| Chunk               | gz size      | Should be on landing/login?                                                    |
| ------------------- | ------------ | ------------------------------------------------------------------------------ |
| **vendor-recharts** | **110.7 KB** | **NO** — only insights/tracker-stats/profile-charts (all lazy routes)          |
| index (entry)       | 85.3 KB      | yes, but bundles i18n (unchunked)                                              |
| vendor-react-core   | ~56 KB       | yes                                                                            |
| vendor-motion (×3)  | ~32.5 KB     | NO on public/login — pulled in by `AppLayout` (static import in router.tsx:16) |
| vendor-tanstack     | ~38 KB       | yes                                                                            |
| vendor-zod (×2)     | ~20 KB       | yes                                                                            |

## Key findings (measured, re-ranked vs static audit)

1. **🔴 recharts (110.7 KB gz / 387 KB raw) downloads on every route, including `/` and `/login`.**
   The static audit claimed recharts was "lazy, insights only at runtime" — **WRONG**. The built
   entry `index-*.js` has a real static `import … from "./vendor-recharts-*.js"`. In source, recharts
   is only reachable via lazy boundaries (volume-trend-card / stats-panel / profile-charts-section are
   all `lazy()`), so this is a **Rolldown code-splitting artifact**: the `vendor-recharts` group with
   `maxSize: 2MB` (vite.config.ts:131, set to dodge recharts' circular-import mis-splits) causes the
   shared recharts chunk to be hoisted into the entry's static graph. **This is the #1 win** — ~31% of
   the eager payload, on a route that never renders a chart. Confirmed via network trace on `/` (reqid 136) and `/login` (reqid 195). Supersedes plan item A3 (SW precache was only a symptom).

2. **🟠 vendor-motion (~32.5 KB gz) on every route** — `router.tsx:16` statically imports `AppLayout`,
   which imports `motion/react`. Landing imports motion directly anyway, but `/login` and the public
   shell pay for it needlessly. (Plan audit Finding 3.)

3. **🟡 i18n is unchunked** — folded into the 85 KB entry chunk (plan A2).

4. **Auth bootstrap waterfall (code-confirmed, live `/app` trace pending):** `restoreSession`
   (auth-context.tsx:51-65) awaits `refreshAccessToken()` then `fetchMe()` serially, and
   `AppLayoutWithTracker` (router.tsx:80-90) gates the whole shell on `loading`. Two serial round-trips
   block first authenticated paint. Live measurement needs API+DB+auth; the serial structure is
   unambiguous from code. (Plan B1.)

## Verify-after targets

- recharts must NOT appear in the `/` and `/login` network traces after the fix.
- Eager gz payload should drop from ~353 KB toward ~240 KB (−110 KB recharts, −~32 KB motion on public).
- Landing LCP should hold or improve (fewer competing downloads on the critical path).

---

# AFTER (Tier A applied)

Changes: (A-recharts) removed the dedicated `vendor-recharts` Rolldown group so recharts
stays in one intact async chunk reachable only from lazy chart routes; (A2) split i18next
into `vendor-i18n`; (A1) made `undoLastMutation` optimistic. Same build/throttle setup.

| Metric                         | Before                  | After               | Δ                            |
| ------------------------------ | ----------------------- | ------------------- | ---------------------------- |
| Landing `/` LCP (4×CPU/Slow4G) | 826 ms                  | 667 ms              | **−159 ms (−19%)**           |
| Landing `/` LCP render delay   | 290 ms                  | 130 ms              | −160 ms                      |
| Landing `/` CLS                | 0.00                    | 0.00                | —                            |
| recharts on `/` and `/login`   | 110.7 KB gz, downloaded | **not requested**   | **−110.7 KB gz**             |
| Entry chunk (`index-*.js`)     | 261 KB / 86 KB gz       | 208 KB / 69.5 KB gz | −16.6 KB gz (i18n split out) |

recharts now loads only on chart routes (insights / profile / tracker stats), confirmed by
build-time chunk importers (line-chart, insights-page, profile-page, stats-panel, tracker-page,
volume-trend-card, volume-tooltip) — the dashboard (`home-page`) does NOT pull it.

## recharts circular-split safety (the documented prior bug)

The old `vendor-recharts` group existed to avoid recharts' circular imports being split across
chunks ("undefined axis props at runtime"). Verified the new layout does NOT reintroduce that:

- recharts' circular SCC stays in ONE intact chunk (CartesianGrid/XAxis all in `chart-theme-*`),
  `line-chart` → `chart-theme` is one-directional (no cross-chunk circular ref).
- The built chart chunks (`chart-theme`, `line-chart`, `volume-trend-card`) **dynamically import
  with zero errors** in the browser; all ~80 recharts exports resolve (not undefined).
- 628 web unit tests pass, including `stats-panel.test.tsx` rendering LineChart/BarChart.
- No console errors across a live guest-mode app session.
- ⚠️ NOT yet done: rendering a chart with real logged workout data in the production bundle
  (guest mode blocks statistics; needs an authenticated, data-populated session). Recommend a
  `qa-verifier` / manual pass on `/app/tracker` STATISTICS + `/app/insights` with real data.

## A3 (SW precache exclusion) — DROPPED

Original audit assumed recharts was insights-only; it's also used by the **tracker stats panel**
(core, often-offline gym use). Precaching it now supports offline charts; excluding it by the
dynamic hash-name is brittle and would harm offline UX. The eager-load problem is fully solved by
A-recharts; precache is a background, non-critical-path cost.

## B1 — auth bootstrap waterfall collapsed (DONE)

`/api/auth/refresh` now returns the user alongside the token (it already had it — `refreshAuthToken`
returns `{ accessToken, refreshToken, user }`; the web handler was discarding `user`). `restoreSession`
(auth-context.tsx) consumes it and drops the second serial `GET /auth/me`, with a defensive fallback
to `fetchMe()` if the field is absent (older API). Cold authenticated load now does **one** auth
round-trip instead of two (refresh→token→/me).

Verified:

- Live: `POST /api/auth/refresh` with a real refresh cookie (dev sign-in) returns
  `{ accessToken, user: {...} }`.
- API: full package suite `bun run test` → 324 pass / 0 fail (auth route test asserts the user field).
- Web: 629 pass / 0 fail, incl. new tests asserting the single-round-trip path (no `fetchMe`) and the
  `fetchMe` fallback. typecheck + lint clean.
- Generated client regenerated — only the `/refresh` description changed (no schema/type drift); the
  web restore path uses the hand-written client, not the generated one.
- ⚠️ Live in-browser cold-load timing of the saved round-trip not captured (needs an authed session
  with the refresh cookie set in the SPA); the serial→single reduction is proven by code + the live
  endpoint + the no-fetchMe unit test.

> Note: the API route-test group (`bun test src/routes`) has pre-existing FLAKY `mock.module()`
> leakage between files (auth.test ↔ insights.test) — independent of these changes (base reproduces
> it; my changes pass 91/0 on repeated runs). Worth hardening separately.

## B2 — motion off the public/eager path (DONE)

`router.tsx` statically imported `AppLayout` (→ `motion/react`), hoisting `vendor-motion` (~32 KB gz)
into the eager bundle on every route. Extracted the authenticated chrome into a lazy
`components/layout/app-shell.tsx` (`TrackerProvider` + `AppLayout`), loaded via `lazyWithRetry` behind
a `Suspense fallback={<AppSkeleton/>}`. Motion now ships only with the lazy app-shell chunk (and the
lazy landing chunk, which uses it directly) — never in the entry/preload.

Verified:

- `index.html` no longer preloads any `vendor-motion`; the entry has no static motion import.
- Network trace on `/login`: **zero motion chunks** (before: 3 vendor-motion + proxy + motion-primitives).
- Guest-mode `/app`: the lazy shell mounts correctly (full nav + sidebar render; only console error is
  the expected API-down `ERR_CONNECTION_REFUSED`).
- Web 629 pass / 0 fail, typecheck + lint clean.
- Landing LCP 667→659 ms (flat — motion was never on the landing LCP path; the win is the lighter
  eager payload on `/login` + faster first app navigation).

## Net eager-payload result (public routes)

recharts (−110 KB gz) + i18n split + motion (−32 KB gz) removed from the eager preload set. The
unauthenticated critical path (`/`, `/login`) no longer carries chart or app-chrome code.

---

# How to measure (objective, repeatable)

Two harnesses live in-repo. Prefer these over ad-hoc DevTools notes when iterating.

## 1. Bundle report (no browser)

```bash
pnpm --filter web perf:baseline
# or: pnpm run perf:baseline   (from repo root)
```

Writes:

- `apps/frontend/web/test-results/perf/bundle-report.json`
- `apps/frontend/web/test-results/perf/bundle-report.md`

Hard fails when:

- recharts lands on the eager modulepreload graph
- eager gzip &gt; 200 KB (calibrated ~166 KB on 2026-08-10)
- eager raw &gt; 650 KB
- total JS gzip &gt; 1.2 MB

Warns (non-fatal) when a small `vendor-motion` chunk is still modulepreloaded.

## 2. Runtime perf (Playwright + CDP)

Needs API + web preview (same stack as `pnpm e2e`):

```bash
pnpm --filter web e2e:perf
# or: pnpm run e2e:perf
```

Scenarios (`e2e/perf-budgets.spec.ts`):

| Scenario            | What it measures                               | Soft budget                           |
| ------------------- | ---------------------------------------------- | ------------------------------------- |
| Landing cold nav    | TTFB, DCL, Load, FCP, LCP, transfer size, heap | FCP &lt; 3s, LCP &lt; 4s              |
| Tracker ready       | time to `Día N` after seed                     | &lt; 8s                               |
| Mark T1 success     | click → undo badge visible                     | &lt; 800 ms                           |
| History virtualized | DOM row count with 60 completed days           | &lt; 50 rows, `data-virtualized=true` |

Artifacts:

- `apps/frontend/web/test-results/perf/perf-report.json`
- `apps/frontend/web/test-results/perf/perf-report.md`

Helpers: `e2e/helpers/perf.ts` (`measureNavigation`, `measureInteraction`, `cdpHeapMetrics`).

## 3. Microbench (unit)

`lastResultWorkoutIndex` + `maxRows` volume parity lives in
`src/lib/profile-stats.test.ts` — asserts capped engine output matches full materialization.

---

# Tier C runtime wins (this worktree)

| Change                                       | Expected win                                      |
| -------------------------------------------- | ------------------------------------------------- |
| Tracker dual-hook `enabled` flags            | No guest storage I/O / catalog fetch on auth path |
| Profile volume viewport gate + `maxRows`     | No N+1 until scroll; engine stops at last log     |
| Home drop `refetchOnMount: 'always'`         | Fewer GETs on home↔tracker bounce                 |
| Lazy i18n second locale                      | ~80–90 KB JSON off eager path                     |
| Auth state/actions split + guest/router memo | Fewer shell re-renders                            |
| `useProgram` stable callbacks + memo return  | Stable action identity across tracker renders     |
| HistoryView windowing (&gt;40 rows)          | Bounded DOM for long histories                    |
| Batch Zod list parse                         | Less main-thread parse on list endpoints          |

---

# Measured baseline (2026-08-10, this worktree) — FINAL

Local lab (no CPU/network throttle). Commands: `pnpm --filter web perf:baseline` +
`DATABASE_URL=… pnpm --filter web e2e:perf`.

## Bundle (`bundle-report.json`)

| Metric                        | Value                                   | Budget            |
| ----------------------------- | --------------------------------------- | ----------------- |
| Eager JS gzip (`/`)           | **178.4 KB**                            | ≤ 220 KB          |
| Total JS gzip                 | **608.1 KB**                            | ≤ 1.14 MB         |
| recharts on eager             | **no**                                  | must stay no      |
| real motion on eager (≥4 KB)  | **no**                                  | must stay no      |
| locale on eager               | **no** (2 async `translation-*` chunks) | must stay no      |
| `/login` landing preload leak | **fixed (0)**                           | must stay 0       |
| `/login` preload count        | **17** (entry + login-page)             | was 28+ with leak |

## Runtime (`perf-report.json`)

| Scenario                        | Value              | Budget      |
| ------------------------------- | ------------------ | ----------- |
| Landing FCP                     | **84 ms**          | &lt; 3 s    |
| Landing LCP                     | **84 ms**          | &lt; 4 s    |
| Landing DCL                     | **40 ms**          | —           |
| Landing transfer                | **545 KB**         | —           |
| Tracker ready                   | **1502 ms**        | &lt; 8 s    |
| Mark T1 success                 | **274 ms**         | &lt; 800 ms |
| History DOM rows (60 completed) | **13** virtualized | &lt; 50     |
| Landing heap                    | 6.9 MB             | —           |
| Tracker heap                    | 11.9 MB            | —           |

## Done criteria (this worktree)

Further pure-perf work is diminishing returns without product/API changes. Stop here when:

1. Bundle budgets pass (`perf:baseline` / `bundle:report`)
2. Runtime budgets pass (`e2e:perf`)
3. No cross-route modulepreload leaks on public prerenders
4. Tracker dual-path, profile volume, history virtualization, i18n split shipped

Optional later (not blocking): server `lifetime-volume` endpoint, remove residual tiny
misnamed `vendor-motion` jsx stub naming, 4×CPU/Slow4G Lighthouse-style throttle in
Playwright CDP for apples-to-apples vs the original 667 ms LCP lab.

> Landing times are unthrottled localhost (prerendered HTML). Compare against the
> earlier 4×CPU/Slow4G LCP (667 ms) only under the same throttle conditions.
