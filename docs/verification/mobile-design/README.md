# Mobile visual revision — 2026-09-04

Requested during the #121 implementation on `feat/mobile-foundations`.
The parent issue remains in progress; this is the visual foundation for its screens.

## Changes

- Shared warm charcoal surfaces, rounded cards and controls, quieter borders,
  readable sans-serif headings, and restrained gold actions.
- Workout header combines program selection, week/day navigation, completion
  indicators, and session progress. The next editable set fits on the initial
  viewport even with an earlier completed exercise.
- Completed exercise logs and AMRAP/RPE editors expand on demand. Their values
  remain editable, with the existing undo behavior.
- Rest occupies one compact row above the tab bar, including when changing tabs.
  The stack detail screen has its own banner placement. Android status icons use
  light text; screen/tab safe-area padding is no longer duplicated.
- Five tabs use labeled icons. Login and profile share the revised visual system.
  The catalog has a bounded scroll area so later templates remain reachable.

## Verification

- Android / Expo Go: confirmed a squat set, saw the next editable row and rest
  countdown, changed tabs with the timer still visible, scrolled the catalog,
  and inspected the profile. [Workout and rest](./workout-rest.webp),
  [profile](./profile.webp), [templates](./templates.webp).
- Playwright CLI at 430 × 932: inspected login and email form, captured a screenshot,
  and reviewed the console (zero errors). Browser session closed.
  [Email form](./email.webp). Form layout evidence; final introductory copy was
  shortened after this capture.
- `pnpm run typecheck` passed across the workspace.
- `pnpm --filter mobile test`: 25 suites / 234 tests passed after the redesign.
  Completed-card tests now explicitly expand details before editing them.
- Existing native background notification timing limitation is documented in
  [the foundation verification](../mobile-124/README.md).

No deployment, PR, or issue closure is claimed by this checkpoint.

## Navigation naming revision

User-approved names: Entrenar / Mis planes / Explorar in Spanish, and
Train / My plans / Explore in English. Updated accessibility labels, the
My plans screen heading, and links back to plans. Internal route identifiers
are unchanged. Earlier screenshots retain the old labels.

[Current navigation](./navigation-naming.webp) verified in Android, including
opening My plans. Existing router and locale suites: 23 tests passed.
Playwright CLI checked the preview login, captured a screenshot, reported zero
console errors, and closed its browser session.
