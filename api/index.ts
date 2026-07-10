/**
 * Vercel Node-runtime catch-all for the API.
 *
 * Vercel's Node runtime invokes the default export with Node's
 * (IncomingMessage, ServerResponse) — NOT a Web `Request`. We bridge to Elysia's
 * Web-standard `app.fetch` with a MANUAL Node handler instead of
 * `@hono/node-server`'s `getRequestListener`.
 *
 * Why manual: getRequestListener wraps the Node request body in a Web
 * `ReadableStream` that, on the Vercel Node runtime, is never driven — so Elysia's
 * body parsing blocks forever on any request that carries a body (POST/PUT/PATCH).
 * GETs (no body) work, writes hang ~30s and return nothing. The fix is to read the
 * ENTIRE body from the NATIVE Node stream into a single Buffer up front, then hand
 * that materialized buffer to `app.fetch`.
 *
 * The full `/api/...` request URL is preserved end to end, so Elysia's `/api`
 * route prefix and the `/api/auth` refresh-cookie path keep working.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../apps/backend/api/src/create-app';
import { buildAppOptions } from '../apps/backend/api/src/app-config';
import {
  PayloadTooLargeError,
  declaredBodyTooLarge,
  readLimitedBody,
} from '../apps/backend/api/src/lib/node-request-body';

// ---------------------------------------------------------------------------
// Elysia app — built once per warm instance (module-scope singleton).
// Env wiring (corsOrigins, csp, permissionsPolicy) is shared with the local dev
// server via app-config.ts so the two entrypoints can never drift apart.
// ---------------------------------------------------------------------------

const app = createApp(buildAppOptions());

/** Maximum accepted request body size — replaces Elysia's maxRequestBodySize. */
const MAX_BODY_BYTES = 1_048_576;

function sendPayloadTooLarge(res: ServerResponse): void {
  res.statusCode = 413;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' }));
}

/**
 * Vercel Node-runtime handler. Materializes the request body from the native Node
 * stream BEFORE calling `app.fetch`, which is what keeps body-bearing requests
 * from hanging forever on the Vercel runtime.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';

  // Read the body off the native Node stream up front (the key fix). GET/HEAD
  // carry no body, so we skip the read for them.
  let body: Buffer | undefined;
  if (hasBody) {
    const contentLength = Array.isArray(req.headers['content-length'])
      ? req.headers['content-length'][0]
      : req.headers['content-length'];
    if (declaredBodyTooLarge(contentLength, MAX_BODY_BYTES)) {
      sendPayloadTooLarge(res);
      return;
    }
    try {
      body = await readLimitedBody(req, MAX_BODY_BYTES);
    } catch (error: unknown) {
      if (error instanceof PayloadTooLargeError) {
        sendPayloadTooLarge(res);
        return;
      }
      throw error;
    }
  }

  // Build a Web `Request` from the Node request. req.url is a bare path, so we
  // reconstruct the absolute URL from the host header.
  const url = `https://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const request = new Request(url, {
    method,
    headers,
    ...(hasBody ? { body } : {}),
  });

  const response = await app.fetch(request);

  // Write the Web `Response` back to the Node response. Preserve MULTIPLE
  // Set-Cookie headers (refresh-token rotation sets two cookies), which a plain
  // forEach would otherwise collapse into one.
  res.statusCode = response.status;
  const cookies = response.headers.getSetCookie();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    res.setHeader(key, value);
  });
  if (cookies.length > 0) {
    res.setHeader('set-cookie', cookies);
  }

  res.end(Buffer.from(await response.arrayBuffer()));
}
