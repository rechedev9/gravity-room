# Mobile end-to-end: a lifter's session on the Android emulator

Manual end-to-end pass of the mobile app as a person training in a gym would use
it, on emulator `gravity-api35` (Android 15, Expo Go, 1080 × 2400) against the
local API and Postgres on branch `feat/mobile-code-drawn-covers` (2026-09-19).
Flows exercised: Explore → detail → Start, Train set logging with edge inputs,
rest timer in background, force-stop and relaunch, day/week switching, a full
8-slot workout with mixed success/fail, GZCLP T1 failure progression, offline
logging with the API unreachable, and My plans with duplicate plans. Server
state was checked in `workout_results` / `program_instances` after each step.

## Findings, most severe first

| #   | Sev    | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | high   | **Set weight above 10 000 kg passes client validation, is rejected by the API and stalls the plan's sync.** `SetLogEntrySchema` only requires a non-negative weight; `POST /programs/:id/results` caps it at `MAX_SET_LOG_WEIGHT = 10_000`. Result: `1 change needs attention · Retry` forever, and because failed mutations hold the plan's queue, the next valid slot result never reached the server (see screenshots). The banner counts only the failed mutation, not the ones held behind it. The only way out is the header undo, twice, which also discards the valid result. Fix: enforce the same maximum in the domain schema (single SoT) and offer "discard change" on permanent 4xx failures. |
| F5  | high   | **No starting weights.** Starting a plan never asks for them and nothing edits them later: `buildDefaultProgramConfig` picks each field's `min`, so GZCLP begins at **2.5 kg** on every lift and the catalog programs at 20 kg. A gym user must fail or grind for weeks to reach working weights. Product gap rather than a bug.                                                                                                                                                                                                                                                                                                                                                                            |
| F6  | medium | **Rest-complete notification never appears while the app is in the background.** Two runs: alarm fired (`dumpsys alarm`), nothing posted (`cmd notification list`); the notification only tried to post on resume and was cancelled by the tracker tick. Banner countdown is wall-clock correct on return. Possibly an Expo Go limitation; confirm on a development build before treating it as an app bug.                                                                                                                                                                                                                                                                                                 |
| F7  | medium | **"Showing cached tracker data while sync catches up" is sticky.** Shown after a cold start when the first bootstrap fetch fails (token refresh race), and again after coming back online, and it stays until the screen remounts even though sync has finished. It is set in the bootstrap effect and never cleared.                                                                                                                                                                                                                                                                                                                                                                                       |
| F2  | medium | **0 reps is accepted with a green check.** A logged set with 0 reps shows ✓ in "sets recorded" although the domain (correctly) derives a failed slot. Disable ✓ for 0 reps or render such a set as a miss.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| F11 | medium | **Duplicate plans on double Start.** Starting the same catalog program twice creates two instances with identical name and cover; My plans lists two "GZCLP · Updated Sep 19, 2026" rows that cannot be told apart.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| F12 | medium | **No delete / archive / rename and no active-plan concept.** Train opens whichever plan was updated last; long-press does nothing. Combined with F11 a mistaken tap is permanent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| F3  | low    | Header undo reverts the whole last slot (all its sets) with no confirmation; the per-set undo disappears once the slot completes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| F4  | low    | Switching day/week with sets in progress gives no hint that another day is half done (drafts are kept, which is good). The day chip only gets ✓ when complete.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| F8  | low    | "Next session" heading renders with an empty list when the following days use different slot ids (previews match by `slotId`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| F10 | low    | Header mixes two day numbers: `WEEK 2 DAY 2` next to the definition's rotation label `Día 1 · Sep 19`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Fixes (follow-up PR)

| Finding     | Status | Change                                                                                                                                                                                |
| ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1          | fixed  | `MAX_SET_LOG_WEIGHT` moved to `@gzclp/domain` (`SetLogEntrySchema.weight.max`); the API imports it. The mobile input now disables ✓ above 10 000 kg, so the queue never stalls on it. |
| F2          | fixed  | Logged sets below the slot's target reps render as a red ✗ ("missed") in the recorded list.                                                                                           |
| F5          | fixed  | Starting a catalog program opens a starting-weights sheet (one field per weight input, defaults to the definition minimum, validates min/max) before the instance is created.         |
| F7          | fixed  | The tracker retries the bootstrap once the sync queue is idle and the device is online, which clears the "cached data" notice by itself.                                              |
| F8          | fixed  | The "Next session" heading is only rendered when there is at least one matching preview.                                                                                              |
| F11         | fixed  | Starting a program you already have asks for confirmation first.                                                                                                                      |
| F12         | fixed  | My plans has a delete control per plan (confirm dialog); it calls `DELETE /programs/:id` and purges the local summary, detail, drafts and queued mutations.                           |
| F13         | fixed  | Found during verification: the Android keyboard-hide back press closed the starting-weights sheet and discarded the form. `Sheet` now only hides the keyboard in that case.           |
| F6          | open   | Needs a development build to tell an Expo Go limitation from an app bug.                                                                                                              |
| F3, F4, F10 | open   | Cosmetic; left for a design pass.                                                                                                                                                     |

Emulator evidence for the fixes lives in [`fixes/`](./fixes/README.md).

## What worked

- Decimal comma (`2,5` → 2.5 kg), empty and negative weight disable ✓, double-tap guard.
- Set drafts persist across day switches and across a force-stop; committed results and the outbox survive a force-stop while offline.
- Offline (wifi + data off, API unreachable): logging keeps working, banner says
  "N changes waiting to sync · Saved on this device", and everything flushed by
  itself within ~10 s of the network returning, without tapping Retry.
- Full workout: all 8 slot results (3 / fail / 3 / 4 / fail / 3 / 3 / 6 sets)
  reached the server; day chip ✓, progress 8 of 8, volume card, "Next workout".
- GZCLP progression: T1 squat fail → next A1 shows 6 × 2 at the same weight; T2 projected +2.5 kg.
- Undo of a result whose server row does not exist gets a 404 and is treated as done (no stuck mutation).
- The code-drawn covers render in the hero, rows, detail sheet and thumbnails throughout.

## Screenshots

[huge weight accepted](./set-input-huge-weight.webp) ·
[sync needs attention](./sync-needs-attention.webp) ·
[after undo recovery](./after-undo-recovery.webp) ·
[sticky cached notice](./cached-notice-after-relaunch.webp) ·
[day complete](./day-complete.webp) ·
[offline queued](./offline-queued.webp) ·
[GZCLP starts at 2.5 kg](./gzclp-starts-at-2-5kg.webp) ·
[T1 fail progression](./gzclp-t1-fail-progression.webp) ·
[duplicate plans](./my-plans-duplicates.webp)

## Method and limits

Driven over `adb` (`input tap/text/swipe`, `uiautomator dump` for control
bounds, `svc wifi/data` + removing the `adb reverse` for the API to go offline,
`am force-stop` for kills). Server truth via `psql` on the local database and the
API request log. Not covered: a physical device, iOS, a development build (needed
to settle F6), multi-device conflicts, and the web app.
