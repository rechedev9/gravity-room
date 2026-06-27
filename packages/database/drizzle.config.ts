import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './migrations',
  schema: './src/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    // DDL runs against the direct (non-pooled) endpoint. Prefers an explicit
    // DIRECT_DATABASE_URL, then the Neon/Vercel integration's auto-provisioned
    // DATABASE_URL_UNPOOLED, then DATABASE_URL for local dev with one endpoint.
    url:
      process.env['DIRECT_DATABASE_URL'] ??
      process.env['DATABASE_URL_UNPOOLED'] ??
      process.env['DATABASE_URL'] ??
      (() => {
        throw new Error(
          'DIRECT_DATABASE_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL env var is not set'
        );
      })(),
  },
});
