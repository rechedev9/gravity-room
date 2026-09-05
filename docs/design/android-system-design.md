# Android system design: bottom-up assessment

Status: implementation and verification in progress. Baseline: `5bcbd6d` (mobile PR #130 merged).

## Scope and acceptance

Review infrastructure, server database, backend services, and Android storage/network lifecycle together. Implement the reliability improvements supported by the findings, then verify with actual SQLite/Postgres/API paths and Android process/network interruptions. Preserve the shared domain engine, same-origin Vercel deployment, generated web API client, and build-time migrations.

The target guarantees are:

1. A successful local workout edit atomically commits its result, draft cleanup, undo state, and delivery intent. Killing Android cannot leave a saved result without an outbox entry.
2. Delivery is bounded and recoverable: stalled requests release resources; retryable failures preserve data; permanent failures do not silently disappear or block unrelated plans indefinitely.
3. Server replay semantics and database constraints protect retries and concurrent clients, with explicit conflict behavior rather than an unsupported exactly-once claim.
4. Android reconnect/resume and session recovery have a documented ownership/lifetime model and runnable verification. No claim of background execution after force-stop.
5. Operational evidence covers the boundaries actually changed, including upgrade/rollback behavior and the deployed API artifact. Design decisions and deliberate limitations are recorded.

## Evidence by layer

| Layer                | Existing design and evidence                                                                                                                                | Finding / disposition                                                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Infrastructure       | `vercel.json`: one static SPA/API origin, 60-second function budget; `scripts/vercel-build.sh`: validate/build before advisory-locked production migrations | Preserve topology. Android clients can outlive API versions; changes must be additive. Client requests currently have no explicit deadline, so a stalled request can hold the replay worker indefinitely.                                                   |
| Runtime database     | `src/db/index.ts`: one postgres-js connection per warm instance, pooled endpoint, prepared statements disabled, statement timeout                           | Preserve small runtime pool and deployment-only DDL. Historical/RLS migration residuals remain governed by `docs/DATABASE_SECURITY_ROLLOUT.md`; do not silently tighten deployed contracts.                                                                 |
| Postgres schema      | `workout_results_instance_slot_uq`; parent and user locks; bounded undo history                                                                             | Result writes serialize and exact current-state replays are no-ops (`services/results.ts`). That is not a durable operation receipt: a delayed retry after another device writes can still replace newer state. Evaluate explicit replay/conflict contract. |
| Backend              | Rate limiting returns `Retry-After`; private responses use `no-store`; generation-based Redis cache invalidation                                            | Mobile replay currently treats most HTTP failures alike. Deleted plans/invalid payloads can block all later queued work. Preserve server ownership checks and expose recoverable client state.                                                              |
| Android SQLite       | Owner-partitioned caches/drafts/outbox; exclusive transactions; migration versions 1–5; shared per-owner/program in-process edit queue                      | Detail/draft cleanup and outbox insertion are separate commits. Process death or second-commit failure can lose delivery intent. Make the local write transaction the single success boundary.                                                              |
| Android replay       | Durable deduplicated outbox; account-bound flush controller; joined requests drain additional batches                                                       | Ordering uses wall-clock timestamps before row ID; clock rollback can reorder writes. No persisted failure classification or bounded attempt policy.                                                                                                        |
| Android auth         | Google token in SecureStore; email session in native cookie jar; refresh is single-flight; ownership validated before publication                           | Cold start needs a successful network refresh. Credentials survive transient failures but cached training is inaccessible offline. Distinguish offline availability from verified remote authorization explicitly.                                          |
| Android lifecycle    | Foreground/AppState sync and absolute-deadline rest timer; no background worker                                                                             | Foreground JavaScript is not a durable scheduler. Assess bounded foreground retry and an explicit offline startup policy; a WorkManager integration requires a native build and separate native execution evidence.                                         |
| Verification/release | CI typechecks/tests mobile; Android Expo Go flow tested; no Android binary build lane                                                                       | JS tests do not validate release manifests, native dependencies, or OS lifecycle. Record the available native evidence and native release-build gap accurately.                                                                                             |

## Implementation sequence

1. Transactional local workout/outbox repository and SQLite fault-injection tests.
2. Bounded network/replay lifecycle, ordered queue, and durable error handling.
3. Server retry/conflict contract and database invariants, with real database verification.
4. Android session/reconnect behavior and process-death verification; update operational/release guidance.
5. Review the full diff, resolve accepted findings, run relevant CI and record exact evidence.

Each step is a runnable checkpoint, not a redefinition of the overall objective. Findings may change the implementation where experiments justify it.

## External design references

Android recommends a local source of truth and persistent queues for offline-first data, with WorkManager for suitable persistent work: [Android offline-first architecture](https://developer.android.com/topic/architecture/data-layer/offline-first).
Expo's SDK 54 SQLite API provides exclusive transaction scopes; calls must use the transaction handle: [Expo SQLite](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/).

## Verification ledger

### Atomic local commit checkpoint

Implemented `commitTrackerEdit`: validates and snapshots input before awaiting,
then commits detail, undo state, completed-draft cleanup and the replacement
outbox row in one exclusive SQLite transaction. Cache hydration remains separate.
Replay starts only after commit and cannot convert a network error into a failed
local edit. Record, metric changes and Undo all use this boundary.

- Mobile: 259 tests / 30 suites passed; typecheck passed.
- Real file-backed SQLite: injected outbox insert failure rolls back snapshot and
  draft deletion; replacement failure preserves the previous outbox row; closing
  and reopening retains both result and delivery intent.
- Android Pixel 7/API 35, Expo Go: injected a trigger rejecting outbox insertion
  for the test Turtle plan. Final-set confirmation showed the save error; direct
  device SQLite queries returned `{}` results, two retained draft sets and zero
  queued mutations. Trigger removed immediately after the failure check.
- Disabled the emulator's API reverse port, confirmed the last set again: device
  SQLite held success with three set logs, zero remaining draft rows and one
  queued record. Force-stopped Expo Go: the three logs and queued row remained.
- Re-enabled API connection and reopened: the outbox drained to zero. Direct
  local PostgreSQL verification showed one result with all three logs and one
  undo entry. This covers the actual Android → HTTP API → PostgreSQL path.
- Playwright CLI captured Expo Web login with no browser console errors; session
  closed. This is visual/login evidence only, not authenticated web sync proof.
- Removed the device fault-injection trigger and returned adb to non-root mode.

Evidence: [failed local commit](../verification/android-system-design/atomic-failure-android.webp),
[offline commit](../verification/android-system-design/atomic-committed-android.webp),
[browser login](../verification/android-system-design/browser-login.webp).

The other acceptance criteria remain in progress; this checkpoint does not prove
the entire system-design objective complete.

### Bounded delivery checkpoint

The SQLite outbox now reads at most 50 rows per page in autoincrement ID order.
A full page requests another read; concurrent callers can request another drain
without their signal being overwritten by a pending database read. File-backed
SQLite tests cover 63 edits across a backwards wall-clock change.

All current mobile API fetches use a 20-second deadline covering headers and the
complete text/JSON body. The transport owns and removes its parent cancellation
listener and timer, aborts native fetch on timeout, and releases callers even if
a transport fails to settle after cancellation. Responses are buffered once to
retain the existing `Response.json()` interface. This transport is for finite
API bodies, not streaming or binary downloads. An authorized request can include
an initial request, refresh, and replay, each with its own bounded deadline.

The deadline does not imply that an aborted write was rolled back remotely;
durable server replay/conflict semantics remain part of the next checkpoint.

Verification: 266 mobile tests / 31 suites and mobile typecheck passed. On the
Android emulator, a local HTTP proxy held result requests without responding.
The native client closed two held connections after 20,005 ms and 20,009 ms.
After the second timeout, direct device SQLite inspection still showed the
`core_3` failure and its queued record. Restoring the API connection and resuming
the app drained the outbox to zero; direct local PostgreSQL inspection confirmed
that result. The proxy was stopped and adb returned to non-root mode.

### Server replay and release evidence

Two simultaneous, identical result POSTs against the local API/PostgreSQL both
returned 201, retained exactly three existing undo entries and left the result's
update timestamp unchanged. This verifies the existing exact-current-state replay
contract under the actual user/parent lock path. It does not establish durable
operation receipts or protection from a delayed old write after a different
client changes that slot. The accepted conflict policy and its limits are recorded below.

The production Android export succeeded locally with Hermes output (4.12 MB)
and the bundled program artwork. CI frontend now exports the production Android
bundle after mobile tests, using the production API origin as build configuration
without contacting production. This catches native-platform module/asset bundling
failures; it is not an APK/AAB build or a signed-device release check.

Review caught two regressions before shipping: a concurrent drain request could
be overwritten by the batch-size check, and tolerant hydration defaults could
silently erase invalid local writes. Both are corrected, with regression tests.
The shared domain write schema rejects invalid results, undo entries, config and
dates before the SQLite transaction, preserving the previous snapshot and intent.

After the strict-write correction: 270 mobile tests / 31 suites passed; mobile
and domain typechecks passed; all 110 domain tests passed. The checkpoint review (`codex review --base origin/main`) completed cleanly
on the first retry after one capacity interruption, using the same configured
model. No additional review was run after the clean result.

### Next checkpoint: retained failures and retry ownership

Planned invariants (not implemented by the bounded-transport checkpoint):

- A transport failure or permanent HTTP rejection never acknowledges a queued
  operation. Only a successful response, or the documented already-absent delete
  response, releases its row.
- Persist a bounded diagnostic code with the owner-scoped row. Preserve the local
  snapshot and serialized intent; do not store tokens or raw response bodies as
  diagnostics.
- A rejected mutation blocks later mutations for that plan during the drain, but
  other plans can progress. Keyset pagination must advance past retained failures
  without looping on a poisoned first page.
- Any remaining unsent intent must prevent remote cache hydration from replacing
  a locally edited snapshot. Existing tracker callers use a rejected flush as
  that signal; preserve the contract when classifying failures.
- The foreground scheduler owns its retry timer and AppState subscription. It
  must release them on unmount/account transition, honor server retry guidance,
  and never claim delivery after Android force-stop.
- Offline cold-start access requires a separately persisted, validated local
  identity. A transient network failure may expose that owner's cached training;
  an explicit authentication rejection or failed credential read must not.

Additional contract findings to resolve in the server/domain checkpoint:

- Domain AMRAP accepts up to 999 reps, whereas result HTTP/service validation
  caps it at 99. A mobile edit can therefore be locally valid and permanently
  rejected remotely. Use shared domain limits and exercise the HTTP boundary.
- Definitions permit 2,000 workouts, while persisted results currently accept
  only one-to-three-digit workout keys. Align the key schema with the shared
  workout bound so a valid long program cannot lose results during hydration.

### Shared limits and PostgreSQL checkpoint

Implemented shared `MAX_REPS` (999) across the domain and result/import HTTP and
service validation. Result keys now cover the full shared 2,000-workout definition
bound. Strict local writes retain four-digit workout results and queue them
without clearing earlier sessions.

Real HTTP testing exposed the old PostgreSQL 99-rep check after mock route/service
tests passed. Migration 0047 replaces both canonical result and previous-result
checks with the shared bound; the TypeScript database schema now represents these
checks. The migration was generated with `pnpm run db:generate` and then scoped to
these two checks. It retains historical refresh-token `family_id` nullability and
does not rebuild the unrelated active-email index. The generated snapshot retains
that deliberately deferred nullability, as required by the existing rollout plan.

Generation also exposed a pre-existing snapshot-chain collision: 0046 pointed to
0044 instead of 0045. Only its parent metadata reference was repaired; deployed
SQL and journal timestamps for existing migrations remain unchanged.

Verification and rollout:

- A real PostgreSQL test runs the actual migration against connection-owned temp
  tables with the canonical historical checks. It preserves 99, accepts 999/null
  and rejects -1/1000 for results and undo entries. It drops the temp tables and
  closes its connection. CI backend now provides an ephemeral PostgreSQL service
  and runs this fixture; ordinary local runs skip it without PG_CONTRACT_TEST_URL.
- Applied the migration through the normal advisory-locked `db:deploy` path on
  local PostgreSQL only. Initial testing corrected the historical undo-constraint
  name (renamed in 0035); the unshipped migration was reapplied from its restored
  local pre-migration state and verified again.
- Created a temporary GZCLP plan through HTTP: 999 reps returned 201; editing to 99
  returned 201 and stored previous 999; Undo returned 200 and restored 999; 1000
  returned 400. Direct PostgreSQL inspection confirmed 999 and one undo entry.
  Deleted the temporary QA plan through HTTP after verification.
- Regenerated the web API reference and serverless artifact. Web generation also
  reconciled pre-existing auth OpenAPI drift (12-character passwords and generic
  login failures); no generated file was hand-edited.
- Deploy the expanded database checks before the new API artifact (normal build
  order). Replacement validates existing rows while holding table locks. A code
  rollback must retain the expanded checks: narrowing back to 99 would reject
  legitimate rows written by the new client/API. No historical result rewrite is
  part of this migration.

Current contract checkpoint checks: 842 API tests passed (4 existing skips),
271 mobile tests passed, 116 domain tests passed, and 129 database tests passed
(8 existing optional skips; the new PostgreSQL constraint fixture ran and passed).
Repository typecheck/lint and API bundle drift check passed. The contract/database
checkpoint remains uncommitted and awaits review together with the remaining
retry/session work; the clean review above applies to commits through 5edc8e4.

### Retained outbox failures checkpoint

The drain no longer acknowledges malformed envelopes or permanent HTTP failures.
It retains their row, records a bounded diagnostic code, and blocks later writes
for that plan during the drain while permitting unrelated plans to progress.
Keyset paging advances past retained rows, including a full failed page. A failed
flush still rejects so callers cannot overwrite unsent local results with server
cache hydration. Transient errors and authentication errors continue to stop the
current drain; automatic retry scheduling and user-facing state remain pending.

SQLite migration 6 adds `last_error_code` and an owner/ID paging index. Diagnostics
belong to immutable row IDs: a stale request cannot mark a replacement, and a
request for another owner cannot mark this owner's row. File-backed tests verify
those properties and persistence across database reopening.

- 274 mobile tests / 31 suites passed; mobile typecheck passed.
- Android upgraded its existing SQLite database from version 5 to 6, retaining
  its cache and an empty outbox before fault injection.
- Inserted two owner-scoped QA intents on Android: a valid envelope targeting a
  nonexistent plan, then a valid result for a temporary GZCLP plan. The second
  intent had an older wall-clock timestamp to exercise ID ordering.
- On foreground resume, Android retained the first row with `HTTP_404`; the second
  row was acknowledged. PostgreSQL held the second plan's successful result and
  all five set logs.
- Force-stopped Expo Go: direct device SQLite inspection still showed the first
  row and its `HTTP_404` diagnostic. Removed only the injected QA rows/cache and
  deleted the temporary plan through HTTP; the outbox returned to zero. Restored
  adb to non-root mode and restored both development reverse ports.

This evidence covers preservation and independent-plan delivery, not the pending
retry supervisor, offline cold-start session policy, or user-visible recovery UI.

### Foreground retry checkpoint

SQLite migration 7 persists owner-wide retry deadlines and bounded exponential
attempt counts. Every drain checks the deadline before reading/sending the queue,
so a new edit cannot bypass a server pause. Retry-After accepts seconds or an HTTP
date. Backwards clock corrections rebase the stored remaining interval once.
Cancelled attempts cannot clear or replace newer backoff state.

An owner-scoped foreground supervisor owns its AppState subscription, sync-result
subscription and one retry timer. It retries transient failures, checks the queue
on resume, stops automatic retry for permanent rejections, and releases timers
and active requests on background/unmount. Long pauses use bounded timer chunks.
Expired/rejected authorization still requires session recovery; offline startup
and a user-visible sync/recovery state remain the next checkpoint.

Native verification:

- Pixel 7/API 35 upgraded to SQLite version 7. An intermediate, unshipped retry
  table had been created by Fast Refresh before its definition was finalized;
  reset only that empty QA table and version marker before testing the final
  migration. Training and queued edits were retained.
- A local proxy returned 429 with Retry-After: 15 for each QA slot's first attempt,
  then forwarded the retry to the real API. Foreground retry occurred after
  15,051 ms without user interaction; a cold-start case retried after 15,069 ms.
- Another case stayed in background for over 33 seconds with no second request;
  resuming then delivered the pending result.
- An early trace retried after about five seconds. Inspection identified a path
  that could lose Retry-After when SQLite persistence failed. Server guidance is
  now retained in memory before persistence as well as durably on success.
- Injected a native trigger rejecting backoff insertion. SQLite retained HTTP_429
  on the queued row but had no backoff row. Leaving/resuming the app did not bypass
  the memory pause; the retry occurred after 15,056 ms and completed successfully.
- PostgreSQL contained all five QA results and 25 set logs. Deleted the temporary
  plan, cache entries, audit table and all four QA triggers; outbox/backoff counts
  were zero. Stopped the proxy and restored normal API/Metro reverse ports and
  non-root adb.
- 284 mobile tests / 32 suites passed, including deadline scheduling, background
  cancellation, owner changes, persistence/reopening, clock rebasing, cancelled
  backoff writes, and storage-failure handling of server retry guidance.

The new supervisor/backoff implementation and retained-failure work await final
review with the remaining session/UI changes; prior clean review covered 5edc8e4.

### Offline startup and session recovery checkpoint

Only a typed session availability failure (native transport failure, deadline,
HTTP 408/429/5xx) permits cached startup. The secure cached display identity must
match the secure local-data owner. No access JWT is stored or invented for offline
mode. Missing credentials, explicit rejection, invalid responses, unreadable
identity and owner mismatch do not unlock cached startup. Verified online identity
is cached after ownership is prepared; failure to cache does not break online use.

The foreground supervisor can recover a tokenless cached session before draining
edits. Recovery may publish a token only while its subscription and local owner
remain current. Explicit rejection returns to sign-in while retaining training
for same-account reauthentication. Sign-out blocks new restores and waits for an
active, bounded refresh rotation before deleting credentials, preventing a late
rotation from recreating durable login state.

Native verification on Pixel 7/API 35:

- Restored online once, redirected only the Android API reverse port to an unused
  localhost port, force-stopped Expo Go and reopened the app. The existing Turtle
  workout opened from SQLite without contacting a reachable API.
- Recorded `act_4` as failed through the native tracker. SQLite contained the
  corresponding durable outbox row; PostgreSQL still had no result for the slot.
- Force-stopped/reopened again while disconnected. Training and the queued edit
  survived. [Cold-start screenshot](../verification/android-system-design/offline-cold-start.png).
- Restored the real API reverse port without backgrounding or restarting the app.
  The foreground recovery obtained authorization and automatically delivered the
  edit: PostgreSQL contained the failure and the native outbox count became zero.
- Used native Undo to remove that QA result and verified its absence in PostgreSQL.
  An intervening development Fast Refresh briefly displayed Tracker unavailable;
  Retry recovered it. Cold-process launches above used the actual startup path.
- A temporary localhost responder returned 401 to `/api/auth/refresh`. Cold launch
  showed sign-in; a subsequent cold launch with the API unreachable still showed
  sign-in, demonstrating that a rejected session did not regain cached access.
- Stopped the responder, restored API/Metro reverse ports and non-root adb, and
  signed back into the same development account; its existing training remained.
- 300 mobile tests / 32 suites passed; mobile typecheck passed. Tests cover identity
  ownership/validation, transient versus invalid auth, secure-storage failure,
  rotation versus sign-out, retry recovery and subscription retirement.

Visible sync/recovery UI and final review/PR/CI remain outstanding. This checkpoint
changes availability and credential lifetime; it does not add a native background
worker or claim that remote authorization can be verified while offline.

### Server conflict policy decision

Retain the existing replacement API: delivery is at least once and the last
accepted write to a workout slot wins. User/parent locks serialize writes; the
result and its set logs are one coherent transaction. Repeating exactly the
current state is a no-op. This is deliberately not a durable operation receipt:
a delayed retry may replace a different device's intervening edit, and Undo is
bounded recovery history rather than cross-device conflict resolution.

This release strengthens durable local intent, delivery order and failure
visibility without silently changing the shared web/mobile replacement contract.
Rejecting stale edits would require a version/precondition protocol across every
writer and an athlete-facing conflict resolution flow. That is a separate product
and API change; receipt retention alone would not resolve new conflicting edits.

Real local HTTP/PostgreSQL verification used a temporary GZCLP plan:

- Two concurrent different successes produced one coherent winner: AMRAP 4 with
  all five matching 4-rep/60-kg set logs and two undo entries, never a mixed result.
- Sent payload B, then delayed payload A: A became current, demonstrating the
  documented last-accepted-write behavior. Repeated A again: undo count stayed 3.
- Deleted the temporary plan through the API and revoked the QA cookie session.

Playwright CLI also rendered the mobile login viewport at 393 x 852 with zero
console errors; [screenshot](../verification/android-system-design/session-login-web.png).
The browser session was closed and temporary Playwright artifacts were removed.
Authenticated offline/reconnect proof above is native Android, not inferred from
this web login render.

Release checks at this checkpoint: repository typecheck/lint and API bundle drift
check passed. Android production export succeeded with the production HTTPS API
configuration, producing a 4.14 MB Hermes bundle and bundled program artwork.
This validates JS/assets export, not installation/signing of an APK or AAB; no
production API was called by the export.

### Review corrections for offline recovery

The first `codex review --uncommitted` accepted three P2 findings. Reproductions
used the production modules with SQLite/AppState fixtures, then were rerun after
fixes:

- Backwards clock correction: a roughly 5.2-second pause had become an hour because
  the memory fast path skipped durable rebasing. Both pauses now rebase together;
  the corrected reproduction retained 5.2 seconds, including the persistent row.
- Resume during a cancelled drain's refresh: the wake-up was dropped while the
  old worker was still running. A pending-run flag now starts a new drain after
  retirement; the reproduction delivered the retained row with the refreshed
  token and left the queue empty.
- Session refresh Retry-After: availability errors now carry the deadline, and a
  process-local auth cooldown guards immediate recovery and foreground resumes.
  The parser is shared with mutation delivery. The reproduction scheduled 60,000
  ms for Retry-After: 60. This auth cooldown is process-local; mutation delivery
  backoff remains durable in SQLite across process restarts.

Native verification also returned 429 with Retry-After: 15 for the cold-start
refresh, then forwarded subsequent requests to the real API. Background/resume
before the deadline did not send an early refresh: the next request arrived after
18,544 ms and recovered the cached account. Stopped the proxy and restored normal
API forwarding. The full mobile suite now passes 304 tests / 32 suites, with mobile
typecheck passing. The final review result is recorded below.

A further reproduction covered a direct edit-triggered flush while the supervisor
was idle: resume had joined the already-aborted request. The single-flight join
now rejects aborted workers. The production SQLite/AppState reproduction changed
from two requests/one retained row to three requests/zero retained rows. A dedicated
same-owner/same-token cancellation regression passes.

Final `codex review --uncommitted` exited 0 and reported no actionable findings in
the latest working tree, including that guard. No findings remain accepted or
unresolved. The final full mobile run passes 305 tests / 32 suites; mobile
typecheck and Android production export (4.14 MB Hermes) pass. Root typecheck/lint
and API bundle drift check passed earlier in the same checkpoint. Visible
sync/recovery UI, PR/CI/Bugbot and merge remain outstanding for the overall goal.
