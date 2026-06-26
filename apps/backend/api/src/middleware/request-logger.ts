import { Elysia } from 'elysia';
import { randomUUID } from 'crypto';
import type { Logger } from 'pino';
import { logger } from '../lib/logger';

/**
 * Whether to trust the X-Forwarded-For header for rate-limit keying.
 *
 * On Vercel the platform terminates the connection and injects the real client
 * IP as the left-most X-Forwarded-For entry, so we trust it by default whenever
 * `VERCEL` is set (Vercel sets `VERCEL=1`). Off-Vercel the header is only
 * trusted when `TRUSTED_PROXY` is explicitly set, because there is no socket
 * address in a serverless runtime and an untrusted client could otherwise spoof
 * its way past rate limits — in that case the IP is reported as 'unknown'.
 */
const TRUSTED_PROXY = !!process.env['TRUSTED_PROXY'] || !!process.env['VERCEL'];

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
      const forwardedFor = request.headers.get('x-forwarded-for');
      const ip =
        TRUSTED_PROXY && forwardedFor
          ? (forwardedFor.split(',')[0]?.trim() ?? 'unknown')
          : 'unknown';
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
