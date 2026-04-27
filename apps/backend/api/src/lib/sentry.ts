import * as Sentry from '@sentry/bun';

const dsn = process.env['SENTRY_DSN'];

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    // Performance tracing disabled — not needed for a single-service app.
    tracesSampleRate: 0,
  });
}

/** Capture an exception in Sentry. No-op when SENTRY_DSN is not set. */
export function captureException(error: unknown): void {
  if (!dsn) return;
  Sentry.captureException(error);
}
