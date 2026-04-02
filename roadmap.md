# Gravity Room — Roadmap

> Last updated: 2026-04-02.

## Status: All phases complete (A–E + D)

Phases A–E and D all complete. Phase D finished with profile editing,
kg/lbs unit preference, achievement badges, card hover effects, and
program selector polish.

---

## Phase E — Dashboard Redesign V2

### Objective

Restructure the post-login experience so users arrive at a clean welcome
page instead of a data-heavy dashboard. Introduce an icon-based
collapsible sidebar for navigation. Separate the monolithic overview
page into focused sections: home, dashboard, and program catalog.

### Current State

The overview page (`/app`, 456 LOC) dumps everything onto a single
scroll: KPI cards, active program, performance charts, plateau alerts,
load recommendations, program catalog by level, and custom programs.
The sidebar uses text-only labels with no icons. There is no "welcome"
or orientation experience — users go straight into metrics, which is
disorienting for new or empty-state users.

### Design Reference

GCP Metrics Explorer layout pattern — **adapted, not copied**:

- Narrow icon rail sidebar (collapsed) that expands to icon + text
- Clean content areas with focused purpose per page
- Tab-based or sectioned navigation within pages
- Configuration/controls separated from visualization

### Constraints

- Bottom-up: primitives first, then composition, then routing
- Each step leaves the app fully functional (no broken intermediate states)
- All text remains in Spanish
- Dark brown/gold theme preserved (existing CSS vars)
- No new backend endpoints
- Keep all files under 500 LOC
- Branch: `feat/dashboard-redesign-v2`

### Workstreams

1. **Sidebar primitives** — Icons, collapsed state, CSS tokens
2. **Sidebar refactor** — Icon rail + expanded mode
3. **Welcome home page** — Brief app intro, quick-start, section overview
4. **Content separation** — Split overview into dashboard + programs
5. **Route restructuring** — New routes for home, dashboard, programs
6. **Polish & verification** — Transitions, mobile, consistency

---

### E.1 — Sidebar Primitives (CSS + Icons)

Add the design tokens and icon components needed before touching
any layout code.

- [x] Add collapsed sidebar CSS tokens to `globals.css`:
      `--sidebar-width-collapsed: 64px`, `--sidebar-transition: 200ms ease`
- [x] Add sidebar collapse animation keyframes
- [x] Create `src/components/layout/sidebar-icons.tsx` — SVG icon
      components for each nav item: - Home (house/grid icon) - Dashboard (bar chart icon) - Tracker (dumbbell/target icon) - Programas (book/catalog icon) - Perfil (user icon) - Analíticas (line chart icon)
- [x] All icons: 20×20, `currentColor`, `aria-hidden="true"`,
      consistent stroke width

**Files affected:**
| File | Change |
|------|--------|
| `apps/web/src/styles/globals.css` | Add collapsed sidebar tokens |
| `apps/web/src/components/layout/sidebar-icons.tsx` | New — nav icons |

---

### E.2 — Collapsible Sidebar

Refactor `app-sidebar.tsx` to support two modes: collapsed (icon rail,
64px) and expanded (icon + text, 240px). Desktop users can toggle.
Mobile stays as overlay drawer.

- [x] Add `isCollapsed` state to sidebar, persisted in `localStorage`
- [x] Collapsed mode: show only icons centered, with tooltips on hover
- [x] Expanded mode: icon + text label (current behavior + icons)
- [x] Add collapse/expand toggle button at sidebar bottom (chevron icon)
- [x] Update `app-layout.tsx` to read collapsed state and adjust
      `main` content offset accordingly
- [x] Logo section: collapsed = logo icon only; expanded = icon + "Gravity Room"
- [x] User section: collapsed = avatar only; expanded = full dropdown
- [x] Transition: smooth width animation (200ms ease)
- [x] Mobile: no change (overlay drawer always expanded)
- [x] Add nav items for new routes: "Inicio", "Dashboard", "Tracker",
      "Programas", "Perfil", "Analíticas"

**Files affected:**
| File | Change |
|------|--------|
| `apps/web/src/components/layout/app-sidebar.tsx` | Collapse logic, icons, new nav items |
| `apps/web/src/components/layout/app-layout.tsx` | Read collapsed state, adjust offset |
| `apps/web/src/components/layout/sidebar-trigger.tsx` | Minor — pass through collapse state |

---

### E.3 — Welcome Home Page

Create the new landing page for authenticated users at `/app`. This is
where users arrive after login — clean, brief, encouraging.

- [x] Create `src/components/dashboard/home-page.tsx`: - **Welcome header**: "Bienvenido a Gravity Room" + user name (if available) - **App summary**: 2–3 lines explaining the app (strength training
      tracker with intelligent progression) - **Quick-start cards** (2–3 cards): - "Continuar Entrenamiento" → links to tracker (if active program) - "Elegir un Programa" → links to programs page - "Ver tu Progreso" → links to dashboard/analytics - **Active program mini-status** (if exists): program name, progress
      bar, "Continuar" CTA — compact, not the full card - **Section overview**: brief description of what each sidebar
      section offers (Dashboard, Tracker, Programas, Analíticas)
- [x] Home page must look good with 0 data (new user) and with
      active data (returning user)
- [x] Skeleton loading for active program check
- [x] Keep under 200 LOC — this is intentionally lightweight

**Files affected:**
| File | Change |
|------|--------|
| `apps/web/src/components/dashboard/home-page.tsx` | New — welcome page |

---

### E.4 — Dashboard Focus Page

Extract the data-focused content from the current overview page into
a dedicated dashboard page. This page is for users who want to see
their performance metrics.

- [x] Create `src/components/dashboard/dashboard-page.tsx`: - KPI summary row (reuse `KpiSummary` — extract from overview) - Active program card (reuse `ActiveProgramCard`) - Performance panel: volume trend + frequency heatmap - Plateau alerts section - Load recommendations section
- [x] Move `KpiSummary` to its own file: `src/components/dashboard/kpi-summary.tsx`
- [x] `dashboard-page.tsx` should be ≤400 LOC (all widgets are already
      separate components, this is composition only)
- [x] No program catalog here — that moves to programs page

**Files affected:**
| File | Change |
|------|--------|
| `apps/web/src/components/dashboard/dashboard-page.tsx` | New — focused dashboard |
| `apps/web/src/components/dashboard/kpi-summary.tsx` | New — extracted from overview |
| `apps/web/src/components/dashboard/overview-page.tsx` | Will be replaced in E.6 |

---

### E.5 — Programs Catalog Page

Extract the program catalog + custom programs from the overview page
into a dedicated page accessible from the sidebar.

- [x] Create `src/components/dashboard/programs-page.tsx`: - Header: "Programas" + subtitle - Program catalog grouped by level (Principiante, Intermedio, Avanzado) - "Mis Programas Personalizados" section - DefinitionWizard integration - Start program / customize actions
- [x] Reuse existing `ProgramCard`, `MyDefinitionsPanel`, `DefinitionWizard`
- [x] ≤300 LOC (all card components already exist)

**Files affected:**
| File | Change |
|------|--------|
| `apps/web/src/components/dashboard/programs-page.tsx` | New — catalog page |

---

### E.6 — Route Restructuring

Wire the new pages into the router. Update sidebar nav items. Remove
or redirect the old overview page.

- [x] Update `main.tsx` routes under `/app`: - `index` → `HomePage` (welcome — E.3) - `dashboard` → `DashboardPage` (metrics — E.4) - `tracker/:programId?` → `TrackerPage` (unchanged) - `programs` → `ProgramsPage` (catalog — E.5) - `profile` → `ProfilePage` (unchanged) - `analytics` → `AnalyticsPage` (unchanged)
- [x] Update `NAV_ITEMS` in sidebar:
      `    /app          → Inicio (home icon)
/app/dashboard → Dashboard (chart icon)
/app/tracker   → Tracker (dumbbell icon)
/app/programs  → Programas (book icon)
/app/profile   → Perfil (user icon)
/app/analytics → Analíticas (line chart icon)`
- [x] Update `ROUTE_LABELS` in `app-layout.tsx`
- [x] Add lazy imports + suspense fallbacks for new pages
- [x] Remove or archive `overview-page.tsx` once all content is migrated
- [x] Verify all internal links and `navigate()` calls still resolve: - `handleStartProgram` → `/app/tracker/{id}` - "Continuar Entrenamiento" → `/app/tracker/{id}` - Dashboard links in home page → `/app/dashboard`

**Files affected:**
| File | Change |
|------|--------|
| `apps/web/src/main.tsx` | New routes, new lazy imports |
| `apps/web/src/components/layout/app-sidebar.tsx` | Updated NAV_ITEMS |
| `apps/web/src/components/layout/app-layout.tsx` | Updated ROUTE_LABELS |
| `apps/web/src/components/dashboard/overview-page.tsx` | Remove after migration |

---

### E.7 — Polish & Transitions

- [x] Sidebar collapse/expand animation smoothness check
- [x] Tooltip hover delay (300ms) to avoid flickering
- [x] Active nav item highlight consistency in both sidebar modes
- [x] Home page card hover effects (consistent with dashboard cards)
- [x] Mobile sidebar: ensure all 6 nav items fit without scroll
- [x] Mobile home page: cards stack to single column
- [x] Skeleton loading states for home page and programs page
- [x] Empty state for dashboard when no active program ("Elige un
      programa para ver tus métricas" + CTA to programs page)

**Files affected:**
| File | Change |
|------|--------|
| `apps/web/src/styles/globals.css` | Transition polish, tooltip styles |
| Various new components | Minor adjustments |

---

### E.8 — Verification

- [x] `bun run typecheck && bun run lint` — no regressions
- [x] `bun run test` — all existing tests pass
- [x] Route: `/app` shows welcome home page
- [x] Route: `/app/dashboard` shows KPI metrics + active program + analytics
- [x] Route: `/app/programs` shows full catalog by level + custom programs
- [x] Route: `/app/tracker/gzclp` still works
- [x] Route: `/app/profile` still works
- [x] Route: `/app/analytics` still works
- [x] Sidebar: collapsed mode shows icon rail (64px)
- [x] Sidebar: expanded mode shows icon + text (240px)
- [x] Sidebar: collapse toggle persists across page loads
- [x] Sidebar: tooltips visible on collapsed hover
- [x] Mobile 375px: overlay drawer works, all nav items visible
- [x] Desktop 1280px: sidebar + content layout correct
- [x] New user (0 data): home page shows welcome + quick-start
- [x] Active user: home page shows program mini-status + CTAs
- [x] No broken `navigate()` calls or dead links
- [x] All files under 500 LOC

### Execution Order

```
E.1 (sidebar primitives) ← CSS + icons, no behavior change
  ↓
E.2 (collapsible sidebar) ← depends on E.1 icons
  ↓
E.3 (home page) + E.4 (dashboard page) + E.5 (programs page) ← parallel, independent
  ↓
E.6 (route restructuring) ← depends on E.3–E.5
  ↓
E.7 (polish) ← depends on E.6
  ↓
E.8 (verification) ← final gate
```

**Checkpoint:** Pause after E.2 for sidebar review. Pause after E.6
for route review before polish pass.

### Risks

- **Icon clarity:** Fitness app icons (dumbbell, barbell) may not be
  universally recognized. Mitigation: tooltips always visible on collapsed
  mode, and text visible in expanded mode.
- **Route migration:** Changing `/app` from overview to home page may
  break bookmarks or "Continuar Entrenamiento" deep links from active
  program cards. Mitigation: audit all `navigate()` calls in E.6.
- **Overview page removal:** 456 LOC of logic needs to be correctly
  redistributed. Mitigation: extract before deleting, verify each
  section works independently.
- **Sidebar width transition:** CSS transition on `width` can cause
  layout jank on slower devices. Mitigation: use `transform` for
  animation if `width` transition is janky.

### Open Questions

1. **Collapsed sidebar default:** Should sidebar start collapsed or
   expanded on first visit? (Recommendation: expanded, user toggles)
2. **Home page frequency:** Should returning users always see the home
   page, or redirect to dashboard if they have an active program?
3. **Program catalog depth:** Should the programs page include
   detailed program preview, or keep it card-grid only?

---

## Phase D — Profile Page Improvements (Done)

### Objective

Fix broken text rendering, improve UX for empty/new-user states, polish
layout consistency, and add high-value features to the profile page.

### Current State

The profile page (`/app/profile`) has a working data pipeline — it
fetches programs, computes stats, renders charts. But the UI has:

- **Critical text bug:** Unicode escape sequences inside JSX string
  attributes render as literal `{'\u00ED'}` instead of accented
  characters. Visible in every card header and several labels.
- **Sparse empty states:** A user with 0 workouts sees "0" everywhere
  with no guidance or encouragement.
- **Uneven card heights:** The 3-column grid has cards of wildly
  different heights, making the layout feel unfinished.
- **File size:** `profile-page.tsx` is 659 LOC (limit is 500).

### Constraints

- All text is hardcoded Spanish (no i18n system). Fixes use direct
  UTF-8 characters, not a new translation layer.
- Bebas Neue (display font) must support `ÁÉÍÓÚ` glyphs — verify
  after fixing the escape bug.
- No new API endpoints — all improvements use existing data.
- Keep `profile-page.tsx` under 500 LOC after the split.

### Workstreams

1. **Bug fixes** — Unicode rendering, font glyph verification
2. **UX polish** — Empty states, layout, card consistency, interactions
3. **Component split** — Extract sections to stay under 500 LOC
4. **Features** — Profile editing, unit preference, achievements

---

### D.1 — Fix Unicode Escape Bug (Critical)

Every `{'\u00XX'}` inside a JSX **string attribute** (`title="..."`,
`label="..."`) renders as literal text. Replace with direct UTF-8
characters.

- [x] `profile-page.tsx:417` — `title="Estad{'\u00ED'}sticas"` → `title="Estadísticas"`
- [x] `profile-page.tsx:429` — `label="Tasa de {'\u00C9'}xito"` → `label="Tasa de Éxito"`
- [x] `profile-page.tsx:461` — `label="R{'\u00E9'}cord"` → `label="Récord"`
- [x] `profile-page.tsx:481` — `label="Tasa de {'\u00C9'}xito"` → `label="Tasa de Éxito"`
- [x] `profile-page.tsx:501` — `title="R{'\u00E9'}cords Personales (T1)"` → `title="Récords Personales (T1)"`
- [x] `profile-page.tsx:567` — `title="Progresi{'\u00F3'}n de Peso"` → `title="Progresión de Peso"`
- [x] Grep entire codebase for `{'\u00` inside string attributes — fix any other occurrences
- [x] Verify Bebas Neue renders `ÁÉÍÓÚÑ` correctly at `text-transform: uppercase`

### D.2 — UX Polish: Empty & Low-Data States

When a user has 0 workouts or minimal data, the profile should
encourage action rather than display walls of zeros.

- [x] Banner: replace "Entrenamiento 0 de 200" + "0% / 0%" with a
      motivational empty state ("Tu primer entrenamiento te espera")
      and a CTA to the tracker
- [x] Stats card: when all values are 0, show a single encouraging
      message instead of a grid of zeros
- [x] Records card: hide entirely when no PRs exist (currently shows
      empty grid)
- [x] Charts section: hide when no workout data exists
- [x] Lifetime volume: hide the "..." loading state when user has only
      one program (the card is irrelevant)

### D.3 — Layout & Visual Polish

- [x] Equalize card heights in the 3-column grid using CSS `grid-auto-rows`
      or `align-items: start` (prevent stretching of short cards)
- [x] Add subtle hover effect (`shadow-card-hover`, existing CSS var)
      to interactive cards
- [x] Improve program selector: add program status icon, better
      styling to match the dark theme
- [x] Move "Eliminar cuenta" to a collapsible "Zona peligrosa" section
      at the bottom — destructive action is too prominent in the
      account card
- [x] Avatar fallback: use user initials (first + last) instead of
      single letter, with a distinct background gradient (currently
      looks like the Gravity Room logo)
- [x] Add rounded corners to progress bars for consistency with the
      badge pill styles
- [x] Consistent spacing between full-width sections (charts, history)

### D.4 — Component Split (Under 500 LOC)

`profile-page.tsx` is 659 LOC. Extract sections into focused components.

- [x] `profile-banner.tsx` — Program banner with status badge, metrics,
      progress bar (~60 LOC)
- [x] `profile-account-card.tsx` — Avatar, user info, delete link (~60 LOC)
- [x] `profile-stats-grid.tsx` — Quick stats + records + 1RM cards (~80 LOC)
- [x] `profile-charts-section.tsx` — Weight progression charts (~40 LOC)
- [x] `profile-history.tsx` — Training history list (~50 LOC)
- [x] Verify `profile-page.tsx` drops below 500 LOC after extraction
- [x] No behavior changes — pure extraction refactor

### D.5 — Feature: Profile Editing

- [x] Add inline-editable display name (click to edit, Enter to save)
- [x] Wire to existing `PATCH /auth/me` endpoint (`updateProfile`)
- [x] Show toast on success/error
- [x] Persist optimistically via `updateUser` context method

### D.6 — Feature: Unit Preference (kg / lbs)

- [x] Add kg/lbs toggle to the account card
- [x] Store preference in `localStorage` (no backend change)
- [x] Create `useUnitPreference()` hook
- [x] Apply conversion factor (×2.20462) to all weight displays in
      profile stats, records, charts, and volume
- [x] Show unit suffix dynamically

### D.7 — Feature: Achievement Badges

- [x] Define badge criteria: - "Primer Entrenamiento" — complete 1 workout - "Racha de 5" — 5 consecutive workouts - "100 kg Club" — any T1 exercise reaches 100 kg - "Programa Completo" — finish a full program - "Volumen 10K" — lifetime volume exceeds 10,000 kg
- [x] Create `profile-badges.tsx` — horizontal badge strip with
      locked/unlocked states
- [x] Derive badges from existing `profileData` — no new API
- [x] Place between the banner and the stats grid

### D.8 — Verification

- [x] `bun run typecheck && bun run lint` — no regressions
- [x] `bun run test` — all existing tests pass (483/483)
- [x] Visual: all card headers show proper accented characters
      (ESTADÍSTICAS, RÉCORDS, PROGRESIÓN)
- [x] Visual: empty-state profile (0 workouts) looks clean, no zeros
- [x] Visual: populated profile renders all sections correctly
- [x] `profile-page.tsx` is under 500 LOC (343 LOC)
- [x] Mobile 375px: cards stack to single column, no overflow
- [x] Desktop 1280px: 3-column grid, even card heights

### Files Likely Affected

| File                                                 | Change                            |
| ---------------------------------------------------- | --------------------------------- |
| `apps/web/src/components/profile-page.tsx`           | Unicode fix, empty states, split  |
| `apps/web/src/components/profile-banner.tsx`         | New — extracted from profile-page |
| `apps/web/src/components/profile-account-card.tsx`   | New — extracted from profile-page |
| `apps/web/src/components/profile-stats-grid.tsx`     | New — extracted from profile-page |
| `apps/web/src/components/profile-charts-section.tsx` | New — extracted from profile-page |
| `apps/web/src/components/profile-history.tsx`        | New — extracted from profile-page |
| `apps/web/src/components/profile-badges.tsx`         | New — achievement badges          |
| `apps/web/src/components/profile-stat-card.tsx`      | Minor — hover effect              |
| `apps/web/src/components/dashboard-card.tsx`         | Minor — hover effect              |
| `apps/web/src/hooks/use-unit-preference.ts`          | New — kg/lbs toggle               |
| `apps/web/src/styles/globals.css`                    | Minor — grid alignment tokens     |

### Risks

- **Bebas Neue glyph support:** If the font lacks `ÍÉÓÁÚ`, accented
  headers will fall back to sans-serif. Mitigation: test after D.1,
  swap to Oswald or Barlow Condensed if needed.
- **Component split regressions:** Extracting components may break
  memoization chains (`useMemo` deps on parent state). Mitigation:
  pass computed data as props, not raw queries.
- **Unit conversion precision:** Floating point `×2.20462` can produce
  ugly decimals. Mitigation: round to 1 decimal place everywhere.

### Execution Order

```
D.1 (unicode fix) ← critical, do first
  ↓
D.4 (component split) ← reduces file size, enables parallel work
  ↓
D.2 (empty states) + D.3 (layout polish) ← can be parallel
  ↓
D.5 (profile editing) + D.6 (unit pref) + D.7 (badges) ← independent features
  ↓
D.8 (verification)
```

**Checkpoint:** Pause after D.1 + D.4 for review before starting
feature work (D.5–D.7).

### Open Questions

1. **Unit preference scope:** Should kg/lbs apply only to the profile
   page, or globally (tracker, dashboard, analytics)?
2. **Badge design:** Minimal text labels or icon-based badges?
3. **Profile name:** Should it be editable inline or via a modal?

---

## Phase A — Dashboard UI Foundation (Done)

Redesign the layout from header-only to sidebar + nested routes. Introduce
shadcn/ui and Recharts. Replace custom Canvas 2D charts.

### A.1 — Tooling & Primitives

- [x] Install deps: `@radix-ui/react-slot`, `@radix-ui/react-tooltip`,
      `@radix-ui/react-dropdown-menu`, `@radix-ui/react-collapsible`,
      `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `recharts`,
      `clsx`, `tailwind-merge`
- [x] Create `src/lib/cn.ts` — `clsx` + `tailwind-merge` utility
- [x] Create `src/components/ui/` directory with Radix-wrapped primitives
      styled against existing `--color-*` CSS vars:
      `button.tsx`, `card.tsx`, `tooltip.tsx`, `collapsible.tsx`,
      `dropdown-menu.tsx`, `dialog.tsx`, `tabs.tsx`
- [x] Add sidebar tokens to `globals.css` `@theme` block:
      `--color-sidebar`, `--color-sidebar-active`, `--color-sidebar-border`,
      `--sidebar-width` (240px)

### A.2 — Layout & Routing Overhaul

- [x] Create `src/components/layout/app-sidebar.tsx` — collapsible sidebar
      with nav links: Inicio (`/app`), Tracker (`/app/tracker`),
      Perfil (`/app/profile`), Analíticas (`/app/analytics` — Phase B)
- [x] Create `src/components/layout/app-layout.tsx` — sidebar + top bar +
      `<Outlet />` wrapper
- [x] Create `src/components/layout/sidebar-trigger.tsx` — mobile hamburger
- [x] Refactor `main.tsx` routing from flat `{ path: '/app', element: <AppShell /> }`
      to nested routes under `/app` with `<AppLayout>` parent: - `index` → OverviewPage - `tracker/:programId?` → ProgramApp - `profile` → ProfilePage - `analytics` → AnalyticsPage (Phase B)
- [x] Extract AppShell state (`selectedInstanceId`, `selectedProgramId`,
      `pendingProgramId`) into URL params + lightweight TrackerContext
- [x] Remove `app-shell.tsx` — `display:none` toggling replaced by router
- [x] Strip `<AppHeader>` from Dashboard, ProgramApp, ProfilePage — layout
      now owns the top bar
- [x] Mobile: sidebar hidden by default, overlay on hamburger tap.
      `isCollapsed` persisted to `localStorage`

### A.3 — Recharts Migration

- [x] Create `src/components/charts/chart-theme.ts` — reads `--color-chart-*`
      CSS vars via `getComputedStyle` for Recharts theming
- [x] Create `src/components/charts/line-chart.tsx` — Recharts `<LineChart>`
      replacing the 549-LOC Canvas implementation. Features: stage markers,
      success/fail dots, PR markers, deload bands, tooltip
- [x] Create `src/components/charts/bar-chart.tsx` — Recharts `<BarChart>`
      replacing the 181-LOC Canvas VolumeChart. Average reference line
- [x] Update `stats-panel.tsx` to import new Recharts components
- [x] Add `recharts` to `vite.config.ts` `manualChunks`
- [x] Update or remove Canvas chart tests (`line-chart.test.tsx`,
      `volume-chart.test.tsx`)

### A.4 — Dashboard Overview Page

- [x] Create `src/components/dashboard/overview-page.tsx` — KPI cards grid:
      Total Workouts, Current Streak, Active Program %, Total Volume
- [x] Create `src/components/dashboard/kpi-card.tsx` — metric card primitive
- [x] Create `src/components/dashboard/recent-activity.tsx` — last 5 workouts
- [x] Compact volume trend chart (last 30 days)
- [x] All data derived from existing queries — no new backend needed

### A.5 — Verification

- [x] `bun run typecheck && bun run lint && bun run test`
- [x] All routes render: `/app`, `/app/tracker/gzclp`, `/app/profile`
- [x] Browser back/forward works (regression from `display:none` pattern)
- [x] Mobile 375px: sidebar hidden, hamburger visible, full-width content
- [x] Desktop 1280px: sidebar visible, content offset
- [x] Bundle size check: Recharts adds ~120KB gzipped (actual: ~114KB)

#### Critical files

| File                                       | Role                                         |
| ------------------------------------------ | -------------------------------------------- |
| `apps/web/src/main.tsx`                    | Router config — restructure to nested routes |
| `apps/web/src/components/app-shell.tsx`    | Remove — replaced by router                  |
| `apps/web/src/styles/globals.css`          | Theme — add sidebar tokens                   |
| `apps/web/src/components/stats-panel.tsx`  | Replace Canvas imports with Recharts         |
| `apps/web/src/components/line-chart.tsx`   | Remove — replaced by Recharts                |
| `apps/web/src/components/volume-chart.tsx` | Remove — replaced by Recharts                |

---

## Phase B — Python Analytics Service (Done)

Separate Python microservice that reads workout data from Postgres and
writes pre-computed insights for the Go API to serve.

### B.1 — Service Scaffold

- [x] Create `apps/analytics/` — FastAPI service
- [x] `requirements.txt`: fastapi, uvicorn, psycopg[binary] 3.x,
      pandas, scikit-learn, numpy, apscheduler, pydantic
- [x] `Dockerfile` — Python 3.12 multi-stage
- [x] `main.py` — health endpoint + manual `POST /compute` trigger
- [x] `config.py` — `DATABASE_URL` from env
- [x] `db.py` — psycopg3 async connection pool (read-only credentials)
- [x] Add `analytics` service to `docker-compose.yml`

### B.2 — Database Schema

- [x] Migration 00034: `user_insights` table

```sql
CREATE TABLE user_insights (
    id           bigserial PRIMARY KEY,
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    insight_type varchar(50) NOT NULL,
    exercise_id  varchar(100),
    payload      jsonb NOT NULL,
    computed_at  timestamptz NOT NULL DEFAULT NOW(),
    valid_until  timestamptz,
    CONSTRAINT user_insights_unique
      UNIQUE (user_id, insight_type, exercise_id)
);
CREATE INDEX user_insights_user_type_idx
  ON user_insights (user_id, insight_type);
```

Insight types: `volume_trend`, `frequency`, `e1rm_progression`,
`exercise_summary`

### B.3 — Compute Pipelines

- [x] `queries.py` — SQL to extract raw data from `program_instances` +
      `workout_results` + `program_templates`
- [x] `insights/volume.py` — weekly volume trends, slope, direction
- [x] `insights/frequency.py` — sessions/week, streaks, consistency %
- [x] `insights/e1rm.py` — Epley 1RM per exercise over time
- [x] `insights/summary.py` — per-exercise aggregation (sets, reps,
      volume, success rate, RPE avg)
- [x] `compute.py` — orchestrator: for each user, run all pipelines, upsert
- [x] `scheduler.py` — APScheduler cron job (every 6 hours)

### B.4 — Go API Integration

- [x] `apps/go-api/internal/handler/insights.go` —
      `GET /api/insights?types=volume_trend,frequency,...`
- [x] `apps/go-api/internal/service/insights.go` — query `user_insights`
- [x] Register route in `server.go` (requires auth)

### B.5 — Frontend Analytics Page

- [x] `src/components/dashboard/analytics-page.tsx` — main page
- [x] `src/components/dashboard/volume-trend-card.tsx`
- [x] `src/components/dashboard/frequency-card.tsx`
- [x] `src/components/dashboard/e1rm-chart.tsx`
- [x] Add `fetchInsights()` to `api-functions.ts`
- [x] Add `insights` namespace to `query-keys.ts`
- [x] Add "Analíticas" to sidebar nav

### B.6 — Verification

- [x] Python: `GET /health` responds, `POST /compute` populates insights
- [x] Go: `GET /api/insights` returns computed data
- [x] Frontend: analytics page renders charts from real data
- [x] Docker compose: all 3 services start and communicate
- [x] `bun run ci` passes, `go test ./...` passes

---

## Phase C — ML Predictive Features (Done)

Add machine learning models to the Python analytics service. All models
run during the batch compute job and write to `user_insights`.

### C.1 — Plateau Detection

- [x] `ml/plateau.py` — linear regression on weight progression
      (last 8 weeks, min 8 data points)
- [x] Plateau = slope < 0.1 kg/week AND p-value > 0.1
- [x] Confidence = `1 - p_value` (capped 0.95)
- [x] Insight type: `plateau_detection` (per exercise)
- [x] Frontend: `plateau-alert.tsx` — warning card, only shown
      when confidence > 0.6

### C.2 — 1RM Forecasting

- [x] `ml/forecast.py` — linear regression on weekly Epley-1RM series
      (min 6 weeks of data)
- [x] Predict 2-week and 4-week ahead with confidence bands
- [x] R² < 0.5 = low confidence, suppress display
- [x] Insight type: `e1rm_forecast` (per exercise)
- [x] Frontend: `forecast-chart.tsx` — Recharts AreaChart with
      solid line (historical) + dashed (forecast) + confidence band

### C.3 — Load Recommendation

- [x] `ml/recommendation.py` — logistic regression on success probability
- [x] Features: weight, success_rate_at_weight, avg_rpe, volume_last_week,
      days_since_last_session (min 10 sessions with RPE data)
- [x] Predicted success > 70% → recommend increment, else hold
- [x] Fallback without RPE: 3 consecutive successes → increment
- [x] Insight type: `load_recommendation` (per exercise)
- [x] Frontend: `load-recommendation.tsx` — card with recommended weight + confidence badge

### C.4 — Verification

- [x] Unit tests with synthetic data for each ML function
- [x] Plateau detection: flags flat progressions, ignores active ones
- [x] Forecast: within 10% of actual for linear trends
- [x] Recommendation: defaults to hold when data insufficient
- [x] Full pipeline: Python → Postgres → Go API → Frontend
- [x] ML cards gracefully hidden when min data thresholds not met

---

## Backlog — Existing Phases (Pending)

Retained from previous roadmap. Can be interleaved with dashboard work.

### CI/CD Optimization ✓

- [x] Docker build layer caching (BuildKit) — `go-ci.yml` uses `docker/build-push-action` with `type=gha` cache
- [x] Fix CI health check addresses — add analytics service (port 8001) to `ci.yml` deploy verification
- [x] Bun dependency caching — `_go-integration.yml` caches `~/.bun/install/cache` keyed on `bun.lockb`

### Observability ✓

- [x] Frontend error capture via Sentry — added `captureError(unknown)` helper to `sentry.ts`; replaced all 6 `console.error` calls in `setup-form.tsx`, `profile-page.tsx`, `use-program.ts`

### DX ✓

- [x] `docker-compose.dev.yml` — local dev without external networks

---

## Completed

### Service Integration Tests ✓

- [x] `service/programs.go` — 22 integration tests (CREATE, LIST/paginate, GET, UPDATE, UPDATE METADATA, DELETE, EXPORT, IMPORT, round-trip, wrong-user ownership checks). Skip gracefully when `TEST_DB_URL` unset.

### Security Audit ✓

Rate limiting already fully applied to all 30 endpoints (auth, programs, results, catalog, exercises, definitions, insights).

### Dead Code Cleanup ✓

- [x] Trash `scripts/export-definitions.ts`
- [x] Fix `.env` stale comments

### Go API Migration (Phases 1–5) ✓

All 30 HTTP endpoints ported with full parity.

### Handler Coverage Improvement ✓

- [x] Handler validation tests (46 tests)
- [x] Handler integration tests (27 tests)
- [x] Add `coverage` target to Makefile

---

## Decided / Won't Do

| Item                       | Decision  | Reason                                                                  |
| -------------------------- | --------- | ----------------------------------------------------------------------- |
| GraphQL                    | Won't do  | REST sufficient                                                         |
| WebSocket                  | Won't do  | Polling acceptable                                                      |
| ORM (GORM/ent)             | Won't do  | Raw SQL via pgx intentional                                             |
| Dash/Streamlit             | Won't do  | React SPA better for production consumer UX                             |
| Plotly.js                  | Won't do  | 3MB bundle, Recharts covers all needs                                   |
| Replace Go API with Python | Won't do  | Go handles auth/CRUD/engine well, Python adds analytics layer alongside |
| React `act()` warnings     | Won't fix | bun:test + happy-dom limitation                                         |

---

## Reference

| Resource             | Path                                       |
| -------------------- | ------------------------------------------ |
| Go API source        | `apps/go-api/`                             |
| Web app              | `apps/web/`                                |
| Python analytics     | `apps/analytics/` (Phase B)                |
| Shared lib (inlined) | `apps/web/src/lib/shared/`                 |
| Go CI workflow       | `.github/workflows/go-ci.yml`              |
| Goose migrations     | `apps/go-api/internal/migrate/migrations/` |
| Dockerfile (API)     | `Dockerfile.api`                           |
| Theme / CSS vars     | `apps/web/src/styles/globals.css`          |
