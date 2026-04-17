# Home Localization Specification

## Purpose

Governs the observable behavior of the Home route after all user-facing strings are resolved through the i18n system instead of being hardcoded. This is a new spec domain — no prior spec exists.

## Covered components

`home-page.tsx`, `home-header.tsx`, `home-kpi-strip.tsx`, `home-empty-state.tsx`

---

## ADDED Requirements

### Requirement: Home strings resolve through i18n for all supported locales

Every user-facing string in the Home feature MUST render the locale-appropriate translation when the active language is `en` or `es`. No component in `apps/web/src/features/home/` SHALL render a hardcoded Spanish or English string directly in JSX.

| Component          | Strings to localize                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `home-page`        | Document title, "Ver estadísticas en Perfil" link, "Cambia el idioma en Perfil" link            |
| `home-header`      | Greeting with name, greeting without name, streak label, last-session label, days-ago display   |
| `home-kpi-strip`   | KPI labels (streak, sessions/week, consistency), KPI sub-labels (consecutive, frequency, total) |
| `home-empty-state` | Guest heading, guest body, guest CTA; no-program heading, no-program body, no-program CTA       |

#### Scenario: Authenticated user sees English Home

- GIVEN the app language is set to `en`
- WHEN an authenticated user navigates to the Home route
- THEN all visible strings in `HomeHeader`, `HomeKpiStrip`, and the profile link row render in English
- AND no Spanish-only literal appears in the rendered output

#### Scenario: Authenticated user sees Spanish Home

- GIVEN the app language is set to `es`
- WHEN an authenticated user navigates to the Home route
- THEN all visible strings render in Spanish
- AND no English-only literal appears in the rendered output

#### Scenario: Guest user empty state renders localized copy

- GIVEN the app language is `en` and the user is in guest mode
- WHEN the Home route renders `HomeEmptyState` with `variant="guest"`
- THEN the heading, body text, and CTA button text all render in English

---

### Requirement: Days-ago display uses locale-aware pluralization

The "last session" display in `HomeHeader` MUST produce grammatically correct output in both locales for the boundary counts: 0, 1, and 2+.

| count | Expected English                    | Expected Spanish |
| ----- | ----------------------------------- | ---------------- |
| 0     | "today"                             | "hoy"            |
| 1     | "yesterday"                         | "ayer"           |
| 2     | "2 days ago" (or locale equivalent) | "hace 2 días"    |
| 21    | "21 days ago"                       | "hace 21 días"   |

#### Scenario: count=0 renders "today" form

- GIVEN `daysSinceLast` is 0
- WHEN `HomeHeader` renders
- THEN the last-session string resolves to the locale-specific "today" string

#### Scenario: count=1 renders "yesterday" form

- GIVEN `daysSinceLast` is 1
- WHEN `HomeHeader` renders
- THEN the last-session string resolves to the locale-specific "yesterday" string

#### Scenario: count=2 renders plural days form

- GIVEN `daysSinceLast` is 2
- WHEN `HomeHeader` renders in `en`
- THEN the rendered string contains "2" and resolves to the `other` plural form (not the `one` form)

#### Scenario: count=21 also uses plural form

- GIVEN `daysSinceLast` is 21
- WHEN `HomeHeader` renders
- THEN the rendered string resolves to the `other` form in both `en` and `es`

---

### Requirement: Locale files maintain identical key parity under `home.*`

The `home` namespace MUST exist in both `apps/web/src/lib/i18n/locales/en/translation.json` and `apps/web/src/lib/i18n/locales/es/translation.json`. The set of keys under `home.*` in `en` MUST equal the set of keys in `es`. No key SHALL exist in one file but not the other.

#### Scenario: Key sets are identical across locales

- GIVEN both locale JSON files have been updated
- WHEN the set of keys under `home.*` is extracted from each file
- THEN `keys(en.home)` equals `keys(es.home)` with no additions or omissions in either direction

---

### Requirement: Missing key MUST NOT render raw key string to user

If a translation key lookup fails at runtime (e.g., a key present in `en` but missing from `es`), the system MUST NOT display the raw key string (e.g., `"home.header.greeting"`). The i18n runtime SHALL fall back to `es` (the configured `fallbackLng`) and render the Spanish string.

#### Scenario: Missing key falls back to Spanish string

- GIVEN a Home translation key exists in `en` but is absent from `es`
- WHEN the app language is `en` and the Home route renders
- THEN the component renders the `en` value (primary lookup succeeds)
- GIVEN the app language is `es` and the key is absent from `es`
- WHEN the Home route renders
- THEN the component renders the `es` fallback from `fallbackLng` resolution — never the raw key string
