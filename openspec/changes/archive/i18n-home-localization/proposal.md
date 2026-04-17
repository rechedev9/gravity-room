# Proposal: Localize Home Route (i18n)

## Intent

Home (`apps/web/src/features/home/`) still ships hardcoded Spanish strings while the rest of the app has adopted the `i18next` + `react-i18next` scaffold. Localize all user-facing strings under a new `home.*` namespace so Spanish and English users see a fully translated Home, closing a visible gap in the ongoing i18n initiative.

## Scope

### In Scope

- `home-page.tsx`: document title, "Ver estadísticas en Perfil", "Cambia el idioma en Perfil"
- `home-header.tsx`: greeting (with/without name), "Racha", "Última sesión", `formatDaysAgo` (today/yesterday/N days ago — pluralized)
- `home-kpi-strip.tsx`: labels (Racha, Sesiones/sem, Consistencia) and subs (seguidos, frecuencia, "N total")
- `home-empty-state.tsx`: guest + no-program copy, CTA buttons (Crear Cuenta, Ver Programas)
- New `home.*` keys in both `en/translation.json` and `es/translation.json`

### Out of Scope

- `ActiveProgramCard` and `GuestBanner` (imported by Home but owned by `features/dashboard` and `components/` — already using `useTranslation` where applicable)
- Any strings outside `features/home/`
- Adding new locales beyond `en` / `es`
- Refactoring i18n infrastructure (`lib/i18n/index.ts` stays as-is)

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- None (pure localization refactor — no requirement-level behavior change)

## Approach

- Add a `home` namespace to both locale JSON files mirroring neighbors (`dashboard`, `programs.card`). Flat keys with `{{var}}` interpolation and `_one` / `_other` plural suffixes where needed (e.g., `home.header.days_ago_one`, `home.header.days_ago_other`).
- In each Home component: import `useTranslation` from `react-i18next`, replace literals with `t('home.…')`. Explicit return types preserved; no `any`, no assertions, no nesting beyond depth 3.
- Move `formatDaysAgo` logic into a small helper that calls `t` with `{ count }`; handle `0 → today`, `1 → yesterday`, `n → days_ago`.
- `useDocumentTitle` receives `t('home.page_title')`.

## Affected Areas

| Area                                                | Impact   | Description                           |
| --------------------------------------------------- | -------- | ------------------------------------- |
| `apps/web/src/features/home/*.tsx`                  | Modified | Replace literals with `t()` calls     |
| `apps/web/src/lib/i18n/locales/en/translation.json` | Modified | Add `home` namespace                  |
| `apps/web/src/lib/i18n/locales/es/translation.json` | Modified | Add `home` namespace (mirror EN keys) |

## Risks

| Risk                                                             | Likelihood | Mitigation                                                                    |
| ---------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| Missing `es`/`en` key parity silently falls back to key string   | Med        | Verify both files have identical key shapes; add/extend test asserting parity |
| `formatDaysAgo` pluralization drift between locales              | Med        | Use i18next `count` + `_one`/`_other` suffixes (native support)               |
| Stale init memory lists `apps/go-api`; live repo uses `apps/api` | Low        | Frontend-only change — backend ambiguity does not block                       |

## Rollback Plan

Single-commit change: revert the commit to restore hardcoded strings. The new `home.*` keys are additive — leaving them in place after revert is harmless (unused keys).

## Dependencies

- Existing `i18next` setup at `apps/web/src/lib/i18n/index.ts` (already initialized; HMR wired).

## Success Criteria

- [ ] Home renders fully localized when `lang` is toggled between `es` and `en`
- [ ] No hardcoded user-facing strings remain in `apps/web/src/features/home/`
- [ ] `bun run typecheck` + `bun run lint` pass with no new `any`, assertions, or nesting-depth violations
- [ ] Existing unit + e2e suites remain green
- [ ] `es` and `en` locale files have identical `home.*` key sets
