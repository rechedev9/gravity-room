import { Elysia } from 'elysia';
import { randomUUID } from 'crypto';
import type { Logger } from 'pino';
import { logger } from '../lib/logger';

/**
 * When TRUSTED_PROXY=true the API sits behind a trusted reverse proxy (on
 * Vercel the platform sets X-Forwarded-For with the real client IP as the
 * left-most entry). We then trust that header for rate-limit keying. Without
 * this flag we cannot trust client-supplied forwarding headers — there is no
 * socket address in a serverless runtime — so the IP is reported as 'unknown'
 * to prevent clients from spoofing their way past rate limits.
 */
const TRUSTED_PROXY = !!process.env['TRUSTED_PROXY'];

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
