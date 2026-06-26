import { defineConfig } from 'vitest/config';

// Separate config for the DB-backed e2e suite (run via `pnpm --filter api
// test:e2e`). Kept out of the main vitest config so the default `test` run
// never tries to load the e2e files, which require a live Postgres.
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['test/e2e/**/*.test.ts'],
  },
});
