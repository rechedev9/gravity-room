# UI Revival — Underground-Gym Brutalist

**Date:** 2026-05-11
**Status:** Approved — pending implementation plan
**Driver:** The authenticated app (`/app`, `/app/programs`, `/app/tracker`, `/app/profile`) feels lifeless to the user. Code-level audit and visual audit (Chrome MCP via Haiku subagent, against a seeded GZCLP user on local dev) confirmed: ubiquitous gold accent flattens hierarchy, the dashboard's lower 50% of the viewport is empty, there are effectively no micro-interactions, surfaces have no perceptual depth (delta L\* ~3% between body and card), and the design system has dead tokens (`--color-heading`) and raw Tailwind defaults (`bg-green-500`) sitting alongside otherwise well-architected primitives.
**Skill provenance:** Applies the [`impeccable`](https://skills.sh/pbakaus/impeccable/impeccable) design laws (OKLCH palette, no pure `#000`/`#fff`, no side-stripe borders, no glassmorphism default, no hero-metric template, no identical card grids, exponential ease-out motion, no em dashes in copy) without invoking the skill itself (not installed in this environment). Reached via `superpowers:brainstorming` flow.

## Concept (the physical scene)

> Garage gym at 5am, single overhead bulb, chalk dust in the air, rust on the bar. Iron and concrete. Anime fighter posters tacked to the wall — but the room itself is severe.

This scene forces the palette (concrete + chalk + rust + steel), the typography (gym-poster condensed display + mono labels), the motion (heavy stops, no bounce, dropped plates not springs), the decoratives (concrete noise + vignette + sparse rust spots) and the micro-copy (brutalist where it costs nothing, anime narrative left intact in program names and mentor copy).

## Goals

- Replace the ubiquitous gold accent with **rust as primary** and demote gold to a **ceremonial token** (PRs, achievements, victory glow, streak ≥ 10).
- Migrate every color token to **OKLCH** with a clear perceptual hierarchy across surfaces (delta L\* ≥ 5% between body / surface / surface-2).
- Fix the broken / raw tokens (`--color-heading`, `bg-green-500`, `text-white` on `bg-accent`).
- Rebuild `/app` (dashboard home) from scratch around a single hero — **"PRÓXIMA SERIE"** — supported by KPIs, a 12-week heatmap, a PR-road card, a mentor pill, and an actual recent-sessions list (replacing the current placeholder).
- Make the sidebar **expanded by default** on desktop with stable layout (no hover-to-expand on lg+).
- Establish a **motion choreography** (page entry stagger, hover lifts, button press-down, KPI count-up, heatmap stagger, PR bar fill, slate-drop toast, modal pop) using existing `--ease-out-expo` tokens plus one new `--ease-press`.
- Introduce a **decoratives system** (concrete-noise overlay, body vignette, chalk-stamp label utility, base focus ring) at the global layer.
- Surface keyboard shortcuts on `/app/tracker` via a first-visit onboarding overlay (persisted in `localStorage`).

## Non-Goals (Phase 2 backlog)

- `/app/tracker` structural redesign (it only inherits the new color tokens this PR).
- `/app/tracker` mobile touch-target rework (24–32 px targets observed in the audit — known issue, out of scope here).
- `/app/profile` charts upsize / chart-tooltip redesign.
- `/app/programs` card-grid differentiation (the "identical card grid" ban is acknowledged, but ProgramCard structural rework is deferred).
- Micro-copy brutalist rewrite outside the dashboard.
- Sound effects.
- Landing page (`/`, `landing/*`) — intentionally untouched after the recent conversion redesign (`6919244`, `5e6e568`).

## Design tokens (`apps/frontend/web/src/styles/globals.css` `@theme`)

All colors in OKLCH. No pure `#000` or `#fff`. Names chosen so existing Tailwind class consumers (`bg-card`, `text-title`, `text-muted`, …) keep working via aliases where useful, and break-the-build where intent has shifted.

### Surfaces

```css
--color-body: oklch(0.14 0.005 50); /* concrete (was #0b0906) */
--color-surface: oklch(0.19 0.008 50); /* raised panel (alias --color-card; was #130f09) */
--color-surface-2: oklch(0.24 0.01 45); /* hover / second-level panel (new) */
--color-recess: oklch(0.1 0.003 50); /* recessed (alias --color-header; was #070504) */
--color-progress-track: oklch(0.22 0.01 45);
```

### Text

```css
--color-text: oklch(0.94 0.008 80); /* chalk warm — alias --color-main */
--color-text-muted: oklch(0.6 0.012 50); /* steel — alias --color-muted */
--color-text-label: oklch(0.68 0.015 50); /* steel light — alias --color-label */
--color-heading: var(--color-text); /* FIX: was undefined, broke ProfileStatCard accent */
--color-title: var(
  --color-text
); /* DEMOTE: was #f0c040 gold; chalk now. Gold lives only in --color-victory */
```

### Accent — rust as primary

```css
--color-accent: oklch(0.62 0.13 50); /* rust copper (was #e8aa20 gold) */
--color-accent-hover: oklch(0.67 0.15 50);
--color-on-accent: oklch(0.1 0.003 50); /* recess dark text on rust — WCAG AA verified */
```

### Ceremonial gold — scarce, earned

```css
--color-victory: oklch(0.82 0.14 85); /* the only gold in the app */
--color-victory-on: oklch(0.1 0.003 50);
--color-victory-glow: oklch(0.82 0.14 85 / 0.35);
```

Allowed surfaces for `--color-victory` (anywhere else is a bug):

1. `Toast` variant `pr` (new personal record logged).
2. `KpiCard` variant `flame` (streak ≥ 10 days).
3. `ProgressBar` when `completed === total` (program completed seal).
4. `Button` variant `victory` (used only on the "Achievement unlocked" modal CTA, currently absent — adding for completeness).
5. Badge "unlocked" state on `/app/profile` (existing `ProfileBadges`).

### Semantic / state

```css
--color-online: oklch(
  0.72 0.14 145
); /* replaces hardcoded bg-green-500 in online-indicator.tsx:18 */
--color-ok: oklch(0.68 0.14 145);
--color-ok-bg: oklch(0.2 0.04 145);
--color-ok-ring: oklch(0.5 0.1 145);
--color-fail: oklch(0.65 0.18 25);
--color-fail-bg: oklch(0.2 0.06 25);
--color-fail-ring: oklch(0.45 0.12 25);
--color-warn: oklch(0.75 0.16 70);
```

### Borders / rules

```css
--color-rule: oklch(0.26 0.008 50);
--color-rule-strong: oklch(0.4 0.014 50);
```

### Radii — brutalist sharpness

```css
--radius-base: 2px; /* was Tailwind default rounded (4px) on most cards/buttons */
--radius-pill: 9999px; /* avatars and dots only */
```

### Shadows — sharp drop, hairline inset (no blur softness)

```css
--shadow-card: 2px 2px 0 0 oklch(0 0 0 / 0.5), inset 0 0 0 1px oklch(1 0 0 / 0.02);
--shadow-elevated: 4px 4px 0 0 oklch(0 0 0 / 0.6), inset 0 0 0 1px oklch(1 0 0 / 0.03);
--shadow-victory: 0 0 28px var(--color-victory-glow); /* ceremonial only */
```

### Motion — additive to existing tokens

Keep `--ease-out-expo`, `--ease-standard`, `--ease-emphasized`, `--duration-instant/fast/base/slow`. Add:

```css
--ease-press: cubic-bezier(0.3, 0, 0.7, 1);
--duration-press: 80ms;
--press-translate-y: 1px;
```

## Global utilities (`globals.css`)

Replace the dead `.accent-left-gold` / `.accent-left-muted` (side-stripe ban) and remove `.card-glow-gold` (replaced by `--shadow-victory` semantic).

Add:

```css
/* Concrete grain — applied to <body> via .concrete-noise on the app shell */
.concrete-noise::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image: url('data:image/svg+xml;utf8,<svg ...>'); /* SVG turbulence noise, inlined */
  opacity: 0.035;
  mix-blend-mode: overlay;
}

/* Vignette — radial darken on edges */
.vignette::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(ellipse at center, transparent 50%, oklch(0.06 0 0 / 0.35) 100%);
}

/* Chalk-stamp label — replaces .dash-section-title (kept as alias for one release) */
.chalk-stamp {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-text-label);
}

/* Base focus ring (was per-component before) */
:where(button, a, input, select, textarea, [role='button'], [tabindex]):focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

`prefers-reduced-motion` blanket override stays exactly as it is in `globals.css`.

## Component changes (`apps/frontend/web/src/components/`)

### `Button` (`button.tsx`)

- Border `2px` → `1.5px`; `radius` 0 → `var(--radius-base)` (2 px).
- Active state: `translateY(var(--press-translate-y))` + shadow swap to flat, transitioned with `--ease-press` and `--duration-press`.
- Variants: `default` (rust outline), `primary` (rust solid, on-accent text), **`victory`** (ceremonial gold solid + `--shadow-victory` halo — for achievement-unlocked CTAs and PR celebration), `ghost`, `danger`.
- `disabled:opacity-25` → `0.35` (legibility).

### `DashboardCard` (`dashboard-card.tsx`)

- `bg-surface` (raised from body with `delta L* ~5%`).
- `box-shadow: var(--shadow-card)`.
- Header treatment: short 24 px left rule + `chalk-stamp` label (replaces full `border-b` underline).
- Add prop `interactive?: boolean` (default `false`). When `true`, applies hover lift (`translateY(-2px)`, `--ease-out-expo`, 180 ms).

### `KpiCard` (`features/dashboard/kpi-card.tsx`)

- Label: `chalk-stamp` style.
- Value: `font-display-data text-3xl` count-up tween 0 → value, 600 ms, `--ease-out-expo`, on first mount only.
- Drop the `.accent-left-gold` (banned) side-stripe; accent state shifts to a 2 px top border in `--color-accent` instead.
- New variant `flame` for streak ≥ 10: small flame SVG inline + `--color-victory` value text + subtle 2 s glow pulse.
- Loading skeleton preserved.

### `ProfileStatCard` (`features/profile/profile-stat-card.tsx`)

- Fix the broken `border-l-heading` accent (since `--color-heading` is now defined as `var(--color-text)`, the existing class becomes a normal chalk left border, which is acceptable for now; we will replace with top-border 2 px in `--color-accent` to align with the KpiCard fix).

### `Toast` (`toast.tsx`)

- Replace `fadeSlideUp` with **slate-drop**: enters from `y=-12px`, 220 ms, `cubic-bezier(0.3, 1.1, 0.4, 1)` (minimal overshoot — the only place we allow any overshoot at all, simulating a plate dropping into its slot).
- Variant `pr` (PR achieved): `bg: var(--color-victory)`, `box-shadow: var(--shadow-victory)`, duration 5 s (vs 2.5 s default), inline chalk-dust SVG particle floating above for the lifetime of the toast.
- **Remove the redundant `Undo` button** inside the toast (header `UNDO` button is canonical).

### `OnlineIndicator` (`online-indicator.tsx`)

- Move from `fixed bottom-4 right-4` floating pill **into the sidebar footer** (renders inside `AppSidebar` below the avatar).
- `bg-green-500` → `bg-online` (via new `--color-online` token).
- Pulse amplitude reduced (opacity 0.7 ↔ 1 instead of 0.4 ↔ 1).

### `ProgressBar` (`progress-bar.tsx`)

- Track: `bg-recess`.
- Fill: `bg-accent` (rust). When `completed === total`: fill swaps to `bg-victory` and shadow gains `--shadow-victory` (program completed seal).
- Trailing-edge glow (`.progress-fill::after`) recolors to match the active fill color.

### `ConfirmDialog` (`confirm-dialog.tsx`)

- Backdrop: `bg-black/72 backdrop-blur-md` (was `/60 backdrop-blur-sm`). This is dimming, not decorative glass — keeps within the impeccable "no glassmorphism as decorative default" rule.
- Modal enter keyframe: add `scale(0.98 → 1)` alongside the existing opacity fade. 180 ms enter, 140 ms exit.
- Border `1.5px`, `--shadow-elevated`.

## Sidebar (`components/layout/app-sidebar.tsx`)

- **Desktop (lg+)**: width fixed at **224 px**, always expanded. Remove `onMouseEnter` / `onMouseLeave` width transition. Icon (24 px) + chalk-stamp label below.
- **Mobile (< lg)**: existing `motion.aside` drawer kept as-is.
- Active state — **no side-stripe** (one of the impeccable bans). Replace with: full-width inset `bg-surface-2` block + 4 × 4 px `--color-accent` dot pinned 8 px from the left edge.
- Footer: avatar (current 48 px) + name (or initial) + email small + `OnlineIndicator` pill inline.
- Remove dead exports `AnalyticsIcon` and `DashboardIcon` from `sidebar-icons.tsx`.

## Dashboard `/app` rebuild

### Component tree (new)

```
HomePage (features/home/home-page.tsx — kept as route entry, body replaced)
└── DashboardShell (new — composes the layout)
    ├── NextSetHero            ← the only thing that asks for an action
    ├── KpiStripBrutalist      ← Racha, Sesiones, PR esta semana
    ├── WeekHeatmap            ← 12 columns × 7 rows of "plate" cells
    ├── DashboardSplit
    │   ├── PrRoadCard         ← closest lift to PR, ETA, progress
    │   └── MentorPill         ← rotating tip from stage-specific copy
    └── RecentSessionsList     ← real sessions; chalk empty state when none
```

All new components live in `apps/frontend/web/src/features/dashboard/` (folder may exist already for `kpi-card.tsx` — co-locate).

### `NextSetHero`

- Inputs (props): `programInstance`, `nextWorkout` (computed via existing GZCLP / 5-3-1 domain helpers in `@gzclp/domain`).
- Layout:
  ```
  ╔════════════════════════════════════════════════════════════╗
  ║ HOY · DÍA {n}/{total} · {weekLabel} · {focusLifts}         ║   ← chalk-stamp meta
  ║                                                            ║
  ║         PRÓXIMA SERIE                                      ║   ← chalk-stamp
  ║         {weight} kg × {reps}                               ║   ← Bebas Neue 5xl
  ║         first work set / amrap / warmup                    ║   ← label
  ║                                                            ║
  ║         {nExercises} ejercicios · ~{etaMinutes} min        ║   ← label
  ║                                                            ║
  ║  [▶  ENTRAR AL HIERRO]      [hoy no]                       ║   ← Buttons
  ║                                                            ║
  ║  ─── última: {lastWeight}×{lastReps} · +{delta} desde inicio
  ╚════════════════════════════════════════════════════════════╝
  ```
- Empty state (no program selected): full-width hero "ELIGE TU FORJA" + chalk anvil SVG + rust CTA → `/app/programs`.
- Empty state (program selected, zero workouts): NextSetHero renders day 1 with copy "DÍA UNO. EL PESO NO SE LEVANTA SOLO."
- Hover: `translateY(-2px)` 180 ms `--ease-out-expo`.

### `KpiStripBrutalist`

- 3 columns (lg) / 1 column stacked (sm).
- Each card uses the new `KpiCard` with `chalk-stamp` label + Bebas Neue value + count-up tween.
- KPIs (same data as today + one new):
  1. **RACHA** — current consecutive-days streak. Variant `flame` when ≥ 10.
  2. **SESIONES** — total completed workouts in active program.
  3. **PR ESTA SEMANA** — most recent personal record (lift name + weight), or "—" if none. Background tinted `--color-victory-bg` (3% opacity overlay) when present.

### `WeekHeatmap`

- 12 columns (oldest → newest, left → right) × 7 rows (L M X J V S D).
- Cell visual: square with 1 px `--color-rule` border. Empty = transparent. Partial workout = `--color-accent` at 30% alpha. Full workout = `--color-accent` solid. Today highlighted with a 1 px `--color-text` outer ring.
- Width: full row at desktop, horizontal-scroll on mobile.
- Mount: stagger reveal column-by-column, 40 ms × 12 columns = 480 ms total.
- Click on a cell → `/app/tracker?day={n}` (preserves existing tracker deep-link semantics if any; otherwise no-op).

### `PrRoadCard`

- Inputs: nearest lift to a personal record from the active program (computed client-side from workout history).
- Layout: lift name + current best + PR target + delta + ETA (estimated sessions) + horizontal `ProgressBar`.
- Empty state: card replaces self with "AÚN NO HAY DATOS PARA CALCULAR PR" + reduced opacity.

### `MentorPill`

- Reuses the copy library from `features/home/home-mentor-widget.tsx` (rotate tips relevant to the program's current stage).
- Auto-rotates every 12 s; `next →` button to advance manually.
- Always visible on the dashboard (no dismiss). The dismissible nudge widget elsewhere is unaffected.

### `RecentSessionsList`

- Shows last 5 completed sessions: `{date} · D{n} · {liftSummary}`.
- Empty: chalk-style copy "AÚN NO HAY ENTRENAMIENTOS. DÍA UNO TE ESPERA." + faint chalk-bar SVG.

### Page entry motion

- Wrap the new tree in the existing `StaggerContainer` + `StaggerItem` primitives from `lib/motion-primitives.tsx`.
- Stagger interval: 60 ms × 6 items = ~360 ms total. `--ease-out-expo`.
- `prefers-reduced-motion`: all reveals collapse to instant (existing blanket rule already covers this).

## Onboarding — keyboard shortcuts overlay (`/app/tracker`)

- New component: `features/tracker/shortcuts-overlay.tsx`.
- Triggered on tracker mount when `localStorage['gr-shortcuts-seen-v1']` is unset.
- Modal-style overlay (uses existing `ConfirmDialog` shell or a thin custom one — TBD in implementation, decide based on focus-trap reuse).
- Content:

  ```
  ATAJOS DE TECLADO
  ─────────────────

  [S]    éxito
  [F]    fallo
  [←]    serie anterior
  [→]    serie siguiente
  [U]    deshacer último

  [ENTENDIDO]
  ```

- On dismiss: `localStorage.setItem('gr-shortcuts-seen-v1', '1')`.
- The existing inline `[S] éxito [F] fallo [U] deshacer` row in the tracker stays as a permanent reinforcement.

## Cleanup

- Remove `.accent-left-gold`, `.accent-left-muted`, `.card-glow-gold` from `globals.css`.
- Replace inline `style={{ backgroundImage: 'linear-gradient(...)' }}` in `program-app.tsx:39` with a named utility class or remove it (the gradient is barely perceptible and adds maintenance cost).
- Replace inline `style={{ textShadow: ... }}` in `profile-page.tsx:280,311` with a named utility class.
- Replace every `text-white` on `bg-accent` (7 call sites — `sw-update-prompt.tsx`, `providers.tsx`, `route-error-fallback.tsx`, `program-app.tsx`, `language-selector.tsx`, `program-preview-page.tsx`, `stage-tag.tsx`) with `text-on-accent` (chalk on dark recess against rust → WCAG AA confirmed).
- Remove dead exports `AnalyticsIcon`, `DashboardIcon` from `sidebar-icons.tsx`.

## Files touched (estimated)

```
apps/frontend/web/src/styles/globals.css                              (tokens, utilities)
apps/frontend/web/src/components/button.tsx                           (variants, press-down)
apps/frontend/web/src/components/dashboard-card.tsx                   (interactive prop, header)
apps/frontend/web/src/components/toast.tsx                            (slate-drop, pr variant)
apps/frontend/web/src/components/online-indicator.tsx                 (token, moved)
apps/frontend/web/src/components/progress-bar.tsx                     (victory state)
apps/frontend/web/src/components/confirm-dialog.tsx                   (backdrop, motion)
apps/frontend/web/src/components/layout/app-sidebar.tsx               (fixed expanded, footer)
apps/frontend/web/src/components/layout/sidebar-icons.tsx             (dead-export cleanup)

apps/frontend/web/src/features/dashboard/kpi-card.tsx                 (variants, motion)
apps/frontend/web/src/features/dashboard/next-set-hero.tsx            (NEW)
apps/frontend/web/src/features/dashboard/kpi-strip-brutalist.tsx      (NEW)
apps/frontend/web/src/features/dashboard/week-heatmap.tsx             (NEW)
apps/frontend/web/src/features/dashboard/dashboard-split.tsx          (NEW)
apps/frontend/web/src/features/dashboard/pr-road-card.tsx             (NEW)
apps/frontend/web/src/features/dashboard/mentor-pill.tsx              (NEW)
apps/frontend/web/src/features/dashboard/recent-sessions-list.tsx     (NEW)
apps/frontend/web/src/features/dashboard/dashboard-shell.tsx          (NEW)
apps/frontend/web/src/features/home/home-page.tsx                     (body replaced)
apps/frontend/web/src/features/home/home-empty-state.tsx              (chalk styling)
apps/frontend/web/src/features/profile/profile-stat-card.tsx          (accent top-border fix)
apps/frontend/web/src/features/tracker/shortcuts-overlay.tsx          (NEW)
apps/frontend/web/src/features/tracker/program-app.tsx                (mount overlay, inline-style cleanup)
apps/frontend/web/src/features/profile/profile-page.tsx               (inline-style cleanup)

apps/frontend/web/src/features/sw-update-prompt.tsx                   (text-on-accent)
apps/frontend/web/src/features/providers.tsx                          (text-on-accent)
apps/frontend/web/src/components/route-error-fallback.tsx             (text-on-accent)
apps/frontend/web/src/features/language-selector.tsx                  (text-on-accent)
apps/frontend/web/src/features/program-preview-page.tsx               (text-on-accent)
apps/frontend/web/src/features/tracker/stage-tag.tsx                  (text-on-accent if applicable)
```

Estimated total: 12–18 files materially changed + 8 new files. ~600–900 LOC net.

## Verification

| Check               | When       | Command                                                                                                                                                                                  |
| ------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript          | per commit | `bun run --filter web typecheck`                                                                                                                                                         |
| ESLint              | per commit | `bun run --filter web lint`                                                                                                                                                              |
| Vitest              | pre-PR     | `bun run --filter web test`                                                                                                                                                              |
| Build               | pre-PR     | `bun run --filter web build` (Tailwind v4 token resolution)                                                                                                                              |
| Playwright e2e      | pre-PR     | `bun run e2e`                                                                                                                                                                            |
| Lefthook pre-commit | automatic  | typecheck + lint + format                                                                                                                                                                |
| Lefthook pre-push   | automatic  | test + build + api-types-drift                                                                                                                                                           |
| Manual visual       | pre-PR     | Local dev `bun run dev:api` + `bun run dev:web`; screenshot `/app`, `/app/programs`, `/app/tracker`, `/app/profile` at 1440 and 375; diff against pre-PR screenshots in `/tmp/gr-audit/` |
| WCAG contrast       | pre-PR     | Visual + token math: chalk (`oklch 0.94 L*`) on recess (`oklch 0.10 L*`) ≥ 12:1; on-accent (`oklch 0.10`) on rust (`oklch 0.62`) ≥ 4.5:1                                                 |

No visual regression snapshot infra exists in this repo; verification is manual screenshot comparison.

## Rollout

- Branch: `feat/web-ui-revival-brutalist`.
- Single PR. No DB / API / migration changes; pure frontend.
- Reversibility: revert the PR to roll back cleanly.
- Landing (`/`, `landing/*`) intentionally untouched (recent conversion redesign `6919244` should not regress).

## Open questions / decisions left to the implementation plan

1. Concrete-noise SVG — generate via inline `<feTurbulence>` or import a static `.svg` asset under `public/`? Lean inline data-URI for zero extra HTTP request; revisit if base-64 size noticeably bloats CSS.
2. Shortcuts overlay — wrap the existing `ConfirmDialog` (focus trap already done) or build a dedicated `<dialog>` element? Lean reuse.
3. PR-road computation — pure client-side over existing `program_instances.results` or new selector hook? Lean a new `usePrRoad(instance)` selector in `features/dashboard/`.

These are tactical choices the implementation plan will resolve. They do not block design approval.
