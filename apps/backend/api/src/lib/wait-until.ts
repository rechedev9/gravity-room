import { logger } from './logger';

/** Runs best-effort work past the Response; rejections are logged, never unhandled. */
export function keepAlive(promise: Promise<unknown>): void {
  void promise.catch((err: unknown) => {
    logger.warn({ err }, 'background task failed');
  });
}
