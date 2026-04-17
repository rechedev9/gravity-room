# Archive Report: i18n-home-localization

**Closed**: 2026-04-17
**Verdict**: PASS WITH WARNINGS
**Branch at close**: feat/validate-insights-types (commits also tagged on feat/i18n-home-localization)
**Commits**:

- 39bf88d test(i18n): red tests for home localization
- edbaef0 feat(i18n): localize Home route

## Scope Delivered

- 4 Home components localized (home-page, home-header, home-kpi-strip, home-empty-state)
- 23 new i18n keys under `home.*` with EN/ES parity
- New helper `format-days-ago.ts` with CLDR-aware pluralization (today / yesterday / N days ago with singular/plural)
- 11 new tests (format-days-ago × 8 asserts, locale parity × 1, home render smoke × 2) — all GREEN
- Full web test suite 400/400 passing at close

## Out-of-Scope Preserved

- `ActiveProgramCard` (not touched)
- `GuestBanner` (not touched)
- `KpiCard` primitive (not touched)

## Open Items (Warnings — non-blocking)

- 6 React `act()` warnings in home-page.test.tsx (cosmetic, non-fatal)
- `home.empty.guest_body` EN copy is a literal translation draft — awaiting product review before merging PR
- Mock ratio in home-page.test.tsx is heavy but justified (isolation from Query/Auth/Guest providers)
- Missing-key fallback scenario has no explicit runtime test (parity test covers it structurally)

## Artifacts Preserved

- `openspec/changes/archive/i18n-home-localization/{proposal,design,tasks,verify-report,archive-report}.md`
- `openspec/changes/archive/i18n-home-localization/specs/home.md` (delta)
- Engram topic keys: `sdd/i18n-home-localization/{proposal,spec,design,tasks,apply-progress,verify-report,archive-report}`

## Main Spec Update

- `openspec/specs/home.md` — created with the Home localization requirements (delta spec copied as canonical).
