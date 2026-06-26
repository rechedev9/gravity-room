/**
 * Vercel Node-runtime catch-all for the API.
 *
 * Mounts the pure Elysia `createApp()` factory once at module scope and drives it
 * via the Web-standard `app.fetch(request)` adapter. The full `/api/...` request
 * URL is forwarded unchanged, so Elysia's `/api` route prefix and the
 * `/api/auth` refresh-cookie path are preserved end to end.
 *
 * Runs on the Vercel Node runtime (the default for files under `/api`), NOT Edge.
 */
import { createApp } from '../apps/backend/api/src/create-app';

// ---------------------------------------------------------------------------
// Environment parsing — mirrors the former bootstrap.ts wiring
// ---------------------------------------------------------------------------

function parseCorsOrigins(raw: string | undefined): string | string[] {
  if (!raw) {
    // The web SPA is now same-origin, so CORS is optional: same-origin requests
    // are never subject to CORS and native mobile clients are not browsers. When
    // CORS_ORIGIN is unset we therefore allow no cross-origin in production (an
    // empty allow-list) and fall back to the local dev web origin in development.
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
// Elysia app — built once per warm instance (lazy module-scope singleton)
// ---------------------------------------------------------------------------

const app = createApp({
  corsOrigins: CORS_ORIGINS,
  csp: CSP,
  permissionsPolicy: PERMISSIONS_POLICY,
});

/** Maximum accepted request body size — replaces Elysia's maxRequestBodySize. */
const MAX_BODY_BYTES = 1_048_576;

export default async function handler(request: Request): Promise<Response> {
  // Body-size guard: reject anything over 1MB before it reaches the app.
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return new Response(
        JSON.stringify({ error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' }),
        {
          status: 413,
          headers: { 'content-type': 'application/json' },
        }
      );
    }
  }

  // Forward the full, unmodified request (including the `/api/...` path) so
  // Elysia's route prefixes and cookie paths are preserved.
  return app.fetch(request);
}
