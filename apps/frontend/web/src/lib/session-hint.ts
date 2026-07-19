/**
 * Best-effort client-side hint that a refresh session MIGHT exist.
 *
 * The refresh token lives in an HttpOnly cookie that JavaScript cannot read, so
 * the SPA has no reliable way to know whether a returning visitor has a session
 * before calling `POST /auth/refresh`. For a first-time / anonymous visitor that
 * call is guaranteed to 401, and the browser logs every 4xx response as a red
 * "Failed to load resource" console error on each page load.
 *
 * This flag is set on every successful sign-in / refresh and cleared on
 * sign-out / refresh failure. It is deliberately non-authoritative and fails
 * open: absence means "definitely no session — skip the refresh"; presence (or
 * an unreadable localStorage) means "maybe a session — attempt the refresh as
 * before". It is a plain, non-HttpOnly localStorage value — it carries no
 * credential, only a boolean hint.
 */
const SESSION_HINT_KEY = 'gr-has-session';

/** Records that a session was just established (sign-in or successful refresh). */
export function markSessionHint(): void {
  try {
    localStorage.setItem(SESSION_HINT_KEY, '1');
  } catch {
    // localStorage may be unavailable (private mode, SSR/prerender). The hint is
    // best-effort; on the next load we simply fail open and attempt the refresh.
  }
}

/** Clears the hint on sign-out, account deletion, or a failed refresh. */
export function clearSessionHint(): void {
  try {
    localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Ignore — see markSessionHint.
  }
}

/**
 * Returns whether a refresh MIGHT succeed. Fails open: if the hint cannot be
 * read we return `true` so the refresh is still attempted (never lock out a
 * genuine returning user because of a storage quirk).
 */
export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) !== null;
  } catch {
    return true;
  }
}
