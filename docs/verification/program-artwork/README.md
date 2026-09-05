# Program artwork and My plans

18 original covers generated with the built-in imagegen tool from the catalog's
actual descriptions and training background. [Gallery](./gallery.html),
[contact sheet](./gallery.webp), and [exact prompts](./prompts.json).

Assets: `apps/frontend/mobile/assets/programs/`. Each routine has a 960 × 640
WebP cover and 320 × 213 thumbnail. The collection is approximately 1.5 MB and
bundled by Metro for offline use. Lookup uses the stable program ID; renamed
instances keep their art. Unknown/custom programs use a neutral barbell fallback.
Migration 5 adds nullable artwork identity to existing owner-partitioned summaries.

My plans features the most recently updated plan, compact remaining plans,
localized dates, and a direct Explore entry. No inferred active state or invented
progress. Explore shows the same art in its featured card, all rows, and details.

## Verification

- Android Pixel 7 / API 35 / Expo Go: searched all 18 routines and opened/closed
  their detail sheets. Visually inspected the artwork collection and representative
  native covers and rows.
- Created Caparazón de Tortuga from its illustrated detail sheet. It opened Train;
  My plans displayed its matching cover and retained all three prior plans.
- Logged a set, opened the same plan through My plans, and verified the next set
  remained selected. One Train tracker now owns editing across all entry points;
  legacy workout deep links redirect there. A second set was logged, then Expo Go
  was force-stopped and reopened: both sets remained and set 3 was pending
  ([restart proof](./restored-android.webp)).
- Playwright CLI checked all 18 gallery images loaded. Console's only gallery error
  was the static server's missing favicon. Browser sessions were closed.
- Expo Web preview login was captured and its console reviewed. Local cross-origin
  auth initially failed CORS; a test-only request forwarder reached the API but
  login still failed during local session setup. This is not evidence of a working
  authenticated Expo Web flow. Android is the real application-path verification.
- Mobile suite: 238 tests / 27 suites pass, plus the focused router regression.
  Real SQLite verifies migration from version 4 retains rows and that renamed
  plans preserve artwork identity and account isolation.
- Initial Codex review found two actionable regressions: duplicate retained
  trackers and catalog creation replacing cached summaries. Both were fixed;
  router state preservation and creation without a summaries query have regression
  coverage. Final branch review and CI results are recorded in the PR.

Screenshots: [My plans](./my-plans-android.webp), [Explore](./explore-android.webp),
[details](./detail-android.webp), [created plan](./created-my-plans-android.webp),
[Train after creation](./created-android.webp), [Expo Web login](./expo-web-login.webp).

This supersedes the separate workout stack and naming described in earlier
verification checkpoints. The parent mesocycle domain/API work is still separate.

## Review fixes

The complete branch review additionally found early Fail dropping confirmed work,
ambiguous global draft Undo, and double-progression holds advancing weight.
Draft undo now belongs to each exercise (verified on Android); global Undo is
explicitly for completed results. Once sets exist, the user records remaining
actual sets rather than discarding them with a whole-exercise failure shortcut.
A serialized guard also rejects a stale queued shortcut.

The shared domain engine distinguishes recorded double-progression holds from
unrecorded projected workouts: 8 reps in a 6–12 range completes the session while
keeping weight; reaching 12 advances it. Domain regression tests verify both.
The serverless API bundle was regenerated.

Bugbot also identified optional summary payloads losing artwork identity.
Upserts now retain known IDs when the field is omitted; migration 5 backfills IDs
from each owner's cached program details. Real SQLite tests exercise both paths.

Final local checks before updating the PR: mobile 239 tests, domain 108 tests,
root typecheck, and generated API bundle drift check pass. The CI-only first
tracker-render timeout now waits for initial hydration before editing inputs.

The follow-up review found two further interactions: the completed-session summary
used hypothetical outcomes (discarding recorded holds), and a stalled outbox upload
held the local edit queue. The summary now reads the next matching slot from the
real computed rows. Mutation calls finish at durable outbox insertion and let the
account-bound replay service upload asynchronously. Regression tests cover a held
60 kg summary and enqueue/undo while replay remains pending. Mobile: 241 tests pass.
CI cold native rendering now uses a 5-second async assertion timeout.

Final follow-up fixes: AMRAP training-max updates consume logged reps with a
legacy-metric fallback (110 domain tests). A joined sync request drains another
queue snapshot before any caller refreshes server detail, covering edits made
during upload. Untouched set inputs follow refreshed prescriptions while explicit
edits remain intact. Train now distinguishes loading errors from an empty account
and offers Retry. Mobile: 243 tests / 28 suites pass.

Recovery review: accepting refreshed details now removes completed slots from the
in-memory draft snapshot, matching SQLite. Final-set editors remain mounted until
the completion write commits, so delayed storage failures preserve entered values.
An unavailable tracker offers Retry without remounting. Three regression tests
cover these paths. Android verification opened an unavailable plan, tapped Retry,
and returned through My plans to the existing Turtle workout with its saved draft
intact ([error-state screenshot](./retry-android.webp)).

Bugbot's subsequent concurrency finding is covered by a paused final-set write
followed by a metric edit on a different workout. All local edits now share the
same queue and metric changes read the current snapshot when they execute. Both
completed results survive; a queued edit after a storage failure uses the restored
value. Tracker suite: 40 tests pass.

AMRAP compatibility: final-set completion mirrors logged reps into the existing
API analytics metric for domain-marked AMRAP slots. Metric controls prioritize
logged reps over legacy metadata, matching the displayed value. Regressions cover
an eight-rep upload and incrementing displayed eight reps to nine despite stale
legacy metadata. Tracker suite: 41 tests pass.

Navigation refresh: local edits cancel older detail queries before committing.
Returning to Train refreshes remote detail after pending local edits, while keeping
the mounted editor and in-memory drafts. Tests cover A→B→A with an obsolete GET,
a replacement request after cancellation, and retaining edited weight across
focus refresh without rereading SQLite. Android My plans→Turtle also retains its
recorded set and pending next set after the refresh.

Undo is disabled while local edits are pending and enabled once the local queue
settles. It always targets committed history; neither a failed write nor an edit
waiting in the queue can redirect its target. The network upload remains detached
from this queue. Regressions cover pending failure and multiple queued increments
followed by Undo after commit. All 46 tracker tests pass.

Final data consistency: editing logged reps persists and uploads the result derived
by the shared domain engine, including changing success to failure. My plans
refreshes summaries on focus. Tracker/router regressions cover both; 60 tests pass.

Completion and queue ownership: the shared domain engine now determines initial
completion as well as later metric edits, including first-set progression with
backoff sets. Pending local writes share a user/program queue across tracker
remounts; hydration waits for that queue. Entries are released when settled and
failed writes do not block later edits. Tests cover backoff completion, a pending
draft across A→B→A, failure recovery, and independent user partitions.
