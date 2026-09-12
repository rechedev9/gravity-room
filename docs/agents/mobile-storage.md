# Mobile SQLite changes

The Expo app owns its offline SQLite database in
`apps/frontend/mobile/src/lib/db`. This is separate from the API's Postgres
schema in `packages/database`. Never add mobile tables to the server migration
history or server tables to the mobile history.

## Initialization contract

`client.ts` owns the stable Expo connection and account binding.
`migration-runner.ts` owns migration validation and initialization coordination.
It has no runtime dependency on Expo, React Native, authentication, or networking.
Its `DatabaseClient` import is type-only, so the runner can be exercised on real
SQLite without loading the app runtime.

Every connection shares one initialization attempt. Concurrent repositories wait
for that attempt before using tables. A failed attempt is evicted and can be
retried; each successful schema step and its `user_version` update commit in the
same transaction. An appended history waits for the previous initialization
before upgrading. Rewriting or removing existing steps is rejected.

Migration versions start at 1 and are consecutive. Append new steps in
`migrations.ts`; never modify a shipped migration. Empty SQL, gaps, duplicate
versions, invalid stored versions, and databases newer than the app fail before
DDL. An older app must not silently open a newer database it cannot understand.

## Verification

- `pnpm --filter mobile exec jest --runInBand src/lib/db` checks coordination,
  invalid histories, retries, and account binding.
- `pnpm run test:mobile:sqlite` uses Node 24's real in-memory SQLite to verify
  shipped DDL, concurrent initialization, upgrade data preservation, rollback,
  and refusal to downgrade.
- `pnpm --filter mobile typecheck` checks the app-facing database contract.

The Node check verifies SQL and transaction semantics. It does not establish
device-level Expo SQLite behavior; native storage changes still need the
appropriate device flow. Account-scoped repositories must continue to capture
the validated owner before asynchronous operations.

## Owner activation

`local-data-owner.ts` is the pure in-memory ownership controller. `client.ts`
retains the public repository helpers and supplies SQLite bootstrap as the
validation callback. Starting activation disables the prior partition until
validation succeeds. Deactivation or any newer activation invalidates pending
attempts; a late result rejects instead of publishing a stale owner. A failed
new attempt must not restore an older account.

This controller does not own credentials, durable owner markers, or the whole
authentication transition. Those remain in the auth layer. Do not infer login
success from the owner controller alone, and do not catch a superseded activation
as if ownership had been successfully published. Test concurrent completion with
deferred validation callbacks; the database client tests verify the actual
bootstrap wiring too.

## Cache operation lifetimes

Summary snapshots and program definitions capture their serialized write inputs
before awaiting SQLite initialization. Mutating a caller's objects after starting
a write cannot alter its cache result. Summary replacement (including an empty
snapshot) and definition writes validate the captured owner before and after
transaction work, so an intervening account change rolls the transaction back.

Summary, detail and definition reads recheck ownership after fetching rows and
before returning either data or an empty result. These guards supplement UI
request generations; callers must still prevent old network responses from
starting new cache writes under a replacement account. They do not coordinate
credential storage or replace the authenticated shell's transition workflow.

`program-cache-lifecycle.test.js` exercises these boundaries through production
migrations and real SQLite, including populated stale reads and partial writes.

Summary pruning loads only existing IDs for the captured owner, computes removals
against the immutable incoming snapshot, and deletes at most 200 IDs per SQL
statement. It never binds an entire fetched catalog into a single `NOT IN` query.
Pruning and upserts remain one exclusive transaction, so later batch or insert
failures restore the entire previous snapshot. Retained rows keep their optional
artwork identity when an older API response omits it. The repository test suite
uses real SQLite, including a 33,000-row replacement beyond its bind limit.
