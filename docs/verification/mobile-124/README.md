# Mobile foundations checkpoint — 2026-09-04

Work branch: `feat/mobile-foundations`, preserving the set-flow WIP at `2cbac43`.
This is partial implementation of [#124](https://github.com/rechedev9/gravity-room/issues/124),
not completion of that issue or its parent #121.

Implemented:

- SQLite migration 4 adds `set_drafts`, partitioned by active owner and program.
- Tracker restores drafts on mount and saves each incomplete set/undo before
  publishing it. Failed writes retain the prior state and display a translated error.
- Completed results and removal of their drafts commit in the same SQLite transaction.
- Logout clears drafts; repository operations fail closed without a validated owner.
- Shell, providers, tests and design tokens moved from `src/app` to `src/shell`.
  Removed unused legacy palette aliases. Expo Router now owns protected login,
  five tabs, and program-detail stack routes.
- Restored deterministic English `expo-localization` test mock.
- Metro resolves React/React DOM from the mobile package, fixing a duplicate-React
  hook error observed in the Expo web preview.

Verification:

- `pnpm run typecheck` — passed.
- `pnpm run lint` — passed.
- `pnpm --filter mobile test --watch=false` — 24 suites, 231 tests passed.
- Repository tests execute production migrations and SQL against real SQLite
  (`node:sqlite`), including account isolation, rollback, atomic completion,
  input rejection, account change during a write, and logout cleanup.
- Android emulator / Expo Go: logged one bench set on GZCLP day 3, force-stopped
  Expo Go, reopened the app, returned to day 3, and verified the next action was
  **Confirm set 2 for Press Banca**. Repeated restoration after moving the shell
  and restarting Metro. [Android screenshot](./android-draft-restored.webp).
- Playwright CLI: rendered the Expo web login at localhost:8081, inspected the
  screenshot and console (zero errors after the Metro fix), and closed the browser
  session. [Web screenshot](./web-login.webp). This checks the preview entry only;
  the native emulator above is the evidence for draft restoration.

Further implementation in this branch:

- Absolute-deadline rest timer, owned by the authenticated shell; incomplete sets
  start 180s / 120s / 90s rests according to the slot role. Skip cancels the alarm.
  Foreground completion invokes Expo haptics; the OS owns background alerts.
- SDK 54 notifications/haptics dependencies and notifications config plugin added.
  Permission denial leaves the on-screen timer running with an explanatory notice.
- Added TextInput, Stepper, Chip, Sheet, and SegmentedChoice primitives with
  accessible controls and at least 44px targets. Login now uses TextInput.
- Android rendered the timer above navigation. Returning through Android Recents
  resampled elapsed wall time (2:33 when backgrounded, 1:16 after returning).
  [Active rest](./android-rest-active.webp), [resumed rest](./android-rest-resumed.webp).
- Playwright CLI checked the email form using the new TextInput, with zero console
  errors. [Email form](./web-email-input.webp). Browser session closed.
- Native API tests cover denied notification permission, preserving the original
  deadline across permission checks, expired deadlines, and haptic invocation.

Router and query checkpoint:

- Expo Router provides Workout, Mesos, Templates, Exercises, and More tabs with
  translated labels. Mesos opens workout detail on a separate stack; Android Back
  returns to Mesos. [Five tabs](./android-five-tabs.webp).
- Android sign-out followed by force-stop/reopen stays at Login with protected
  tabs absent. Dev Login restores the authenticated shell.
- Each authenticated account owns a QueryClient. Summaries deduplicate requests,
  publish SQLite cache first, and retain it offline; canceled requests cannot
  persist a late response after account changes. Tracker detail/definition reads
  use query deduplication while SQLite/outbox remains the local write owner.
- Latest `pnpm --filter mobile test`: 25 suites / 234 tests passed, including
  query cancellation and edited-set completion. Mobile typecheck and root lint
  passed. These checks include ongoing #125 work; they do not complete #121.
- Playwright CLI cold entry redirected to Login with zero console errors, one
  warning. Screenshot captured and browser session closed.

Background delivery verified: Android posted **Rest complete** while the app was
backgrounded. [Notification screenshot](./android-rest-notification.webp). This
emulator did not grant exact-alarm access: `dumpsys alarm` showed a roughly
2-minute batching window, and delivery was delayed accordingly. The on-screen
countdown still used the original deadline. Exact background alert timing needs
verification in a development/release build with Android alarm permissions.
Skip verified on Android: the banner disappeared, the pending fifth bench set
remained, and `dumpsys alarm` no longer listed an Expo RTC alarm.
[After skip](./android-rest-skipped.webp).
Then completed the fifth bench set: the AMRAP editor appeared and neither the
rest banner nor an Expo RTC alarm was present.
The timer controller also rejects starts from callbacks that finish after its
owner is disposed; a regression test reproduces this account-transition race.
The remaining UI primitives still need verification in their eventual D1/D2/D4 flows.
No PR has been opened and no issue has been closed at this checkpoint.

Continue the parent scope after #124: #125, #122, #123, #126, #127, #128, #129,
respecting the dependencies in #121. Those issues have not been implemented by
this checkpoint. Inspect their current GitHub bodies before implementing them.

## Workout and visual revision

The #125 implementation now records edited weight/reps, preserves missed-set
logs, and shows actual recorded volume plus domain next-session previews.
Android completed day 2 with row sets 5 kg × 25, 2.5 kg × 20, and 2.5 kg × 25;
the row slot failed and the full day totaled 350 kg. Continue selected day 3,
the first unfinished workout. [Edited sets](./android-edited-sets.webp),
[day completion](./android-day-complete.webp).

The user then prioritized a professional visual revision. See the
[current design verification](../mobile-design/README.md); those images supersede
the earlier square-card/large-header appearance. The mesocycle domain/API work
has not yet been implemented.
