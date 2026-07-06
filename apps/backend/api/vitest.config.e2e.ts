import { defineConfig } from 'vitest/config';

// Separate config for the DB-backed e2e suite (run via `pnpm --filter api
// test:e2e`). Kept out of the main vitest config so the default `test` run
// never tries to load the e2e files, which require a live Postgres.
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['test/e2e/**/*.test.ts'],
    // The e2e files share one Postgres database and truncate all tables
    // between tests; running files in parallel makes them wipe each other's
    // rows mid-test. Serialize the whole suite.
    fileParallelism: false,
    // Same rationale as vitest.config.ts: keep reporter output readable.
    env: {
      LOG_LEVEL: 'silent',
    },
  },
});
