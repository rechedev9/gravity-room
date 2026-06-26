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
import { buildAppOptions } from '../apps/backend/api/src/app-config';

// ---------------------------------------------------------------------------
// Elysia app — built once per warm instance (lazy module-scope singleton).
// Env wiring (corsOrigins, csp, permissionsPolicy) is shared with the local dev
// server via app-config.ts so the two entrypoints can never drift apart.
// ---------------------------------------------------------------------------

const app = createApp(buildAppOptions());

/** Maximum accepted request body size — replaces Elysia's maxRequestBodySize. */
const MAX_BODY_BYTES = 1_048_576;

/** Methods that may carry a request body and are therefore size-guarded. */
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export default async function handler(request: Request): Promise<Response> {
  // Body-size guard: reject anything over 1MB before it reaches the app. For
  // body-bearing methods we fail CLOSED when content-length is missing or not a
  // finite number, so a chunked or header-less body cannot slip past the check.
  // Vercel's platform body cap (~4.5MB) is only the outer backstop.
  if (BODY_METHODS.has(request.method)) {
    const contentLength = request.headers.get('content-length');
    const declared = contentLength === null ? NaN : Number(contentLength);
    if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) {
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
