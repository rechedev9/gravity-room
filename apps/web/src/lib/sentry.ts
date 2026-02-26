import * as Sentry from '@sentry/react';
import type { ErrorInfo } from 'react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Performance tracing disabled — not needed for a single-service app.
    tracesSampleRate: 0,
  });
}

/** Capture a React exception in Sentry, including the component stack. No-op when VITE_SENTRY_DSN is not set. */
export function captureException(error: Error, errorInfo?: ErrorInfo): void {
  if (!dsn) return;
  Sentry.captureException(error, {
    extra: errorInfo ? { componentStack: errorInfo.componentStack } : undefined,
  });
}

/** Set the active user in Sentry scope. Pass null to clear on sign-out. No-op when VITE_SENTRY_DSN is not set. */
export function setUser(user: { readonly id: string; readonly email: string } | null): void {
  if (!dsn) return;
  Sentry.setUser(user);
}
