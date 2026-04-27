import { Elysia } from 'elysia';
import { randomUUID } from 'crypto';
import type { Logger } from 'pino';
import { logger } from '../lib/logger';

/**
 * When TRUSTED_PROXY=true the server sits behind a reverse proxy (nginx, Caddy,
 * Fly.io proxy, etc.) that overwrites X-Forwarded-For with the real client IP.
 * Without this flag we always use the direct socket address to prevent clients
 * from spoofing their IP and bypassing rate limits.
 */
const TRUSTED_PROXY = !!process.env['TRUSTED_PROXY'];

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
      const rawIp = TRUSTED_PROXY ? (request.headers.get('x-forwarded-for') ?? socketIp) : socketIp;
      const ip = rawIp.split(',')[0]?.trim() ?? 'unknown';
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
