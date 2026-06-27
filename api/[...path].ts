/**
 * Vercel Node-runtime catch-all for the API.
 *
 * Vercel's Node runtime invokes the default export with Node's
 * (IncomingMessage, ServerResponse) — NOT a Web `Request` — so calling
 * `app.fetch(request)` directly fails (req.url is a bare path, req.headers has no
 * `.has()`). We bridge with `@hono/node-server`'s `getRequestListener`, which
 * builds a proper Web `Request` from the Node request, runs our Elysia
 * `app.fetch`, and streams the Web `Response` back to the Node response. This is
 * the same adapter the local dev server (src/dev-server.ts) uses, so the two
 * entrypoints share identical request/response semantics.
 *
 * The full `/api/...` request URL is preserved end to end, so Elysia's `/api`
 * route prefix and the `/api/auth` refresh-cookie path keep working.
 */
import { getRequestListener } from '@hono/node-server';
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

/**
 * Web-standard fetch handler: body-size guard, then the Elysia app. Receives a
 * real Web `Request` (built by getRequestListener) and returns a Web `Response`.
 */
async function handleFetch(request: Request): Promise<Response> {
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

  return app.fetch(request);
}

// Vercel calls this with Node's (req, res); getRequestListener does the Node<->Web
// conversion around handleFetch.
export default getRequestListener(handleFetch);
