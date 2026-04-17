# Tasks: Localize Home Route (i18n)

**Change**: i18n-home-localization
**Strict TDD**: enabled — RED test → implementation → GREEN for every behavioral task.

---

## Phase 0 — Preconditions

- [x] 0.1 Confirm the four Home component files exist at the paths the design specifies:
      `apps/web/src/features/home/home-page.tsx`,
      `apps/web/src/features/home/home-header.tsx`,
      `apps/web/src/features/home/home-kpi-strip.tsx`,
      `apps/web/src/features/home/home-empty-state.tsx`.
      **DoD**: All four paths resolve via `ls`; no unexpected renames.

- [x] 0.2 Confirm `format-days-ago.ts` does NOT yet exist at
      `apps/web/src/features/home/format-days-ago.ts` (new file per design).
      **DoD**: File is absent pre-implementation; path recorded for Phase 3.

- [x] 0.3 Confirm i18n wiring: `apps/web/src/lib/i18n/index.ts` has `fallbackLng: 'es'` and
      `apps/web/test/setup.ts` initializes with `lng: 'es'` and no per-test `changeLanguage` reset.
      **DoD**: Both confirmed; any `changeLanguage('en')` in tests requires `afterEach` reset to `'es'`.

---

## Phase 1 — RED Tests (write before any implementation)

> All tests MUST fail at the end of this phase because the implementation does not yet exist.
> Framework: `bun:test`. Preloads required: `apps/web/test/register-dom.ts` + `apps/web/test/setup.ts`.

### 1.1 Helper unit test — `format-days-ago.test.ts`

- [x] 1.1 Create `apps/web/src/features/home/format-days-ago.test.ts`.
      The file must import `formatDaysAgo` from `./format-days-ago` (does not exist yet → import will fail → RED).
      Include exactly 8 assertions split across `afterEach(() => i18n.changeLanguage('es'))`:

  | count | lang | expected         |
  | ----- | ---- | ---------------- |
  | 0     | es   | `"hoy"`          |
  | 1     | es   | `"ayer"`         |
  | 2     | es   | `"hace 2 días"`  |
  | 21    | es   | `"hace 21 días"` |
  | 0     | en   | `"today"`        |
  | 1     | en   | `"yesterday"`    |
  | 2     | en   | `"2 days ago"`   |
  | 21    | en   | `"21 days ago"`  |

  Each EN sub-test calls `await i18n.changeLanguage('en')` before the assertion.
  Satisfies: REQ — Days-ago display uses locale-aware pluralization (spec counts 0/1/2/21).
  Run to confirm RED:

  ```
  bun test --preload apps/web/test/register-dom.ts --preload apps/web/test/setup.ts apps/web/src/features/home/format-days-ago.test.ts
  ```

  **DoD**: Test file exists; running it produces a module-not-found or import error (RED).

### 1.2 Locale key parity test — `home-locale-parity.test.ts`

- [x] 1.2 Create `apps/web/src/features/home/home-locale-parity.test.ts`.
      Import both locale JSON files directly:
  ```ts
  import en from '@/lib/i18n/locales/en/translation.json';
  import es from '@/lib/i18n/locales/es/translation.json';
  ```
  Implement `flattenKeys(obj, prefix)` that produces dot-path strings.
  Assert:
  ```ts
  const keysEn = flattenKeys(en.home).sort();
  const keysEs = flattenKeys(es.home).sort();
  expect(keysEn).toEqual(keysEs);
  ```
  No `changeLanguage` needed (no i18n runtime used).
  Satisfies: REQ — Locale files maintain identical key parity under `home.*`.
  Run to confirm RED:
  ```
  bun test --preload apps/web/test/register-dom.ts --preload apps/web/test/setup.ts apps/web/src/features/home/home-locale-parity.test.ts
  ```
  **DoD**: Test fails because `en.home` and `es.home` are both `undefined` (keys not yet added) — or the assertion fails if both are `{}`. Either failure mode is RED.

### 1.3 Home render smoke test — `home-page.test.tsx`

- [x] 1.3 Create `apps/web/src/features/home/home-page.test.tsx`.
      Mock modules BEFORE imports (Bun requirement):
  ```ts
  mock.module('@tanstack/react-query', () => ({
    useQuery: () => ({ data: undefined, isLoading: false }),
  }));
  mock.module('@/contexts/auth-context', () => ({ useAuth: () => ({ user: null }) }));
  mock.module('@/contexts/guest-context', () => ({ useGuest: () => ({ isGuest: true }) }));
  mock.module('@/lib/api-functions', () => ({
    fetchPrograms: mock(() => []),
    fetchInsights: mock(() => []),
  }));
  mock.module('@/lib/query-keys', () => ({
    queryKeys: { programs: { all: [] }, insights: { list: () => [] } },
  }));
  ```
  Then import `{ render, screen }` and `{ HomePage }`.
  Test structure (two `it` blocks, `afterEach(() => i18n.changeLanguage('es'))`):
  1. `'es'` (default): assert `screen.getByText('Modo invitado')` is in document.
  2. `'en'`: call `await i18n.changeLanguage('en')`, re-render, assert `screen.getByText('Guest mode')` is in document.
     Satisfies: REQ — Home strings resolve through i18n for all supported locales (guest empty-state scenario).
     Run to confirm RED:
  ```
  bun test --preload apps/web/test/register-dom.ts --preload apps/web/test/setup.ts apps/web/src/features/home/home-page.test.tsx
  ```
  **DoD**: Tests fail because `home.empty.guest_title` keys are missing → components render hardcoded literals `"Modo invitado"` for ES (passes by accident) but `"Guest mode"` is absent for EN (RED). Or the mock setup itself triggers a RED if the component throws. Either confirms RED.

---

## Phase 2 — Locale File Additions

> Add the `home` namespace to both JSON files. Do this BEFORE component refactors so the parity test can go GREEN independently.

- [x] 2.1 Add `home` top-level key to `apps/web/src/lib/i18n/locales/en/translation.json`.
      Insert after the last top-level key. Exact shape:

  ```json
  "home": {
    "page_title": "Home — Gravity Room",
    "header": {
      "greeting_named": "Welcome, {{name}}",
      "greeting_generic": "Welcome to Gravity Room",
      "streak_inline": "Streak: {{count}}",
      "last_session_label": "Last session:",
      "last_today": "today",
      "last_yesterday": "yesterday",
      "last_days_ago_one": "{{count}} day ago",
      "last_days_ago_other": "{{count}} days ago"
    },
    "kpi": {
      "streak_label": "Streak",
      "streak_sub": "in a row",
      "sessions_label": "Sessions/wk",
      "sessions_sub": "frequency",
      "consistency_label": "Consistency",
      "consistency_sub_total": "{{count}} total"
    },
    "empty": {
      "guest_title": "Guest mode",
      "guest_body": "Create your free account to save your progress and follow your program.",
      "guest_cta": "Create Account",
      "no_program_title": "No active program",
      "no_program_body": "Pick a program to start logging your training.",
      "no_program_cta": "View Programs"
    },
    "footer": {
      "view_stats": "View stats in Profile",
      "change_language": "Change language in Profile"
    }
  }
  ```

  Note: `home.empty.guest_body` copy is a literal translation draft — flag in PR for product review (open question from design).
  Satisfies: REQ — Home strings resolve through i18n for all supported locales; REQ — Key parity.
  **DoD**: JSON parses without error; `en.home` object exists with the 23 keys listed above.

- [x] 2.2 Add `home` top-level key to `apps/web/src/lib/i18n/locales/es/translation.json`.
      Insert after the last top-level key. Exact shape:
  ```json
  "home": {
    "page_title": "Inicio — Gravity Room",
    "header": {
      "greeting_named": "Bienvenido, {{name}}",
      "greeting_generic": "Bienvenido a Gravity Room",
      "streak_inline": "Racha: {{count}}",
      "last_session_label": "Última sesión:",
      "last_today": "hoy",
      "last_yesterday": "ayer",
      "last_days_ago_one": "hace {{count}} día",
      "last_days_ago_other": "hace {{count}} días"
    },
    "kpi": {
      "streak_label": "Racha",
      "streak_sub": "seguidos",
      "sessions_label": "Sesiones/sem",
      "sessions_sub": "frecuencia",
      "consistency_label": "Consistencia",
      "consistency_sub_total": "{{count}} total"
    },
    "empty": {
      "guest_title": "Modo invitado",
      "guest_body": "Crea tu cuenta gratis para guardar tu progreso y seguir tu programa.",
      "guest_cta": "Crear Cuenta",
      "no_program_title": "Sin programa activo",
      "no_program_body": "Elige un programa para empezar a registrar tu entrenamiento.",
      "no_program_cta": "Ver Programas"
    },
    "footer": {
      "view_stats": "Ver estadísticas en Perfil",
      "change_language": "Cambia el idioma en Perfil"
    }
  }
  ```
  Satisfies: REQ — Home strings resolve through i18n for all supported locales; REQ — Key parity.
  **DoD**: JSON parses without error; `es.home` key set equals `en.home` key set exactly.

---

## Phase 3 — Helper Extraction

- [x] 3.1 Create `apps/web/src/features/home/format-days-ago.ts`.
      Exact implementation per design:

  ```ts
  import type { TFunction } from 'i18next';

  export function formatDaysAgo(t: TFunction, days: number): string {
    if (days === 0) return t('home.header.last_today');
    if (days === 1) return t('home.header.last_yesterday');
    return t('home.header.last_days_ago', { count: days });
  }
  ```

  No `any`, no type assertions, explicit `string` return type.
  i18next resolves `last_days_ago_one` / `last_days_ago_other` from `count` automatically.
  Satisfies: REQ — Days-ago display uses locale-aware pluralization.
  **DoD**: `format-days-ago.test.ts` from 1.1 goes GREEN (all 8 assertions pass).

---

## Phase 4 — Component Refactors

> Each component: add `useTranslation` hook, replace literals with `t('home.*')`, preserve prop interfaces unchanged.

- [x] 4.1 Modify `apps/web/src/features/home/home-header.tsx`.
      Changes:
  - Remove the inline `formatDaysAgo(days: number)` function (lines 7–11).
  - Add imports: `import { useTranslation } from 'react-i18next';` and `import { formatDaysAgo } from './format-days-ago';`.
  - Inside `HomeHeader`, add `const { t } = useTranslation();`.
  - Replace `userName ? \`Bienvenido, ${userName}\` : 'Bienvenido a Gravity Room'`→`userName ? t('home.header.greeting_named', { name: userName }) : t('home.header.greeting_generic')`.
  - Replace `Racha: {streakDays}` → `{t('home.header.streak_inline', { count: streakDays })}`.
  - Replace `Última sesión: {formatDaysAgo(daysSinceLast)}` → `{t('home.header.last_session_label')} {formatDaysAgo(t, daysSinceLast)}`.
    Prop interface `HomeHeaderProps` is unchanged (readonly fields preserved).
    Satisfies: REQ — Home strings resolve through i18n (header strings).
    **DoD**: Component renders without TS errors; `bun run typecheck` passes.

- [x] 4.2 Modify `apps/web/src/features/home/home-kpi-strip.tsx`.
      Changes:
  - Add imports: `import { useTranslation } from 'react-i18next';`.
  - Inside `HomeKpiStrip`, add `const { t } = useTranslation();`.
  - Replace `label="Racha"` → `label={t('home.kpi.streak_label')}`.
  - Replace `sub="seguidos"` → `sub={t('home.kpi.streak_sub')}`.
  - Replace `label="Sesiones/sem"` → `label={t('home.kpi.sessions_label')}`.
  - Replace `sub="frecuencia"` → `sub={t('home.kpi.sessions_sub')}`.
  - Replace `label="Consistencia"` → `label={t('home.kpi.consistency_label')}`.
  - Replace ``sub={freqPayload ? `${freqPayload.totalSessions} total` : undefined}``
    → `sub={freqPayload ? t('home.kpi.consistency_sub_total', { count: freqPayload.totalSessions }) : undefined}`.
    `KpiCard` prop interface is unchanged (still accepts `string | undefined`).
    Satisfies: REQ — Home strings resolve through i18n (KPI strip strings).
    **DoD**: Component renders without TS errors; `bun run typecheck` passes.

- [x] 4.3 Modify `apps/web/src/features/home/home-empty-state.tsx`.
      Changes:
  - Add imports: `import { useTranslation } from 'react-i18next';`.
  - Inside `HomeEmptyState`, add `const { t } = useTranslation();`.
  - Replace `Modo invitado` → `{t('home.empty.guest_title')}`.
  - Replace `Crea tu cuenta gratis para guardar tu progreso y seguir tu programa.` → `{t('home.empty.guest_body')}`.
  - Replace `Crear Cuenta` (guest CTA) → `{t('home.empty.guest_cta')}`.
  - Replace `Sin programa activo` → `{t('home.empty.no_program_title')}`.
  - Replace `Elige un programa para empezar a registrar tu entrenamiento.` → `{t('home.empty.no_program_body')}`.
  - Replace `Ver Programas` → `{t('home.empty.no_program_cta')}`.
    Prop interface `HomeEmptyStateProps` (`variant: 'guest' | 'no-program'`) is unchanged.
    Satisfies: REQ — Home strings resolve through i18n (empty state strings); REQ — Guest scenario.
    **DoD**: Component renders without TS errors; `bun run typecheck` passes.

- [x] 4.4 Modify `apps/web/src/features/home/home-page.tsx`.
      Changes:
  - Add imports: `import { useTranslation } from 'react-i18next';`.
  - Inside `HomePage`, add `const { t } = useTranslation();`.
  - Replace `useDocumentTitle('Inicio — Gravity Room')` → `useDocumentTitle(t('home.page_title'))`.
  - Replace `Ver estadísticas en Perfil` → `{t('home.footer.view_stats')}`.
  - Replace `Cambia el idioma en Perfil` → `{t('home.footer.change_language')}`.
    All other logic (`daysSinceLastWorkout`, queries, memo) is unchanged.
    Satisfies: REQ — Home strings resolve through i18n (page title + footer links).
    **DoD**: Component renders without TS errors; `bun run typecheck` passes.

---

## Phase 5 — GREEN Verification

- [x] 5.1 Re-run `format-days-ago.test.ts` — must now pass all 8 assertions.

  ```
  bun test --preload apps/web/test/register-dom.ts --preload apps/web/test/setup.ts apps/web/src/features/home/format-days-ago.test.ts
  ```

  **DoD**: 8/8 assertions green, 0 failures.

- [x] 5.2 Re-run `home-locale-parity.test.ts` — must now pass (key sets equal).

  ```
  bun test --preload apps/web/test/register-dom.ts --preload apps/web/test/setup.ts apps/web/src/features/home/home-locale-parity.test.ts
  ```

  **DoD**: 1/1 assertion green.

- [x] 5.3 Re-run `home-page.test.tsx` — ES variant must render `"Modo invitado"`, EN must render `"Guest mode"`.

  ```
  bun test --preload apps/web/test/register-dom.ts --preload apps/web/test/setup.ts apps/web/src/features/home/home-page.test.tsx
  ```

  **DoD**: Both it-blocks green.

- [x] 5.4 Run the full web unit test suite to confirm no regressions:

  ```
  bun run test
  ```

  **DoD**: All tests pass; exit code 0.

- [x] 5.5 Run `bun run typecheck` — zero errors.
      **DoD**: Exit code 0; no `any`, no type assertions, no nesting > 3.

- [x] 5.6 Run `bun run lint` — zero new violations.
      **DoD**: Exit code 0.

---

## Phase 6 — Commit

- [x] 6.1 Commit Phase 1 test files (RED tests only):

  ```
  scripts/committer "test(i18n): red tests for home localization" \
    apps/web/src/features/home/format-days-ago.test.ts \
    apps/web/src/features/home/home-locale-parity.test.ts \
    apps/web/src/features/home/home-page.test.tsx
  ```

  **DoD**: Commit created; files staged exactly as listed.

- [x] 6.2 Commit implementation (Phases 2–4 together):

  ```
  scripts/committer "feat(i18n): localize Home route (home-page, header, kpi, empty-state)" \
    apps/web/src/lib/i18n/locales/en/translation.json \
    apps/web/src/lib/i18n/locales/es/translation.json \
    apps/web/src/features/home/format-days-ago.ts \
    apps/web/src/features/home/home-header.tsx \
    apps/web/src/features/home/home-kpi-strip.tsx \
    apps/web/src/features/home/home-empty-state.tsx \
    apps/web/src/features/home/home-page.tsx
  ```

  **DoD**: Commit created; all 7 files staged; Conventional Commits format respected.

- [x] 6.3 Flag open question in PR description: `home.empty.guest_body` EN copy is a literal translation draft — confirm naturalness with product before merging.
      **DoD**: PR body contains a note about this open question from design.

---

## Phase 7 — Out-of-Scope Boundary Check

- [x] 7.1 Assert no strings in out-of-scope components were touched. Run:
  ```
  grep -n "useTranslation\|t('" \
    apps/web/src/features/dashboard/active-program-card.tsx \
    apps/web/src/components/guest-banner.tsx \
    apps/web/src/features/dashboard/kpi-card.tsx
  ```
  These files MUST show only pre-existing `useTranslation` calls (if any), with no new additions from this change.
  **DoD**: `git diff` for those three files shows zero changes.

---

## Summary

| Phase     | Tasks  | Focus                             |
| --------- | ------ | --------------------------------- |
| Phase 0   | 3      | Preconditions / path verification |
| Phase 1   | 3      | RED tests (strict TDD)            |
| Phase 2   | 2      | Locale JSON additions             |
| Phase 3   | 1      | Helper extraction                 |
| Phase 4   | 4      | Component refactors               |
| Phase 5   | 6      | GREEN verification                |
| Phase 6   | 3      | Commits                           |
| Phase 7   | 1      | Boundary check                    |
| **Total** | **23** |                                   |
