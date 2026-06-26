/**
 * Serverless-durable background work.
 *
 * On Vercel a function may be frozen the instant its Response is returned, which
 * silently drops any in-flight background promise. `keepAlive` extends the
 * function's lifetime until `promise` settles by handing it to @vercel/functions'
 * `waitUntil`, so best-effort writes (presence heartbeats, rate-limit analytics
 * sync) are not lost.
 *
 * Off Vercel (local dev-server / tests) the process is long-lived and never
 * frozen, so we just attach a `.catch` to let the promise run to completion
 * without surfacing an unhandled rejection.
 *
 * `waitUntil` is only valid inside a request scope; if none is available it
 * throws, so we guard it and degrade gracefully to the fire-and-forget path.
 */
import { waitUntil } from '@vercel/functions';
import { logger } from './logger';

/**
 * Keep `promise` alive past the Response on Vercel; otherwise run it to
 * completion in the background. Rejections are swallowed (logged at warn).
 */
export function keepAlive(promise: Promise<unknown>): void {
  // Attach the rejection handler up front so neither path leaks an unhandled
  // rejection, and `waitUntil` receives a promise that never rejects.
  const settled = promise.catch((err: unknown) => {
    logger.warn({ err }, 'background task failed');
  });

  if (process.env['VERCEL']) {
    try {
      waitUntil(settled);
      return;
    } catch {
      // No request scope available — fall through to fire-and-forget.
    }
  }

  // Long-lived runtime (or no request scope): the `.catch` above already ensures
  // the promise runs to completion without an unhandled rejection.
  void settled;
}
