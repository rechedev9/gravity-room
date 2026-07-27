import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

const RELOAD_KEY = 'chunk-reload-ts';
const RELOAD_COOLDOWN_MS = 10_000;

/**
 * Detects stale-chunk errors thrown when a dynamic import fetches a JS file
 * that no longer exists on the server (typically after a new deploy).
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  const msg = error.message;
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk')
  );
}

/**
 * Handles a chunk load failure: reloads the page once, or throws if
 * we already reloaded recently (preventing infinite loops).
 */
export function handleChunkError(error: unknown): never {
  // A missing chunk while offline is not evidence of a stale deployment.
  // Reloading would discard the current React tree and cannot restore network
  // access, so let the route error boundary preserve the rest of the session.
  if (!navigator.onLine) {
    throw error;
  }

  let lastReload: string | null;
  try {
    lastReload = sessionStorage.getItem(RELOAD_KEY);
  } catch {
    // Storage can be blocked by browser privacy settings. Without a durable
    // cooldown marker, reloading here could create an infinite reload loop.
    throw error;
  }
  const now = Date.now();

  if (lastReload && now - Number(lastReload) < RELOAD_COOLDOWN_MS) {
    throw error;
  }

  try {
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    throw error;
  }
  window.location.reload();

  // Unreachable in practice (reload navigates away), but satisfies the type
  throw error;
}

/**
 * Wraps `React.lazy` with automatic page reload on stale-chunk errors.
 *
 * When a deploy invalidates cached chunk URLs, the first failed import
 * triggers a full page reload (fetching new HTML with correct hashes).
 * A sessionStorage guard prevents infinite reload loops — if we already
 * reloaded within the last 10 seconds, the error propagates to the
 * nearest error boundary instead.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches React.lazy's own signature
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((error: unknown) => {
      if (!isChunkLoadError(error)) throw error;
      handleChunkError(error);
    })
  );
}
