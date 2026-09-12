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
