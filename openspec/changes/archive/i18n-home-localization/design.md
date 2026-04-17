# Design: Localize Home Route (i18n)

## Technical Approach

Replace hardcoded Spanish literals in `apps/web/src/features/home/*.tsx` with `t()` calls against a new flat `home.*` namespace in both locale bundles. Extract `formatDaysAgo` into a dedicated module, drive it by i18n via three distinct keys (today / yesterday / days-ago-with-count), and add two parity/render tests plus a unit test for the extracted helper. Proposal scope is respected: only the four Home files, plus the new `format-days-ago.ts` and its test.

## Architecture Decisions

| Decision                                                       | Choice                                                                                                        | Alternatives                                                     | Rationale                                                                                                                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Namespace                                                      | Flat `home.*` (e.g. `home.header.streak_inline`)                                                              | Nested `home.header.streak.inline`                               | Matches neighbors (`dashboard`, `programs.card`, `tracker.toolbar`). Flat is the house pattern.                                                                        |
| `formatDaysAgo` location                                       | New `apps/web/src/features/home/format-days-ago.ts` exporting `formatDaysAgo(t, days)`                        | Keep inline in `home-header.tsx`                                 | Rendering-free unit tests across counts 0/1/2/21 in both locales.                                                                                                      |
| Day 0 / 1 special cases                                        | Three distinct keys: `home.header.last_today`, `last_yesterday`, `last_days_ago` (count-driven `_one/_other`) | Single `t(key, { count: 0 })` relying on `_zero` or plural rules | CLDR for en/es emits only `_one`/`_other` — no `_zero`. Plural rules cannot distinguish "today" (0) from "2+ days". Conditional key selection is explicit and correct. |
| Greeting split                                                 | Two keys: `greeting_named` (`Bienvenido, {{name}}`) and `greeting_generic`                                    | One key with optional `{{name}}`                                 | i18next interpolates missing vars as empty string — would leave a dangling comma in generic branch.                                                                    |
| Context collisions (`Racha` appears in header _and_ KPI strip) | Two keys: `home.header.streak_inline` (`Racha: {{count}}`) and `home.kpi.streak_label` (`Racha`)              | Share one key                                                    | Different grammatical roles (inline fragment vs. bare label). Sharing invites future edit hazard.                                                                      |
| KPI label source of truth                                      | New `home.kpi.*` keys passed as `label` / `sub` props into `KpiCard`                                          | Modify `KpiCard` to accept i18n keys                             | Out of scope — `KpiCard` is shared primitive owned by `features/dashboard`. Keep it dumb.                                                                              |

## Data Flow

    home-page.tsx ─ t("home.page_title") ─→ useDocumentTitle
         │
         ├─ <HomeHeader> ─ useTranslation → greeting / streak / last-session
         │                                  └─ formatDaysAgo(t, days) ← helper
         │
         ├─ <HomeKpiStrip> ─ useTranslation → KpiCard props (label, sub)
         │
         └─ <HomeEmptyState> ─ useTranslation → copy + CTA

## File Changes

| File                                                    | Action | Description                                                                                                                               |
| ------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/features/home/home-page.tsx`              | Modify | Add `useTranslation`; replace `useDocumentTitle`, "Ver estadísticas…", "Cambia el idioma…" with `t()`.                                    |
| `apps/web/src/features/home/home-header.tsx`            | Modify | Add `useTranslation`; replace greeting + "Racha: N" + "Última sesión:"; delegate date formatting to helper.                               |
| `apps/web/src/features/home/home-kpi-strip.tsx`         | Modify | Add `useTranslation`; replace three labels + three subs via `t()`.                                                                        |
| `apps/web/src/features/home/home-empty-state.tsx`       | Modify | Add `useTranslation`; replace guest + no-program copy + CTA labels.                                                                       |
| `apps/web/src/features/home/format-days-ago.ts`         | Create | `formatDaysAgo(t: TFunction, days: number): string` — branches on 0/1/n, calls `t('home.header.last_days_ago', { count: days })` for n≥2. |
| `apps/web/src/features/home/format-days-ago.test.ts`    | Create | Unit test in both locales for counts 0, 1, 2, 21.                                                                                         |
| `apps/web/src/features/home/home-locale-parity.test.ts` | Create | Flatten both JSONs to dot-paths; assert `home.*` key sets are equal.                                                                      |
| `apps/web/src/features/home/home-page.test.tsx`         | Create | Render smoke in `es` and `en` (change via `i18n.changeLanguage`, reset in `afterEach`).                                                   |
| `apps/web/src/lib/i18n/locales/en/translation.json`     | Modify | Add `home` top-level namespace (see Interfaces).                                                                                          |
| `apps/web/src/lib/i18n/locales/es/translation.json`     | Modify | Add `home` namespace mirroring EN keys.                                                                                                   |

## Interfaces / Contracts

### String inventory → keys

| Key                               | EN                                                                        | ES                                                                     | Notes                          |
| --------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| `home.page_title`                 | `Home — Gravity Room`                                                     | `Inicio — Gravity Room`                                                | Document title                 |
| `home.header.greeting_named`      | `Welcome, {{name}}`                                                       | `Bienvenido, {{name}}`                                                 | `{{name}}: string`             |
| `home.header.greeting_generic`    | `Welcome to Gravity Room`                                                 | `Bienvenido a Gravity Room`                                            | —                              |
| `home.header.streak_inline`       | `Streak: {{count}}`                                                       | `Racha: {{count}}`                                                     | `{{count}}: number`            |
| `home.header.last_session_label`  | `Last session:`                                                           | `Última sesión:`                                                       | Prefix; helper output appended |
| `home.header.last_today`          | `today`                                                                   | `hoy`                                                                  | Day 0                          |
| `home.header.last_yesterday`      | `yesterday`                                                               | `ayer`                                                                 | Day 1                          |
| `home.header.last_days_ago_one`   | `{{count}} day ago`                                                       | `hace {{count}} día`                                                   | Plural                         |
| `home.header.last_days_ago_other` | `{{count}} days ago`                                                      | `hace {{count}} días`                                                  | Plural                         |
| `home.kpi.streak_label`           | `Streak`                                                                  | `Racha`                                                                | —                              |
| `home.kpi.streak_sub`             | `in a row`                                                                | `seguidos`                                                             | —                              |
| `home.kpi.sessions_label`         | `Sessions/wk`                                                             | `Sesiones/sem`                                                         | —                              |
| `home.kpi.sessions_sub`           | `frequency`                                                               | `frecuencia`                                                           | —                              |
| `home.kpi.consistency_label`      | `Consistency`                                                             | `Consistencia`                                                         | —                              |
| `home.kpi.consistency_sub_total`  | `{{count}} total`                                                         | `{{count}} total`                                                      | Only when `freqPayload` truthy |
| `home.empty.guest_title`          | `Guest mode`                                                              | `Modo invitado`                                                        | —                              |
| `home.empty.guest_body`           | `Create your free account to save your progress and follow your program.` | `Crea tu cuenta gratis para guardar tu progreso y seguir tu programa.` | —                              |
| `home.empty.guest_cta`            | `Create Account`                                                          | `Crear Cuenta`                                                         | —                              |
| `home.empty.no_program_title`     | `No active program`                                                       | `Sin programa activo`                                                  | —                              |
| `home.empty.no_program_body`      | `Pick a program to start logging your training.`                          | `Elige un programa para empezar a registrar tu entrenamiento.`         | —                              |
| `home.empty.no_program_cta`       | `View Programs`                                                           | `Ver Programas`                                                        | —                              |
| `home.footer.view_stats`          | `View stats in Profile`                                                   | `Ver estadísticas en Perfil`                                           | —                              |
| `home.footer.change_language`     | `Change language in Profile`                                              | `Cambia el idioma en Perfil`                                           | —                              |

### Locale JSON shape (both files)

```jsonc
"home": {
  "page_title": "…",
  "header": { "greeting_named": "…", "greeting_generic": "…",
              "streak_inline": "…", "last_session_label": "…",
              "last_today": "…", "last_yesterday": "…",
              "last_days_ago_one": "…", "last_days_ago_other": "…" },
  "kpi":    { "streak_label": "…", "streak_sub": "…",
              "sessions_label": "…", "sessions_sub": "…",
              "consistency_label": "…", "consistency_sub_total": "…" },
  "empty":  { "guest_title": "…", "guest_body": "…", "guest_cta": "…",
              "no_program_title": "…", "no_program_body": "…", "no_program_cta": "…" },
  "footer": { "view_stats": "…", "change_language": "…" }
}
```

### Helper signature

```ts
import type { TFunction } from 'i18next';
export function formatDaysAgo(t: TFunction, days: number): string {
  if (days === 0) return t('home.header.last_today');
  if (days === 1) return t('home.header.last_yesterday');
  return t('home.header.last_days_ago', { count: days });
}
```

i18next picks `last_days_ago_one` / `last_days_ago_other` from `count` automatically.

## Testing Strategy

| Layer       | What                    | Approach                                                                                                                                                                  |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `formatDaysAgo`         | 4 counts × 2 locales = 8 assertions. Use `i18n.changeLanguage('en')` per sub-test; reset to `'es'` in `afterEach` to avoid leaking into siblings (setup.ts has no reset). |
| Unit        | `home-locale-parity`    | `flatten(en.home)` vs `flatten(es.home)`; `expect(keysEn).toEqual(keysEs)`. Scope to `home.*` only.                                                                       |
| Integration | `HomePage` render smoke | Render with `renderWithProviders`, mock `useQuery` to `{ data: undefined }`, assert greeting text appears in `es` then `en`. Reset language in `afterEach`.               |
| E2E         | —                       | Not expanded; Playwright suite already covers the render path in default locale.                                                                                          |

Strict TDD — tasks phase will:

1. Write failing `format-days-ago.test.ts` before helper exists.
2. Write failing parity test before keys are added.
3. Write failing render test before components call `t()`.

## Migration / Rollout

No data migration. Single PR. Additive keys — if reverted, unused `home.*` keys are harmless. Existing Spanish fallback (`fallbackLng: 'es'`) absorbs any key that accidentally lands in only one file until the parity test catches it.

## Out-of-Scope Boundaries

- `ActiveProgramCard` — owned by `apps/web/src/features/dashboard/active-program-card.tsx`. Already localized (`catalog.active_card.*`). Not touched.
- `GuestBanner` — owned by `apps/web/src/components/guest-banner.tsx`. Already localized (`guest_banner.*`). Not touched.
- `KpiCard` — owned by `apps/web/src/features/dashboard/kpi-card.tsx`. Remains prop-driven; Home passes already-translated strings in.
- `Button`, `ConfirmDialog`, `ProgramsIcon` — no user-facing text owned by Home.

No future change is scheduled here; if `KpiCard` grows i18n needs, it would be its own proposal.

## Open Questions

- [ ] Confirm EN copy for `home.empty.guest_body` reads naturally (current draft is literal — product may want punchier wording). Non-blocking; tasks can flag for review.

## Rollback Plan

Single commit. Revert restores all literals in one op. Unused `home.*` keys left in locales after revert are harmless (i18next silently ignores unused keys).
