# Writing mobile SQLite regressions

Use `apps/frontend/mobile/testing/sqlite-adapter.cjs` to adapt a Node 24
`DatabaseSync` connection to the mobile async database interface. Existing draft,
atomic-edit, artwork and sync-status suites use it, as does the standalone
migration check. Tests execute production SQL and migrations rather than a
JavaScript interpretation of SQL strings.

```js
const { DatabaseSync } = require('node:sqlite');
const { createSqliteTestAdapter } = require('../../../testing/sqlite-adapter.cjs');
const sqlite = new DatabaseSync(':memory:');
const database = createSqliteTestAdapter(sqlite);
// Supply database to the production client and validate the test owner.
// Close sqlite in afterEach, including when the test fails.
```

The caller owns the connection, account setup, migrations, spies and cleanup.
Use a temporary file instead of `:memory:` when proving persistence across a
close/reopen. Keep the file inside a test-owned temporary directory and clean
it only after closing every connection.

Transactions commit only after the async callback settles. Callback and commit
failures roll back; a failed BEGIN must not roll back another transaction.
If rollback also fails, an `AggregateError` retains the original failure as
`cause` and includes both errors, so cleanup cannot conceal the first fault.

This adapter verifies SQL atomicity and preservation, not Expo's connection
scheduling or native background behavior. It deliberately does not introduce
automatic retry, statement serialization, or fake SQL success. Native changes
still need the relevant device flow.

Run `pnpm --filter mobile exec jest --runInBand testing` for the adapter contract,
the relevant repository suite for each change, and `pnpm run test:mobile:sqlite`
for shipped migrations. Mobile lint includes `testing/`; production static
imports of test adapters are forbidden by the lint gate.
