import { Elysia } from 'elysia';
import { randomUUID } from 'crypto';
import { isIP } from 'node:net';
import type { Logger } from 'pino';
import { logger } from '../lib/logger';

// Strict `=== 'true'`, so "false" never enables X-Forwarded-For trust for
// rate-limit keying; the edge Caddy appends the real peer as the rightmost entry.
const TRUSTED_PROXY = process.env['TRUSTED_PROXY'] === 'true';

/**
 * Extracts the client IP from an X-Forwarded-For header behind exactly one
 * trusted proxy. The proxy appends the connecting peer's address, so the
 * RIGHTMOST entry is the address our proxy actually observed. Reading the
 * leftmost entry (as a naive `.split(',')[0]` does) trusts a value the client
 * fully controls — an attacker rotating `X-Forwarded-For: <random>` would mint
 * a fresh rate-limit bucket per request and bypass the limiter entirely.
 */
export function clientIpFromXff(xff: string): string | undefined {
  const parts = xff.split(',');
  for (let i = parts.length - 1; i >= 0; i--) {
    const candidate = parts[i]?.trim();
    if (candidate && isIP(candidate) !== 0) return candidate;
  }
  return undefined;
}

/**
 * Derives the trustworthy client IP for rate-limit keying from request headers.
 * Without a trusted proxy there is no trustworthy address, so it reports 'unknown'
 * rather than a client-controlled value.
 */
export function deriveClientIp(headers: Headers, trustedProxy: boolean): string {
  if (trustedProxy) {
    const xff = headers.get('x-forwarded-for');
    if (xff) return clientIpFromXff(xff) ?? 'unknown';
  }
  return 'unknown';
}

/**
 * Resolve the status that will actually be sent to the client.
 *
 * Elysia leaves `set.status` at its default 200 when a handler returns a native
 * Response (including `redirect()` and explicit body-less 204 responses). The
 * returned Response is authoritative in that case; logging only `set.status`
 * makes successful OAuth redirects and sign-outs look like ordinary 200s.
 */
export function resolveResponseStatus(
  responseValue: unknown,
  setStatus: number | string | undefined
): number | string {
  if (responseValue instanceof Response) return responseValue.status;

  // The Node gateway and Elysia can construct standards objects in different
  // JavaScript realms. `instanceof Response` is false across that boundary even
  // though the object is a genuine Fetch Response, so use its stable interface
  // as the fallback brand check.
  if (typeof responseValue === 'object' && responseValue !== null) {
    const status = Reflect.get(responseValue, 'status');
    const headers = Reflect.get(responseValue, 'headers');
    const clone = Reflect.get(responseValue, 'clone');
    if (
      typeof status === 'number' &&
      Number.isInteger(status) &&
      status >= 200 &&
      status <= 599 &&
      typeof headers === 'object' &&
      headers !== null &&
      typeof clone === 'function'
    ) {
      return status;
    }
  }

  return setStatus ?? 200;
}

/** Regex for validating a client-supplied x-request-id before trusting it. */
const REQ_ID_RE = /^[\w-]{8,64}$/;

/** Parse a request pathname without letting malformed/early gateway URLs break logging. */
export function safeRequestPath(rawUrl: string): string {
  try {
    return new URL(rawUrl, 'http://localhost').pathname;
  } catch {
    return '/<invalid-url>';
  }
}

function validRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQ_ID_RE.test(value);
}

function earlyResponse(
  responseValue: unknown,
  status: number | string,
  setHeaders: Readonly<Record<string, string | number>>
): Response {
  if (responseValue instanceof Response) return responseValue;

  const headers = new Headers();
  for (const [name, value] of Object.entries(setHeaders)) headers.set(name, String(value));
  if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8');
  const numericStatus = typeof status === 'number' ? status : Number(status);
  return new Response(JSON.stringify(responseValue ?? null), {
    status: Number.isInteger(numericStatus) ? numericStatus : 500,
    headers,
  });
}

export const requestLogger = new Elysia({ name: 'request-logger' })
  .derive(
    { as: 'global' },
    ({ request }): { reqId: string; reqLogger: Logger; startMs: number; ip: string } => {
      const rawReqId = request.headers.get('x-request-id');
      const reqId = rawReqId && REQ_ID_RE.test(rawReqId) ? rawReqId : randomUUID();
      const method = request.method;
      // Fails closed to a stable placeholder on a malformed URL, because
      // observability must never become the error source.
      const url = safeRequestPath(request.url);
      const ip = deriveClientIp(request.headers, TRUSTED_PROXY);
      const startMs = Date.now();
      const reqLogger = logger.child({ reqId, method, url, ip });
      reqLogger.info('incoming request');
      return { reqId, reqLogger, startMs, ip };
    }
  )
  .mapResponse({ as: 'global' }, ({ reqId, reqLogger, startMs, set, responseValue, request }) => {
    // Elysia can reach mapResponse for unmatched or very-early failures before
    // derive() populated its context. Never assume those fields exist, or a
    // harmless 404 turns into a thrown error.
    const hasDerivedContext = validRequestId(reqId) && reqLogger !== undefined;
    const responseReqId = validRequestId(reqId) ? reqId : randomUUID();
    const responseLogger =
      reqLogger ??
      logger.child({
        reqId: responseReqId,
        method: request.method,
        url: safeRequestPath(request.url),
        ip: deriveClientIp(request.headers, TRUSTED_PROXY),
      });
    const status = resolveResponseStatus(responseValue, set.status);
    const latencyMs = typeof startMs === 'number' ? Date.now() - startMs : undefined;
    set.headers['x-request-id'] = responseReqId;
    responseLogger.info({ status, latencyMs }, 'request completed');

    // On early/unmatched paths Elysia may interpret an empty mapResponse return
    // as an empty replacement body. Materialize the response explicitly there;
    // normal routed requests retain Elysia's original response pipeline.
    if (!hasDerivedContext) return earlyResponse(responseValue, status, set.headers);
  });
