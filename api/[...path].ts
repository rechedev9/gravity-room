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
// Elysia app — built once per warm instance (module-scope singleton).
// Env wiring (corsOrigins, csp, permissionsPolicy) is shared with the local dev
// server via app-config.ts so the two entrypoints can never drift apart.
// ---------------------------------------------------------------------------

const app = createApp(buildAppOptions());

/** Maximum accepted request body size — replaces Elysia's maxRequestBodySize. */
const MAX_BODY_BYTES = 1_048_576;

/** Methods that may carry a request body and are therefore size-guarded. */
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export default async function handler(request: Request): Promise<Response> {
  // Body-size guard: reject a request only when it DECLARES a body over 1MB. We
  // fail OPEN when content-length is absent or non-numeric, because legitimate
  // body-LESS requests (POST /api/auth/refresh, signout, DELETE /api/auth/me,
  // DELETE /programs/:id) often omit the header once a client or proxy drops it,
  // and a fail-closed guard would 413 them and break silent token refresh and
  // deletes. Vercel's ~4.5MB platform body cap is the backstop for header-less or
  // chunked bodies that have no declared content-length.
  if (BODY_METHODS.has(request.method)) {
    const contentLength = request.headers.get('content-length');
    const declared = contentLength === null ? NaN : Number(contentLength);
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
