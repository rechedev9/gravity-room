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
client changes that slot; that conflict policy remains under assessment.

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
