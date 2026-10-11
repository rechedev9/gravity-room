/**
 * Remembers whether this browser last saw a signed-in or signed-out state, so a
 * cold load can skip the POST /auth/refresh that would only answer 401 (and log
 * a console error) for anonymous visitors. The refresh cookie is HttpOnly, so
 * the page cannot read it; this hint is the only signal available.
 *
 * Only a recent "signed out" hint skips the restore. No hint (first visit, or a
 * session from before this hint existed) and a stale one both still attempt it,
 * so a valid cookie is never ignored for longer than SIGNED_OUT_TTL_MS.
 */
const SESSION_HINT_KEY = 'gravity-room:session-hint';
const SIGNED_IN_PREFIX = 'signed-in';
const SIGNED_OUT_PREFIX = 'signed-out:';
const SIGNED_OUT_TTL_MS = 6 * 60 * 60 * 1000;

function writeHint(value: string): void {
  try {
    localStorage.setItem(SESSION_HINT_KEY, value);
  } catch {
    // storage unavailable: the hint is an optimisation, not state
  }
}

function readHint(): string | null {
  try {
    return localStorage.getItem(SESSION_HINT_KEY);
  } catch {
    return null;
  }
}

// Counts sign-ins seen by this tab, so it still works when storage is unavailable.
let signInGeneration = 0;

/** The sign-in state at one moment, to detect a sign-in that lands later. */
export interface SessionHintSnapshot {
  readonly generation: number;
  readonly stored: string | null;
}

export function snapshotSessionHint(): SessionHintSnapshot {
  return { generation: signInGeneration, stored: readHint() };
}

/** True when this tab signed in after the snapshot was taken. */
export function signedInHereSince(snapshot: SessionHintSnapshot): boolean {
  return signInGeneration !== snapshot.generation;
}

/** True when this tab or another one signed in after the snapshot was taken. */
export function signedInSince(snapshot: SessionHintSnapshot): boolean {
  if (signedInHereSince(snapshot)) return true;
  const stored = readHint();
  return stored !== null && stored.startsWith(SIGNED_IN_PREFIX) && stored !== snapshot.stored;
}

export function markSessionSignedIn(now: number = Date.now()): void {
  signInGeneration += 1;
  // The timestamp makes each sign-in a distinct value that other tabs can detect.
  writeHint(`${SIGNED_IN_PREFIX}:${now}:${signInGeneration}`);
}

export function markSessionSignedOut(now: number = Date.now()): void {
  writeHint(`${SIGNED_OUT_PREFIX}${now}`);
}

/** True when this browser was recently confirmed signed out. */
export function isRecentlySignedOut(now: number = Date.now()): boolean {
  const raw = readHint();
  if (raw === null || !raw.startsWith(SIGNED_OUT_PREFIX)) return false;
  const at = Number(raw.slice(SIGNED_OUT_PREFIX.length));
  return Number.isFinite(at) && now - at >= 0 && now - at < SIGNED_OUT_TTL_MS;
}
