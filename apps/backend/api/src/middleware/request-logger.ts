import { Elysia } from 'elysia';
import { randomUUID } from 'crypto';
import type { Logger } from 'pino';
import { logger } from '../lib/logger';

/**
 * Whether to trust the X-Forwarded-For header for rate-limit keying.
 *
 * On Vercel the platform terminates the connection and injects the real client
 * IP as the LEFTMOST X-Forwarded-For entry, so we trust it whenever `VERCEL` is
 * set (Vercel sets `VERCEL=1`). Off-Vercel the header is only trusted when
 * `TRUSTED_PROXY=true` is explicitly set, and there the proxy appends the real
 * peer address, so the RIGHTMOST entry is the trustworthy one (anti-spoof).
 * When untrusted there is no socket address in a serverless runtime, so the IP
 * is reported as 'unknown' rather than a client-controlled value.
 *
 * The `=== 'true'` comparison is strict — `!!process.env['…']` would treat the
 * string "false" (and any other non-empty value) as truthy, silently enabling
 * proxy trust when an operator meant to disable it.
 */
const ON_VERCEL = !!process.env['VERCEL'];
const TRUSTED_PROXY = process.env['TRUSTED_PROXY'] === 'true' || ON_VERCEL;

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
    if (candidate) return candidate;
  }
  return undefined;
}

/** Regex for validating a client-supplied x-request-id before trusting it. */
const REQ_ID_RE = /^[\w-]{8,64}$/;

export const requestLogger = new Elysia({ name: 'request-logger' })
  .derive(
    { as: 'global' },
    ({ request }): { reqId: string; reqLogger: Logger; startMs: number; ip: string } => {
      const rawReqId = request.headers.get('x-request-id');
      const reqId = rawReqId && REQ_ID_RE.test(rawReqId) ? rawReqId : randomUUID();
      const method = request.method;
      const url = new URL(request.url).pathname;
      // Untrusted (no socket address in a serverless runtime): report 'unknown'
      // rather than a client-controlled value. When trusted on Vercel the real
      // client IP is the LEFTMOST x-forwarded-for entry; off-Vercel behind a
      // single proxy the RIGHTMOST entry is the trustworthy, anti-spoof one.
      let ip = 'unknown';
      if (TRUSTED_PROXY) {
        const xff = request.headers.get('x-forwarded-for');
        if (xff) {
          ip = ON_VERCEL
            ? (xff.split(',')[0]?.trim() ?? 'unknown')
            : (clientIpFromXff(xff) ?? 'unknown');
        }
      }
      const startMs = Date.now();
      const reqLogger = logger.child({ reqId, method, url, ip });
      reqLogger.info('incoming request');
      return { reqId, reqLogger, startMs, ip };
    }
  )
  .onAfterHandle({ as: 'global' }, ({ reqId, reqLogger, startMs, set }): void => {
    const status = typeof set.status === 'number' ? set.status : 200;
    set.headers['x-request-id'] = reqId;
    reqLogger.info({ status, latencyMs: Date.now() - startMs }, 'request completed');
  });
