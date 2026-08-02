import type { ErrorInfo } from 'react';
import type * as SentryReact from '@sentry/react';
import { isRecord } from '@gzclp/domain/type-guards';

const dsn = import.meta.env.VITE_SENTRY_DSN;
// Absolute and root-relative URLs can appear inside arbitrary event text.
// Match the absolute form first so its path is not treated as a separate URL.
const EMBEDDED_URL_RE = /(?:https?:\/\/|\.\.?\/|\/(?!\/))[^\s"'<>]+/gi;
const SENSITIVE_METADATA_KEYS = new Set([
  'authorization',
  'body',
  'cookie',
  'cookies',
  'credential',
  'formdata',
  'hash',
  'password',
  'payload',
  'postdata',
  'query',
  'querystring',
  'query_string',
  'refreshtoken',
  'requestbody',
  'search',
  'token',
]);

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

function normalizeMetadataKey(key: string): string {
  return key.replace(/[^a-z]/gi, '').toLowerCase();
}

/** Removes every query parameter and fragment from an absolute or relative URL. */
export function sanitizeSentryUrl(value: string): string {
  const isRootRelative = value.startsWith('/');
  const isDotRelative = value.startsWith('./') || value.startsWith('../');
  const isAbsoluteHttp = /^https?:\/\//i.test(value);
  if (!isRootRelative && !isDotRelative && !isAbsoluteHttp) return value;
  try {
    const url = new URL(value, 'https://gravityroom.invalid/current/');
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    if (isRootRelative) return url.pathname;
    if (isDotRelative) {
      const separatorIndex = value.search(/[?#]/);
      return separatorIndex === -1 ? value : value.slice(0, separatorIndex);
    }
    return url.toString();
  } catch {
    return value;
  }
}

function sanitizeText(value: string): string {
  return value.replace(EMBEDDED_URL_RE, (url) => sanitizeSentryUrl(url));
}

function sanitizeStringMetadata(record: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeMetadataKey(key);
    if (SENSITIVE_METADATA_KEYS.has(normalizedKey)) continue;
    sanitized[key] =
      normalizedKey === 'url' || normalizedKey === 'href'
        ? sanitizeSentryUrl(value)
        : sanitizeText(value);
  }
  return sanitized;
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeText(value);
  if (Array.isArray(value)) return value.map(sanitizeMetadataValue);
  if (isRecord(value)) return sanitizeMetadata(value);
  return value;
}

function sanitizeMetadata(record: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeMetadataKey(key);
    if (SENSITIVE_METADATA_KEYS.has(normalizedKey)) continue;
    sanitized[key] =
      typeof value === 'string' && (normalizedKey === 'url' || normalizedKey === 'href')
        ? sanitizeSentryUrl(value)
        : sanitizeMetadataValue(value);
  }
  return sanitized;
}

export function sanitizeSentryBreadcrumb(
  breadcrumb: SentryReact.Breadcrumb
): SentryReact.Breadcrumb {
  if (breadcrumb.message) breadcrumb.message = sanitizeText(breadcrumb.message);
  if (breadcrumb.category) breadcrumb.category = sanitizeText(breadcrumb.category);
  if (breadcrumb.data) breadcrumb.data = sanitizeMetadata(breadcrumb.data);
  return breadcrumb;
}

function sanitizeExceptionMetadata(event: SentryReact.Event): void {
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = sanitizeText(exception.value);
    for (const frame of exception.stacktrace?.frames ?? []) {
      if (frame.filename) frame.filename = sanitizeSentryUrl(frame.filename);
    }
  }
}

/**
 * Last-line privacy filter for browser telemetry. It strips request bodies,
 * headers/cookies, query data, fragments, tokens, and URL query parameters from
 * both the event and its diagnostic metadata.
 */
export function sanitizeSentryEvent(event: SentryReact.Event): SentryReact.Event {
  if (event.request) {
    if (event.request.url) event.request.url = sanitizeSentryUrl(event.request.url);
    if (event.request.env) event.request.env = sanitizeStringMetadata(event.request.env);
    delete event.request.data;
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.headers;
  }
  if (event.message) event.message = sanitizeText(event.message);
  if (event.logentry?.message) event.logentry.message = sanitizeText(event.logentry.message);
  if (event.logentry?.params) {
    event.logentry.params = event.logentry.params.map(sanitizeMetadataValue);
  }
  if (event.transaction) event.transaction = sanitizeText(event.transaction);
  if (event.fingerprint) event.fingerprint = event.fingerprint.map(sanitizeText);
  if (event.tags) {
    for (const [key, value] of Object.entries(event.tags)) {
      if (SENSITIVE_METADATA_KEYS.has(normalizeMetadataKey(key))) {
        delete event.tags[key];
      } else if (typeof value === 'string') {
        event.tags[key] = sanitizeText(value);
      }
    }
  }
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(sanitizeSentryBreadcrumb);
  if (event.extra) event.extra = sanitizeMetadata(event.extra);
  if (event.contexts) {
    for (const [key, context] of Object.entries(event.contexts)) {
      if (context) event.contexts[key] = sanitizeMetadata(context);
    }
  }
  sanitizeExceptionMetadata(event);
  for (const span of event.spans ?? []) {
    if (span.description) span.description = sanitizeText(span.description);
    const sanitizedData = sanitizeMetadata(span.data);
    for (const key of Object.keys(span.data)) delete span.data[key];
    Object.assign(span.data, sanitizedData);
  }

  // Enforce pseudonymous identification even if a future caller accidentally
  // provides email, username, IP, or arbitrary user data.
  event.user = event.user?.id !== undefined ? { id: event.user.id } : undefined;
  return event;
}

export async function initSentryDeferred(): Promise<void> {
  if (!dsn || sentry) return;
  const mod = await import('@sentry/react');
  mod.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: (event) => {
      sanitizeSentryEvent(event);
      return event;
    },
    beforeBreadcrumb: sanitizeSentryBreadcrumb,
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

/** Set only the pseudonymous account ID in Sentry. Pass null to clear on sign-out. */
export function setUser(user: { readonly id: string } | null): void {
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
