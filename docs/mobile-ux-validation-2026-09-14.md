# Mobile UX validation — 2026-09-14

Build under test: mobile package 0.0.1, Expo 54, branch
`codex/mobile-ux-improvements`, based on `f6db48e` plus the accompanying changes.

## User-visible changes

- Login and signup scroll when space is limited, avoid the keyboard, and retain
  bottom safe-area padding. Next advances through fields; Done submits through
  existing validation. The sign-in/signup switch has a 44px touch target.
- Catalog search tolerates accents, case, and surrounding whitespace. Empty
  filtered results offer a reset for both query and level. Loading/errors do not
  announce a misleading zero-result count or display the empty-search message.
- Sheet titles use at most two visual lines so long names cannot displace Close.
  Assistive technology still receives the full title.

## Observed browser behavior

Tested the actual React Native components through local Expo Web in the Codex
browser at 320×568, 390×844, 1366×768, and 1920×1080.

- Before: signup at 320×568 placed Create account at y=613–657 with no scrollable
  container. After: scrolling reaches it at y=375–419 and the mode switch at
  y=431–475. Both targets are 44px high.
- Email → Name → Password focus traversal worked. Submitting a deliberately
  short test password via Enter displayed the existing minimum-length error.
- A long unbroken name stayed inside the input; no document horizontal overflow
  at any tested width. The form remains centered and capped at 480px.
- Catalog fixture query `ENFASIS` matched `énfasis`. Combining that query with
  Intermediate produced no results; Reset filters restored all three fixtures.
  A simulated load error showed Retry without the empty-search message; Retry
  restored the entries.
- Before: a long unbroken detail title pushed Close outside the viewport. After:
  Close was visible at x=230–304 on a 320px viewport and remained in bounds at
  the other widths; clicking it closed the sheet.

Catalog checks used a temporary route rendering the production CatalogBrowser
and Sheet with explicitly labeled test data. The route was removed before the
final checks and Android export. No test route or fixture is shipped.

## Automated validation

- `pnpm --filter mobile test`: 50 suites, 615 tests passed.
- `pnpm --filter mobile typecheck`: passed.
- `pnpm --filter mobile lint`: passed.
- Prettier for changed source files and `git diff --check`: passed.
- `pnpm --filter mobile exec expo export --platform android`: passed, 1,493 modules.
- Independent code review: no actionable findings.

The suite emits existing Expo Go notifications and React act warnings. These
did not fail the checks and were not suppressed.

## Limits

No Android/iOS device was connected, so native software-keyboard behavior and
screen-reader announcements still require device verification. Android export
is a bundle check, not an installed-app test. Automatic approval review rejected
starting the local API without a specific reason, so authenticated navigation
and real account/program creation were not exercised. No remote publication or
deployment was performed.
