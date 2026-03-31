# Gravity Room — Roadmap

> Last updated: 2026-03-31.

## Status: Backlog

Phases A, B, C complete. Current focus: backlog items (service integration tests, security audit, CI/CD optimization, Sentry, dev compose).

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

### Service Integration Tests

Handler coverage at 43.5%, service at 7%.

- [ ] `service/programs.go` main flow integration tests

### Security Audit

Rate limiting only enforced on `auth.google`.

- [ ] Audit rate limit coverage — profile updates, program creation,
      custom definition uploads
- [ ] Apply rate limiting to all write endpoints

### CI/CD Optimization

- [ ] Docker build layer caching (BuildKit)
- [ ] Fix CI health check addresses
- [ ] Bun dependency caching

### Observability

- [ ] Frontend error capture via Sentry — replace `console.error` calls

### DX

- [ ] `docker-compose.dev.yml` — local dev without external networks

---

## Completed

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
