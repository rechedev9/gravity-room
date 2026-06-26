import './lib/sentry';
import { createApp } from './create-app';

// ---------------------------------------------------------------------------
// Environment parsing
// ---------------------------------------------------------------------------

function parseCorsOrigins(raw: string | undefined): string | string[] {
  if (!raw) {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('CORS_ORIGIN env var must be set in production');
    }
    return 'http://localhost:3000';
  }
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const origin of origins) {
    try {
      new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGIN contains invalid URL: "${origin}"`);
    }
  }
  const first = origins[0];
  return origins.length === 1 && first !== undefined ? first : origins;
}

const CORS_ORIGINS = parseCorsOrigins(process.env['CORS_ORIGIN']);

// ---------------------------------------------------------------------------
// Content-Security-Policy — applied to all responses
// ---------------------------------------------------------------------------

const CSP =
  "default-src 'self'; script-src 'self' https://accounts.google.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; img-src 'self' data: blob: https://lh3.googleusercontent.com; connect-src 'self' https://accounts.google.com https://www.googleapis.com https://*.ingest.sentry.io; font-src 'self' https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src https://accounts.google.com; frame-ancestors 'none'; upgrade-insecure-requests";

const PERMISSIONS_POLICY: string =
  'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()';

// ---------------------------------------------------------------------------
// Elysia app — built via the pure factory and exported.
//
// No DDL, seeding, or listen side effects run at import time: database
// migrations and reference seeding live in the standalone deploy step
// (`src/scripts/migrate-deploy.ts`, `bun run db:deploy`), and serving is owned
// by the runtime entrypoint rather than this module.
// ---------------------------------------------------------------------------

export const app = createApp({
  corsOrigins: CORS_ORIGINS,
  csp: CSP,
  permissionsPolicy: PERMISSIONS_POLICY,
});
