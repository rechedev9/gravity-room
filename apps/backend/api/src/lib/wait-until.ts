import { logger } from './logger';

const pending = new Set<Promise<unknown>>();

/** Runs best-effort work past the Response; rejections are logged, never unhandled. */
export function keepAlive(promise: Promise<unknown>): void {
  const tracked = promise
    .catch((err: unknown) => {
      logger.warn({ err }, 'background task failed');
    })
    .finally(() => pending.delete(tracked));
  pending.add(tracked);
}

/** Waits for in-flight keepAlive work, giving up after timeoutMs. */
export async function drainKeepAlive(timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  await Promise.race([Promise.all(pending), timeout]);
  clearTimeout(timer);
}
