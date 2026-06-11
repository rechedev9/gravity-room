import { Elysia } from 'elysia';
import { randomUUID } from 'crypto';
import type { Logger } from 'pino';
import { logger } from '../lib/logger';

/**
 * When TRUSTED_PROXY=true the server sits behind a single reverse proxy (nginx,
 * Caddy, Fly.io proxy, etc.) that appends the real client IP to X-Forwarded-For.
 * Without this flag we always use the direct socket address to prevent clients
 * from spoofing their IP and bypassing rate limits.
 *
 * Comparison is strict against the literal 'true' — `!!process.env['…']` would
 * treat the string "false" (and any other non-empty value) as truthy, silently
 * enabling proxy trust when an operator meant to disable it.
 */
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
    if (candidate) return candidate;
  }
  return undefined;
}

/** Regex for validating a client-supplied x-request-id before trusting it. */
const REQ_ID_RE = /^[\w-]{8,64}$/;

export const requestLogger = new Elysia({ name: 'request-logger' })
  .derive(
    { as: 'global' },
    ({ request, server }): { reqId: string; reqLogger: Logger; startMs: number; ip: string } => {
      const rawReqId = request.headers.get('x-request-id');
      const reqId = rawReqId && REQ_ID_RE.test(rawReqId) ? rawReqId : randomUUID();
      const method = request.method;
      const url = new URL(request.url).pathname;
      const socketIp = server?.requestIP(request)?.address ?? 'unknown';
      let ip = socketIp;
      if (TRUSTED_PROXY) {
        const xff = request.headers.get('x-forwarded-for');
        ip = (xff && clientIpFromXff(xff)) || socketIp;
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
