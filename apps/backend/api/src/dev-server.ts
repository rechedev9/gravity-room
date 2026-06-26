/**
 * LOCAL-DEV-ONLY entrypoint.
 *
 * The Vercel production deployment never touches this file: it drives the API
 * through the serverless catch-all `api/[...path].ts`, which mounts the same
 * pure `createApp()` factory via `app.fetch(request)`. This module exists purely
 * so that local workflows still have a live HTTP server on `PORT`:
 *   - `bun run dev:api` (watch-mode local API on :3001),
 *   - the web `api:types` codegen and `context:refresh`, which fetch the
 *     OpenAPI spec from `http://localhost:3001/swagger/json`.
 *
 * It mirrors the env wiring of `api/[...path].ts` exactly (corsOrigins, csp,
 * permissionsPolicy) so the locally served app is byte-for-byte the serverless
 * app, then serves it with `Bun.serve({ fetch })`, the Bun-idiomatic listen
 * path. Removing the old `app.listen` from the production entrypoint (W4) is
 * what made this dedicated dev server necessary.
 */
import './lib/sentry';
import { createApp } from './create-app';
import { logger } from './lib/logger';

// ---------------------------------------------------------------------------
// Environment parsing - identical to api/[...path].ts so dev matches prod.
// ---------------------------------------------------------------------------

function parseCorsOrigins(raw: string | undefined): string | string[] {
  if (!raw) {
    // The web SPA is same-origin, so CORS is optional: same-origin requests are
    // never subject to CORS and native mobile clients are not browsers. When
    // CORS_ORIGIN is unset we allow no cross-origin in production (an empty
    // allow-list) and fall back to the local dev web origin in development.
    return process.env['NODE_ENV'] === 'production' ? [] : 'http://localhost:3000';
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

const CSP =
  "default-src 'self'; script-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; img-src 'self' data: blob: https://lh3.googleusercontent.com; connect-src 'self' https://accounts.google.com https://www.googleapis.com https://*.ingest.sentry.io; font-src 'self' https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; frame-src https://accounts.google.com; frame-ancestors 'none'";

const PERMISSIONS_POLICY =
  'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()';

// ---------------------------------------------------------------------------
// Build the app once and serve it on PORT (default 3001).
// ---------------------------------------------------------------------------

const app = createApp({
  corsOrigins: CORS_ORIGINS,
  csp: CSP,
  permissionsPolicy: PERMISSIONS_POLICY,
});

const PORT = Number(process.env['PORT']) || 3001;

Bun.serve({
  port: PORT,
  fetch: (request) => app.fetch(request),
});

logger.info({ port: PORT }, 'local dev API listening (serverless prod uses api/[...path].ts)');
