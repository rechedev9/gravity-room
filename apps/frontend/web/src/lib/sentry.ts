import type { ErrorInfo } from 'react';
import type * as SentryReact from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

type Sentry = typeof SentryReact;

let sentry: Sentry | null = null;
const pendingCalls: Array<(sdk: Sentry) => void> = [];

function enqueueOrCall(fn: (sdk: Sentry) => void): void {
  if (sentry) {
    fn(sentry);
    return;
  }
  pendingCalls.push(fn);
}

export async function initSentryDeferred(): Promise<void> {
  if (!dsn || sentry) return;
  const mod = await import('@sentry/react');
  mod.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
  });
  sentry = mod;
  for (const fn of pendingCalls) fn(mod);
  pendingCalls.length = 0;
}

/** Capture a React exception in Sentry, including the component stack. No-op when VITE_SENTRY_DSN is not set. */
export function captureException(error: Error, errorInfo?: ErrorInfo): void {
  if (!dsn) return;
  enqueueOrCall((sdk) => {
    sdk.captureException(error, {
      extra: errorInfo ? { componentStack: errorInfo.componentStack } : undefined,
    });
  });
}

/** Set the active user in Sentry scope. Pass null to clear on sign-out. No-op when VITE_SENTRY_DSN is not set. */
export function setUser(user: { readonly id: string; readonly email: string } | null): void {
  if (!dsn) return;
  enqueueOrCall((sdk) => {
    sdk.setUser(user);
  });
}

/** Capture an unknown error from a catch block. Normalises non-Error values. No-op when VITE_SENTRY_DSN is not set. */
export function captureError(err: unknown): void {
  if (!dsn) return;
  enqueueOrCall((sdk) => {
    sdk.captureException(err instanceof Error ? err : new Error(String(err)));
  });
}
