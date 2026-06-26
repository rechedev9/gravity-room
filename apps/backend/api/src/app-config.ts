/**
 * Shared application configuration.
 *
 * Single source of truth for the env-derived options passed to `createApp()`:
 * the CORS origin policy, the Content-Security-Policy string, and the
 * Permissions-Policy string. Both the serverless catch-all (`api/[...path].ts`)
 * and the local dev server (`src/dev-server.ts`) build their app through
 * `buildAppOptions()` so the locally served app is byte-for-byte the serverless
 * app, with no duplicated wiring to drift apart.
 */
import type { CreateAppOptions } from './create-app';

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

/**
 * Parse the comma-separated `CORS_ORIGIN` env value into the Elysia cors
 * `origin` shape.
 *
 * The web SPA is same-origin, so CORS is optional: same-origin requests are
 * never subject to CORS and native mobile clients are not browsers. When
 * `CORS_ORIGIN` is unset we therefore allow no cross-origin in production (an
 * empty allow-list) and fall back to the local dev web origin in development.
 */
export function parseCorsOrigins(raw: string | undefined): string | string[] {
  if (!raw) {
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

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

export const CSP =
  "default-src 'self'; script-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; img-src 'self' data: blob: https://lh3.googleusercontent.com; connect-src 'self' https://accounts.google.com https://www.googleapis.com https://*.ingest.sentry.io; font-src 'self' https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; frame-src https://accounts.google.com; frame-ancestors 'none'";

export const PERMISSIONS_POLICY =
  'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()';

// ---------------------------------------------------------------------------
// createApp options
// ---------------------------------------------------------------------------

/** Build the `createApp()` options from the current environment. */
export function buildAppOptions(): CreateAppOptions {
  return {
    corsOrigins: parseCorsOrigins(process.env['CORS_ORIGIN']),
    csp: CSP,
    permissionsPolicy: PERMISSIONS_POLICY,
  };
}
