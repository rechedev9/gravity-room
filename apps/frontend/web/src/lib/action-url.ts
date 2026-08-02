import { isRecord } from '@gzclp/domain/type-guards';

const ACTION_TOKEN_STATE_KEY = 'gravityRoomActionToken';
const ACTION_PATHS = new Set(['/reset-password', '/verify-email']);

interface StoredActionToken {
  readonly pathname: string;
  readonly token: string;
}

function readStoredActionToken(pathname: string): string | null {
  const state: unknown = window.history.state;
  if (!isRecord(state)) return null;
  const stored = state[ACTION_TOKEN_STATE_KEY];
  if (!isRecord(stored)) return null;
  return stored.pathname === pathname && typeof stored.token === 'string' ? stored.token : null;
}

/**
 * Captures an account-action token in the current history entry and removes it
 * from the visible URL. Call this before telemetry or any asynchronous work.
 */
export function stripActionTokenFromCurrentUrl(): void {
  if (typeof window === 'undefined' || !ACTION_PATHS.has(window.location.pathname)) return;

  const url = new URL(window.location.href);
  const token = url.searchParams.get('token');
  if (!token) return;

  url.searchParams.delete('token');
  const currentState: unknown = window.history.state;
  const safeState = isRecord(currentState) ? currentState : {};
  const stored: StoredActionToken = { pathname: url.pathname, token };

  window.history.replaceState(
    { ...safeState, [ACTION_TOKEN_STATE_KEY]: stored },
    '',
    `${url.pathname}${url.search}${url.hash}`
  );
}

/** Returns the token captured for this history entry, stripping it first when needed. */
export function getActionToken(pathname: string): string | null {
  if (typeof window === 'undefined') return null;
  stripActionTokenFromCurrentUrl();
  return readStoredActionToken(pathname);
}

/** Removes the non-visible token after the account action no longer needs it. */
export function clearActionToken(pathname: string): void {
  if (typeof window === 'undefined') return;
  const state: unknown = window.history.state;
  if (!isRecord(state)) return;
  const stored = state[ACTION_TOKEN_STATE_KEY];
  if (!isRecord(stored) || stored.pathname !== pathname) return;

  const nextState: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (key !== ACTION_TOKEN_STATE_KEY) nextState[key] = value;
  }
  window.history.replaceState(nextState, '', window.location.href);
}
