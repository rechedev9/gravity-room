# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GZCLP Tracker — a Next.js 16 app (React 19, TypeScript, Tailwind CSS 4) that implements the GZCLP linear progression weightlifting program. Static export (`output: 'export'` in next.config.ts) — no SSR, no API routes, no server components at runtime. All state lives in localStorage via Zod-validated schemas, with optional Supabase cloud sync.

## Commands

| Task         | Command                              |
| ------------ | ------------------------------------ |
| Dev server   | `bun run dev`                        |
| Build        | `bun run build`                      |
| Type check   | `bun run typecheck`                  |
| Lint         | `bun run lint`                       |
| Format check | `bun run format:check`               |
| Format fix   | `bun run prettier --write <path>`    |

No test runner is configured.

## Architecture

### Data flow

```
schemas.ts (Zod v4) → types/index.ts (z.infer<>) → engine.ts (pure computation)
                                                   ↘
                                           use-program.ts (React state + localStorage)
                                                   ↕
                                           use-cloud-sync.ts (Supabase sync)
                                                   ↕
                                              components
```

### Core modules

- **`src/lib/program.ts`** — Static GZCLP protocol: 4-day rotation (`DAYS`), T1/T2 stage definitions, weight increments. Read-only constants.
- **`src/lib/engine.ts`** — `computeProgram()`: pure function that replays all 90 workouts from start weights + results map, applying T1/T2/T3 progression/failure rules.
- **`src/lib/schemas.ts`** — Zod v4 schemas for all persisted data. Single source of truth for types.
- **`src/lib/storage.ts`** — localStorage CRUD with Zod parsing; import/export as JSON. Storage key: `gzclp-v3`.
- **`src/lib/stats.ts`** — `extractChartData()` and `calculateStats()` for the stats/chart panel.

### Auth & sync layer

- **`src/lib/supabase.ts`** — Singleton Supabase client; returns `null` when env vars are missing (graceful degradation).
- **`src/contexts/auth-context.tsx`** — `AuthProvider` / `useAuth()` — wraps Supabase Auth with PKCE flow. Provides `signUp`, `signIn`, `signInWithGoogle`, `signOut`.
- **`src/lib/sync.ts`** — Cloud sync primitives: `fetchCloudData`, `pushToCloud`, `determineInitialSync` (handles push/pull/conflict/none). Sync metadata tracked in separate localStorage key.
- **`src/hooks/use-cloud-sync.ts`** — Orchestrates sync lifecycle: initial sync on login, debounced push on data change (2s), reconnect sync, conflict resolution. Uses `navigator.locks` for cross-tab mutex.
- **`src/lib/auth-errors.ts`** — Maps raw Supabase error messages to sanitized user-facing strings.

### Hooks

- **`src/hooks/use-program.ts`** — Central state hook: start weights, results, undo history. Auto-persists to localStorage. Uses `useSyncExternalStore` to avoid hydration mismatch.

### Component tree

`RootLayout` → `Providers` (AuthProvider) → `GzclpApp` (setup vs. tracker routing) → workout rows, toolbar, stats panel, etc.

## Key domain concepts

- **Tiers (T1/T2/T3):** Exercise priority levels with different set/rep schemes and progression rules
- **Stages:** When a tier fails, it advances to the next stage (fewer reps, more sets) before resetting weight
- **Results map:** `Record<workoutIndex, { t1?, t2?, t3? }>` — sparse map keyed by workout index (0–89)

## Conventions

- Types are inferred from Zod schemas via `z.infer<>`, not manually duplicated
- `zod/v4` import path (Zod v4)
- Path alias: `@/` maps to `src/`
- All components are client-side (`'use client'`)
- `isRecord()` type guard (from `type-guards.ts`) for narrowing `unknown` → `Record<string, unknown>` — used instead of `as` casts
- Static export: no `getServerSideProps`, no API routes, no middleware — everything runs in the browser
- Supabase is optional: the app works fully offline when env vars are absent
- **Lockfile hygiene:** After any `package.json` change (adding, removing, or updating dependencies), always run `bun install` and commit the updated `bun.lock` in the same commit. CI uses `--frozen-lockfile` and will fail on any lockfile drift.

## Environment variables

Required for cloud sync (optional — app works without them):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Formatting

Prettier config (`.prettierrc`): single quotes, semicolons, 2-space indent, trailing commas (es5), 100 char print width.
