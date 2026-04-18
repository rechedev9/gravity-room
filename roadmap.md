# Roadmap — UI/UX Raw-Performance Improvements

**Scope:** `apps/web/` (React 19 + Vite + React Compiler + TanStack Router/Query).
**Goal:** reduce TTI on cold-load, reduce JS parse/eval work, cut bundle weight, and remove render-amplifier patterns that React Compiler cannot fix on its own.
**Status:** Phases 0–4 shipped (main-entry chunk 523 → 231 kB; recharts off profile preload; sentry idle-deferred; rendering hot paths hoisted/memoized; data-layer invalidations tightened). Phases 5–6 pending. Last updated 2026-04-18.

This is a multi-track refactor ordered by ROI. Each phase is independently verifiable end-to-end (tracer-bullet style — we build, measure, ship, repeat).

## Objective

Make the SPA demonstrably faster on first load, on route transitions, and during high-frequency interaction in the tracker. Every phase must show a measurable delta against a captured baseline (bundle size per chunk, Lighthouse landing + `/app`, DevTools render counts on tracker set-completion).

## Current State (from repo inspection)

- **Build (`bun run build` — measured):** `index-CavVoe9U.js` **523 kB** (166 kB gzip), `vendor-recharts` 393 kB, `vendor-motion` 134 kB, `vendor-zod` 69 kB + duplicate `zod-*.js` 45 kB, `vendor-query` 47 kB. Precache total ~2.65 MB.
- **`vendor-react` emits an empty chunk.** Rollup warning confirms it. React + react-dom + `@tanstack/react-router` + Sentry collapse into the main entry because the manualChunks boundary doesn't capture the router, so the splitter fuses them into `index-*.js`. See `apps/web/vite.config.ts:92-99`.
- **Duplicate Zod:** `vendor-zod` (69 kB) AND `zod-*.js` (45 kB) both emitted — 114 kB of Zod. Some import bypasses the `manualChunks` name.
- **Sentry is eager.** `apps/web/src/main.tsx:1` → `import '@/lib/sentry'` blocks first render for all visitors including unauthenticated landing.
- **i18n eagerly bundles both locales.** `apps/web/src/lib/i18n/index.ts:6-7` statically imports both `es` and `en` translation JSONs into the main chunk.
- **Recharts chunked but not lazy at the leaf.** `ProfileChartsSection` and `VolumeTrendCard` import recharts statically from the profile route. `StatsPanel` is already lazy-loaded inside the tracker (good).
- **OG/apple-touch images use PNG** (769 kB og-image, 117 kB logo) while the WebP equivalents (59 kB, 16 kB) already exist in `public/`.
- **No Brotli** in `apps/web/nginx.conf`; no compression directive in `Caddyfile.production`.
- **`ToastProvider` value is a raw object literal** (`apps/web/src/contexts/toast-context.tsx:64`) with plain `toast` / `dismiss` closures; every toast re-renders all consumers. React Compiler cannot stabilize the `setTimeout`-chained closures.
- **`TrackerProvider`** spreads state into a new object every render (`apps/web/src/contexts/tracker-context.tsx:30`).
- **`ProgramApp` completion IIFE calls `computeProfileData` + `compute1RMData` inside JSX without memoization** (`apps/web/src/features/tracker/program-app.tsx:477-478`) — O(rows × slots) per re-render while the completion screen is open.
- **Data waterfall:** `useProgram` runs a 3-query cascade (`catalogQuery` + `programsQuery` → derive `activeInstanceId` → `detailQuery`) on every tracker load (`apps/web/src/hooks/use-program.ts:186-214`). No `prefetchQuery` anywhere in the codebase.
- **Broad invalidation:** `generateProgram` / `finishProgram` / `resetAll` / `importData` / `deleteOrphan` all invalidate `queryKeys.programs.all` without `exact: true`, which also busts every cached `programs.detail(id)` by prefix.
- **Session restore is 2 RTTs sequential** (`refresh` then `me`) in `apps/web/src/contexts/auth-context.tsx:50-64`.
- **Cross-origin risk:** `VITE_API_URL` defaults to a separate origin → every authenticated request triggers a CORS preflight.
- **React Compiler is on** (`vite.config.ts:22-24`). Route-level code-splitting is already in place (`apps/web/src/router.tsx:37-71`). Charts disable entry animations. No `ResizeObserver`/`useLayoutEffect` in user code outside recharts internals.

## Approach

Ship six small, independently shippable phases. Each phase is a vertical slice (code + measurement), so we can halt at any point and still have shipped a real improvement.

Rejected alternatives:
- **Replace Recharts wholesale** — too risky up front; defer to Phase 6 as stretch after cheaper wins are captured and the remaining chart chunk is re-measured.
- **Rewrite rendering with manual `useMemo`/`React.memo` everywhere** — rejected because React Compiler already memoizes most of this; we only touch the patterns the compiler provably can't fix (object-literal provider values, JSX-inline heavy computes, split-concern contexts).
- **Adopt server components / streaming SSR** — out of scope; this is a Vite SPA and the ROI is much lower than the items in this roadmap.

## Constraints

- React Compiler is enabled. Do not add classic manual memoization unless the compiler can't see the code path (object literals, spread props, inline IIFE, closures capturing frequently-mutated refs).
- Preserve zero-CDN / GDPR-friendly posture (self-hosted fonts, no Google Fonts).
- Must remain a PWA with offline-first for `/api/*` (non-auth) per `vite.config.ts:52-63`.
- Production compose stack terminates TLS at Caddy and proxies to nginx (see `Caddyfile.production`). Any compression change must land at one of the two layers, not both.
- TypeScript rules: no `any`, no suppressions, explicit return types, readonly by default.

## Workstreams

1. **Bundling & assets** — vite config, index.html, manifest, nginx, Caddy.
2. **Rendering** — context providers and tracker hot paths.
3. **Data layer** — TanStack Query defaults, prefetch, invalidation scope, auth cold-start.
4. **Measurement** — baseline + post-phase deltas (cross-cutting; every phase closes with a measurement).

## Step-by-Step Plan

### Phase 0 — Baseline (Done)

- Run `cd apps/web && bun run build` and record chunk sizes in `log.md`.
- Capture Lighthouse mobile for `https://gravityroom.app/` (landing) and authenticated `/app` (dev login in a clean profile). Save scores: FCP, LCP, TTI, TBT, Total JS.
- Record one DevTools Profiler session marking 5 sets on the tracker with the completion screen open. Capture render count + commit duration.

No code changes. Checkpoint: numbers are committed to `log.md` so we can prove deltas later.

### Phase 1 — Bundle quick wins (Done)

Target: cut main-entry chunk by ~150-200 kB and remove two duplicate vendor chunks. All changes are low-risk config tweaks.

1. **Fix empty `vendor-react` chunk.** In `apps/web/vite.config.ts:92-99`, switch `manualChunks` from the static object form to a function that groups `react`, `react-dom`, and every `@tanstack/*` package (router + query) into a single `vendor-react-core` chunk. Keep `vendor-motion`, `vendor-recharts`, `vendor-zod` separate.
2. **Investigate the duplicate Zod chunk.** Grep for any `zod` import that may be reaching the splitter via a dynamic path (`apps/api/` shared imports, `openapi-zod-client` generated code). Fold it into `vendor-zod`.
3. **Defer Sentry init.** Replace `import '@/lib/sentry'` at `apps/web/src/main.tsx:1` with a dynamic `import()` scheduled after `createRoot().render(...)` (use `requestIdleCallback` with a `setTimeout` fallback). Guard with `if (import.meta.env.VITE_SENTRY_DSN)` to short-circuit in dev. Keep the same `setUser`/`captureException` public contract via a small `sentry-shim.ts` that buffers early calls until the SDK loads.
4. **Lazy-load the non-default i18n locale.** Rewrite `apps/web/src/lib/i18n/index.ts` to:
   - Always import the default (`es`) resource statically.
   - Register `en` via an async backend (`i18next-resources-to-backend` or a manual `addResourceBundle` after a `import('./locales/en/translation.json')` on language switch).
5. **Switch eager PNGs to WebP:**
   - `apps/web/index.html:37,48` — `og:image` and `twitter:image` → `/og-image.webp`. Update `og:image:type` to `image/webp`.
   - `apps/web/index.html:16` — `apple-touch-icon` → `/logo.webp`.
   - `apps/web/public/manifest.webmanifest` — repoint the three icon entries to the `.webp` siblings.

**Checkpoint:** rebuild, re-run Lighthouse on landing, compare. Expect main-entry chunk ≤ ~330 kB and Zod total ≤ ~70 kB. Commit per sub-step with `scripts/committer` so each is independently revertable.

### Phase 2 — Chart lazy boundaries (Done)

Target: keep Recharts (~393 kB raw) out of the profile chunk until the user scrolls charts into view.

1. In `apps/web/src/features/profile/profile-page.tsx`, convert `ProfileChartsSection` and `VolumeTrendCard` (via `ProfileInsightsSection`) into `React.lazy` imports.
2. Wrap each in `<Suspense fallback={<ChartsSkeleton />}>` — reuse the existing StatsSkeleton pattern from `apps/web/src/features/tracker/program-app.tsx:446`.
3. Optional: add an `IntersectionObserver` gate so the lazy import only fires when the chart containers enter the viewport. Keep it behind a single shared hook (`useInViewLazyLoad`).

**Checkpoint:** rebuild and confirm `vendor-recharts` is no longer in the profile chunk's direct preload. Visit `/app/profile`, confirm charts render without regression.

### Phase 3 — Rendering hot paths (Done)

Target: eliminate provider-driven re-render amplification and JSX-inline heavy compute.

1. **Split `ToastProvider` into state + dispatch contexts** (`apps/web/src/contexts/toast-context.tsx`):
   - `ToastStateContext` — `readonly Toast[]` (changes per toast).
   - `ToastDispatchContext` — stable `{ toast, dismiss }` wrapped in `useMemo` after hoisting `toast` and `dismiss` into `useCallback` with `setToasts`-based updaters (no closure over `toasts`).
   - Export `useToast` (dispatch, for emitters) and `useToastState` (subscribers, for the container). Emitters stop re-rendering on toast churn.
2. **Memoize `TrackerProvider` value** (`apps/web/src/contexts/tracker-context.tsx:30`). Replace the inline spread with `useMemo(() => ({ ...state, setTracker, clearTracker }), [state])` — React Compiler may already do this, but the spread-in-JSX form hides the dependency.
3. **Hoist completion-screen compute out of render** (`apps/web/src/features/tracker/program-app.tsx:472-490`). Replace the `(() => { ... })()` IIFE with either:
   - `useMemo(() => showCompletion ? { profileData, oneRMEstimates } : null, [showCompletion, rows, definition, config, resultTimestamps])`, OR
   - An extracted `<ProgramCompletionWrapper />` that receives primitives and computes internally — the wrapper memoizes naturally and the compiler can skip it when props are stable.
4. **Confirm React Compiler is actually running.** Run `bun run build -- --mode development` with the compiler's `logger` option temporarily enabled to verify the tracker files are being transformed. If any are skipped (common with refs + mutable closures in `use-program.ts`), add targeted `useMemo` only there.

**Checkpoint:** Profile 5 set-completions again. Expect fewer commits per interaction and lower TBT. No behavioral change in tests — run `bun run test` and relevant e2e specs.

### Phase 4 — Data layer (Done — partial; auth 2-fetch collapse + prefetch deferred)

Target: remove the waterfall on tracker cold load and stop broad cache busts.

1. **Collapse the auth cold-start 2-fetch.** Change the `/api/auth/refresh` response (in `apps/api/`) to include the user payload, and update `restoreSession` at `apps/web/src/contexts/auth-context.tsx:50-64` to parse it directly — eliminates the follow-up `fetchMe`. (Coordinate with the API team / same repo; this is a backend endpoint tweak.)
2. **Prefetch on hover/focus for program cards.** Add `onMouseEnter` / `onFocus` handlers in `active-program-card.tsx` and the programs-catalog cards that call `queryClient.prefetchQuery({ queryKey: queryKeys.catalog.detail(programId), ... })` and the matching `programs.detail`. Use the router's `preload` pattern where possible.
3. **Tighten invalidation scope.** In `use-program.ts` (lines ~391, 448, 465, 607), change `queryClient.invalidateQueries({ queryKey: queryKeys.programs.all })` to `{ queryKey: queryKeys.programs.all, exact: true }` where only the list should refetch. For mutations that also need detail refreshed, invalidate both keys explicitly.
4. **Disable `refetchOnReconnect` by default.** In `apps/web/src/components/providers.tsx:36-44`, add `refetchOnReconnect: false` to `defaultOptions.queries`. Enable per-query only where live-sync matters (`use-online-count.ts`).
5. **Verify same-origin API in production.** Confirm that the production `VITE_API_URL` resolves to the same origin as the SPA (via the Caddy reverse proxy). If not, route `/api/*` through the web origin — CORS preflights disappear. Document outcome in `log.md`.

**Checkpoint:** Cold-load the tracker with Chrome DevTools Network tab. Expect: 1 refresh request (not 2), no catalog→detail sequential gap on warm navigation, and preflights only on cross-origin endpoints that actually need them.

### Phase 5 — Edge & PWA (workstream 1, infra)

Target: smaller payloads on the wire, stronger long-term caching for hashed assets, fresher SW updates.

1. **Enable Brotli in nginx.** In `apps/web/nginx.conf`, add `ngx_brotli` module config (or compile nginx image with the module). Keep gzip as fallback. Brotli typically cuts an additional 15-20% off JS/CSS over gzip.
2. **Add a font/image cache block.** Append a `location ~* \.(woff2|webp|png|svg)$ { add_header Cache-Control "public, max-age=31536000, immutable"; }` block in `nginx.conf` so `/fonts/*`, `/hero.webp`, `/logo*.webp` stop getting `no-store` headers inherited from the root location.
3. **Add a Caddy-side compression safety net.** Add `encode zstd gzip` to `Caddyfile.production` so nginx-less deployments (or future changes) don't silently ship uncompressed responses.
4. **Switch PWA `registerType` to `autoUpdate`.** In `vite.config.ts:27`. Gym users keep the tab alive across sessions; `prompt` mode leaves stale SW behind longer than intended. Communicate via a soft reload banner on next navigation if we want to preserve a user-visible hint.
5. **Preload JetBrains Mono variable font.** It's used in data-heavy UI but not preloaded in `apps/web/index.html:59-67`. Add a `<link rel="preload">` for `/fonts/jetbrains-mono-variable.woff2`.

**Checkpoint:** curl `-H "Accept-Encoding: br"` against a hashed `/assets/*.js` URL and confirm `Content-Encoding: br`. Re-run Lighthouse on landing and expect FCP/LCP to tighten again.

### Phase 6 — Stretch: shrink the Recharts footprint

**Only run this if Phase 2 has shipped and Recharts still dominates the post-authentication waterfall.**

Evaluate replacing `recharts` with `uplot` (~30 kB gzip) wrapped behind the existing `apps/web/src/components/charts/` abstraction. Line charts and bar charts dominate usage; area-trend in `VolumeTrendCard` is the one non-trivial port. Keep recharts fallback behind a feature flag for one release, A/B test raw chart render time, then delete the fallback.

## Checkpoints

- **End of Phase 0:** baseline numbers committed. Do not proceed without them.
- **End of Phase 1:** rebuild shows `vendor-react` non-empty, Zod single chunk, Sentry deferred, locales split, icons WebP. Decision point: is the entry chunk ≤ ~330 kB? If not, investigate before continuing.
- **End of Phase 2:** profile route chunk sizes dropped; charts still render.
- **End of Phase 3:** tracker DevTools profile shows fewer commits per set-completion.
- **End of Phase 5:** production payload is Brotli-encoded; Lighthouse mobile ≥ target thresholds (set in Phase 0).

## Files Likely Affected

- `apps/web/vite.config.ts` — manualChunks function, PWA registerType.
- `apps/web/index.html` — preloads, image references.
- `apps/web/public/manifest.webmanifest` — icon WebP paths.
- `apps/web/src/main.tsx` — Sentry deferral.
- `apps/web/src/lib/sentry.ts` + new `sentry-shim.ts` — buffered init.
- `apps/web/src/lib/i18n/index.ts` — lazy locale backend.
- `apps/web/src/features/profile/profile-page.tsx`, `profile-charts-section.tsx`, `profile-insights-section.tsx` — `React.lazy` + Suspense.
- `apps/web/src/contexts/toast-context.tsx` — state/dispatch split.
- `apps/web/src/contexts/tracker-context.tsx` — `useMemo` value.
- `apps/web/src/features/tracker/program-app.tsx` — hoist completion compute.
- `apps/web/src/hooks/use-program.ts` — invalidation scope.
- `apps/web/src/components/providers.tsx` — `refetchOnReconnect` default.
- `apps/web/src/contexts/auth-context.tsx` — consume user from refresh response.
- `apps/api/src/routes/auth.ts` (or equivalent) — refresh returns user.
- `apps/web/nginx.conf` — Brotli, font/image caching.
- `Caddyfile.production` — `encode zstd gzip`.
- `log.md` — phase measurements appended.

## Risks

- **Sentry deferral may lose early errors** (before the SDK loads). Mitigate with a tiny in-memory ring buffer in `sentry-shim.ts` that flushes on ready.
- **i18n lazy-load may flash untranslated text.** Gate the router render on `i18n.isInitialized`, or ensure the default locale ships statically so Spanish users see no flash and English users see the fallback string briefly.
- **Splitting `ToastProvider`** changes the public hook surface. All call sites currently use `useToast()`. Keep `useToast` as the dispatch hook (same name, narrower type) and add `useToastState` for the container — minimizes diff.
- **Changing `invalidateQueries` to `exact: true`** can miss a legitimate detail refresh. Inventory every call site; add explicit detail-key invalidation where needed.
- **Enabling Brotli in nginx requires an image rebuild** with the `ngx_brotli` module; confirm the Dockerfile for the web image supports it.
- **`auth/refresh` returning user info** means an existing API response contract changes. Version the endpoint if any other client depends on it, otherwise just update both sides in one PR.
- **PWA `autoUpdate`** silently rolls forward SW — risk of cached stale assets on clients mid-workout. Add a post-update reload hint so the user doesn't lose in-progress set state.

## Verification

- `bun run ci` at repo root after each phase (typecheck + lint + format + web tests + build).
- `cd apps/api && bun test` if the refresh endpoint is touched.
- `bun run e2e` (Playwright) focused on auth, catalog, tracker, undo flows after Phases 3-4.
- Manual: Chrome DevTools Performance — cold landing and `/app/tracker/:programId`; compare to Phase 0 baseline.
- Manual: Lighthouse mobile on landing + `/app`; compare scores to Phase 0 baseline.
- Manual: React DevTools Profiler — mark 5 sets, open completion, compare commit count and total time to Phase 0.
