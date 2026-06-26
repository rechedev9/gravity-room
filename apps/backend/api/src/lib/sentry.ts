import * as Sentry from '@sentry/node';

const dsn = process.env['SENTRY_DSN'];

if (dsn) {
  // Treat an empty / whitespace-only SENTRY_TRACES_SAMPLE_RATE as unset: Number('')
  // is 0, which would silently disable tracing when the var is present-but-blank.
  // Fall back to 0.1 for unset/blank/NaN values.
  const rawRate = process.env['SENTRY_TRACES_SAMPLE_RATE']?.trim();
  const parsedRate = rawRate ? Number(rawRate) : Number.NaN;
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    // Performance tracing: push-based traces replace the deleted pull metrics.
    tracesSampleRate: Number.isFinite(parsedRate) ? parsedRate : 0.1,
  });
}

/** Capture an exception in Sentry. No-op when SENTRY_DSN is not set. */
export function captureException(error: unknown): void {
  if (!dsn) return;
  Sentry.captureException(error);
}

/**
 * Flush queued Sentry events. @sentry/node delivers events asynchronously, so on a
 * serverless platform that may freeze the function the moment its Response is
 * returned, an in-flight 500 event would be dropped. Awaiting this flush (via
 * keepAlive) keeps delivery alive until it completes or the timeout elapses.
 * Resolves immediately when Sentry is not enabled.
 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!dsn) return;
  await Sentry.flush(timeoutMs);
}
