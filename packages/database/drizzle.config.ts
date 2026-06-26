import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './migrations',
  schema: './src/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    // DDL runs against the direct (non-pooled) Neon endpoint. Falls back to
    // DATABASE_URL for local dev where only one endpoint is configured.
    url:
      process.env['DIRECT_DATABASE_URL'] ??
      process.env['DATABASE_URL'] ??
      (() => {
        throw new Error('DIRECT_DATABASE_URL or DATABASE_URL env var is not set');
      })(),
  },
});
