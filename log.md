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

## Plan for next phase

Phase 2 of `roadmap.md`: lazy-load Recharts-consuming chart components on the `/app/profile` route (`ProfileChartsSection`, `VolumeTrendCard`). Current `vendor-recharts` 387 kB ships as part of the profile page's initial preload; the goal is to keep Recharts off the preload and let it resolve when the chart container first becomes visible.
