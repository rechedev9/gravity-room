import * as Sentry from '@sentry/node';

const dsn = process.env['SENTRY_DSN'];

if (dsn) {
  const tracesSampleRate = Number(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1');
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    // Performance tracing: push-based traces replace the deleted pull metrics.
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
  });
}

/** Capture an exception in Sentry. No-op when SENTRY_DSN is not set. */
export function captureException(error: unknown): void {
  if (!dsn) return;
  Sentry.captureException(error);
}
