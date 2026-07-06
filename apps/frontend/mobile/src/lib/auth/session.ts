import { createSingleFlight } from '@gzclp/api-client/single-flight';
import { isRecord } from '@gzclp/domain/type-guards';
import {
  secureRefreshTokenStorage,
  secureSessionKindStorage,
  type RefreshTokenStorage,
  type SessionKindStorage,
} from './secure-storage';

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly avatarUrl: string | null;
}

export interface SessionState {
  readonly accessToken: string;
  readonly user: AuthUser;
}

export interface RefreshResponse extends SessionState {
  readonly refreshToken: string;
}

interface AuthorizedFetchDependencies {
  readonly initialAccessToken?: string;
  readonly restoreAuthorizedSession?: () => Promise<SessionState | null>;
}

interface SignInDependencies {
  readonly storage?: RefreshTokenStorage;
  readonly sessionKindStorage?: SessionKindStorage;
  readonly authenticateWithGoogleIdToken?: (credential: string) => Promise<RefreshResponse>;
  readonly revokeCookieSession?: () => Promise<void>;
}

interface SignOutDependencies {
  readonly storage?: RefreshTokenStorage;
  readonly sessionKindStorage?: SessionKindStorage;
  readonly revokeRemoteSession?: (refreshToken: string) => Promise<void>;
  readonly revokeCookieSession?: () => Promise<void>;
}

interface EmailSignInDependencies {
  readonly storage?: RefreshTokenStorage;
  readonly sessionKindStorage?: SessionKindStorage;
  readonly login?: (email: string, password: string) => Promise<Response>;
  readonly revokeRemoteSession?: (refreshToken: string) => Promise<void>;
}

interface EmailSignUpDependencies {
  readonly signup?: (email: string, password: string, name?: string) => Promise<Response>;
}

/**
 * Outcome of an email/password sign-in. `code` on failure is the API error code
 * (or a status-derived fallback) so the UI can localize the message.
 */
export type EmailSignInResult =
  | { readonly ok: true; readonly session: SessionState }
  | { readonly ok: false; readonly code: string };

/**
 * Outcome of an email/password sign-up. Sign-up never mints a session: the
 * account starts unverified and must confirm its email before signing in.
 */
export type EmailSignUpResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string };

export class InvalidRefreshTokenError extends Error {
  constructor(message = 'Invalid refresh token') {
    super(message);
    this.name = 'InvalidRefreshTokenError';
  }
}

interface RestoreSessionDependencies {
  readonly storage?: RefreshTokenStorage;
  readonly sessionKindStorage?: SessionKindStorage;
  readonly refreshSession?: (refreshToken: string) => Promise<RefreshResponse>;
  readonly restoreCookieSession?: () => Promise<SessionState | null>;
}

let accessToken: string | null = null;
let pendingRestoreDeps: RestoreSessionDependencies = {};

const singleFlightRestore = createSingleFlight(async (): Promise<SessionState | null> => {
  const storage = pendingRestoreDeps.storage ?? secureRefreshTokenStorage;
  const kindStorage = pendingRestoreDeps.sessionKindStorage ?? secureSessionKindStorage;
  const refreshSession = pendingRestoreDeps.refreshSession ?? refreshMobileSession;
  const restoreCookie = pendingRestoreDeps.restoreCookieSession ?? restoreCookieSession;

  const refreshToken = await storage.getRefreshToken();
  if (!refreshToken) {
    accessToken = null;
    // No device-stored refresh token means this is not a Google (body-token)
    // session. Only fall back to the cookie-based refresh route when an email
    // session was actually established on this device (the marker). This keeps
    // signed-out and Google users off a guaranteed network round-trip at launch,
    // and stops a stale cookie from silently resurrecting a signed-out session.
    const kind = await kindStorage.getSessionKind();
    if (kind === 'email') {
      return restoreCookie();
    }
    return null;
  }

  try {
    const refreshed = await refreshSession(refreshToken);
    accessToken = refreshed.accessToken;
    await storage.setRefreshToken(refreshed.refreshToken);
    return {
      accessToken: refreshed.accessToken,
      user: refreshed.user,
    };
  } catch (error) {
    accessToken = null;
    if (error instanceof InvalidRefreshTokenError) {
      await storage.clearRefreshToken();
    }
    return null;
  }
});

function readAuthUser(value: unknown): AuthUser {
  if (!isRecord(value)) {
    throw new Error('Invalid mobile auth response');
  }

  const id = value.id;
  const email = value.email;
  const name = value.name;
  const avatarUrl = value.avatarUrl;

  if (typeof id !== 'string' || typeof email !== 'string') {
    throw new Error('Invalid mobile auth response');
  }

  if (name !== null && name !== undefined && typeof name !== 'string') {
    throw new Error('Invalid mobile auth response');
  }

  if (avatarUrl !== null && avatarUrl !== undefined && typeof avatarUrl !== 'string') {
    throw new Error('Invalid mobile auth response');
  }

  return {
    id,
    email,
    name: typeof name === 'string' ? name : null,
    avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : null,
  };
}

function readRefreshResponse(value: unknown): RefreshResponse {
  if (!isRecord(value)) {
    throw new Error('Invalid mobile auth response');
  }

  const nextAccessToken = value.accessToken;
  const refreshToken = value.refreshToken;
  const user = readAuthUser(value.user);

  if (typeof nextAccessToken !== 'string' || typeof refreshToken !== 'string') {
    throw new Error('Invalid mobile auth response');
  }

  return {
    accessToken: nextAccessToken,
    refreshToken,
    user,
  };
}

/**
 * Reads a body-token-free session response (`{ accessToken, user }`), as
 * returned by the cookie-based `/auth/login` and `/auth/refresh` routes. The
 * refresh token for these sessions is delivered in an httpOnly cookie, not the
 * body, so it never appears here.
 */
function readSessionResponse(value: unknown): SessionState {
  if (!isRecord(value)) {
    throw new Error('Invalid mobile auth response');
  }

  const nextAccessToken = value.accessToken;
  const user = readAuthUser(value.user);

  if (typeof nextAccessToken !== 'string') {
    throw new Error('Invalid mobile auth response');
  }

  return {
    accessToken: nextAccessToken,
    user,
  };
}

function getApiBaseUrl(): string {
  const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (typeof configuredApiUrl === 'string' && configuredApiUrl.length > 0) {
    // In production builds refuse cleartext: a misconfigured http:// URL would
    // send the bearer access token and refresh token unencrypted. Plain http is
    // only allowed in dev (e.g. http://localhost:3001 against a local API).
    if (!__DEV__ && !configuredApiUrl.startsWith('https://')) {
      throw new Error('EXPO_PUBLIC_API_URL must use https:// in production builds');
    }
    return configuredApiUrl;
  }

  return 'http://localhost:3001';
}

function readApiPrefix(requestUrl: URL): string {
  const configuredPath = requestUrl.pathname.replace(/\/$/, '');
  if (configuredPath.length === 0 || configuredPath === '/') {
    return '/api';
  }

  return configuredPath;
}

function normalizePath(path: string): URL {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalized, 'http://localhost');
}

export function buildApiUrl(path: string): string {
  const requestUrl = new URL(getApiBaseUrl());
  const normalizedPath = normalizePath(path);
  requestUrl.pathname = `${readApiPrefix(requestUrl)}${normalizedPath.pathname}`;
  requestUrl.search = normalizedPath.search;
  return requestUrl.toString();
}

function createAuthorizedRequestInit(
  accessToken: string,
  init: RequestInit | undefined
): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);

  return {
    ...init,
    headers,
  };
}

async function fetchWithToken(
  path: string,
  accessToken: string,
  init: RequestInit | undefined
): Promise<Response> {
  return fetch(buildApiUrl(path), createAuthorizedRequestInit(accessToken, init));
}

async function refreshMobileSession(refreshToken: string): Promise<RefreshResponse> {
  const response = await fetch(buildApiUrl('/auth/mobile/refresh'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new InvalidRefreshTokenError();
    }
    throw new Error(`Mobile session refresh failed with status ${response.status}`);
  }

  return readRefreshResponse(await response.json());
}

async function authenticateMobileGoogleIdToken(credential: string): Promise<RefreshResponse> {
  const response = await fetch(buildApiUrl('/auth/mobile/google'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ credential }),
  });

  if (!response.ok) {
    throw new Error(`Mobile Google sign-in failed with status ${response.status}`);
  }

  return readRefreshResponse(await response.json());
}

async function revokeMobileSession(refreshToken: string): Promise<void> {
  const response = await fetch(buildApiUrl('/auth/mobile/signout'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok && response.status !== 401) {
    throw new Error(`Mobile sign-out failed with status ${response.status}`);
  }
}

// ---------------------------------------------------------------------------
// Email / password - reuses the cookie-based web auth routes. There is no
// mobile-specific email endpoint yet. `/auth/login` returns the access token in
// the body and the refresh token in an httpOnly cookie (captured by the native
// cookie jar); `/auth/refresh` reads that cookie back, so mobile never handles
// the refresh-token value directly for these sessions. `credentials: 'include'`
// (on the routes that touch the cookie) sends/stores it on native and web
// alike. `/auth/signup` only creates an unverified account (201 message, no
// cookie), so it needs no credentials.
// ---------------------------------------------------------------------------

async function postEmailLogin(email: string, password: string): Promise<Response> {
  return fetch(buildApiUrl('/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
}

async function postEmailSignup(email: string, password: string, name?: string): Promise<Response> {
  return fetch(buildApiUrl('/auth/signup'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, ...(name ? { name } : {}) }),
  });
}

async function restoreCookieSession(): Promise<SessionState | null> {
  try {
    const response = await fetch(buildApiUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      accessToken = null;
      return null;
    }

    const session = readSessionResponse(await response.json());
    accessToken = session.accessToken;
    return session;
  } catch {
    accessToken = null;
    return null;
  }
}

async function revokeCookieSession(): Promise<void> {
  const response = await fetch(buildApiUrl('/auth/signout'), {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok && response.status !== 401) {
    throw new Error(`Cookie sign-out failed with status ${response.status}`);
  }
}

/** Reads the machine-readable error `code` from an API error body, if present. */
async function readResponseErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = await response.json();
    if (isRecord(body) && typeof body.code === 'string') {
      return body.code;
    }
  } catch {
    // A non-JSON error body just means we fall back to the status-derived code.
  }

  return undefined;
}

/** Maps an auth failure to a stable code the UI localizes (`login.errors.*`). */
function mapAuthErrorCode(status: number, bodyCode: string | undefined): string {
  if (bodyCode) {
    return bodyCode;
  }
  if (status === 429) return 'RATE_LIMITED';
  if (status === 401) return 'INVALID_CREDENTIALS';
  if (status === 403) return 'EMAIL_NOT_VERIFIED';
  if (status === 409) return 'EMAIL_TAKEN';
  return 'generic';
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function fetchWithAccessToken(
  path: string,
  init?: RequestInit,
  dependencies: AuthorizedFetchDependencies = {}
): Promise<{ readonly accessToken: string; readonly response: Response }> {
  const restoreAuthorizedSession = dependencies.restoreAuthorizedSession ?? restoreSession;
  const currentAccessToken = dependencies.initialAccessToken ?? getAccessToken();
  if (!currentAccessToken) {
    throw new Error('Authorized request requires an access token');
  }

  let response = await fetchWithToken(path, currentAccessToken, init);
  if (response.status !== 401) {
    return {
      accessToken: currentAccessToken,
      response,
    };
  }

  const restoredSession = await restoreAuthorizedSession();
  if (!restoredSession?.accessToken) {
    return {
      accessToken: currentAccessToken,
      response,
    };
  }

  response = await fetchWithToken(path, restoredSession.accessToken, init);
  return {
    accessToken: restoredSession.accessToken,
    response,
  };
}

export async function clearSession(
  storage: RefreshTokenStorage = secureRefreshTokenStorage
): Promise<void> {
  accessToken = null;
  await storage.clearRefreshToken();
}

export async function signInWithGoogleIdToken(
  credential: string,
  dependencies: SignInDependencies = {}
): Promise<SessionState> {
  const storage = dependencies.storage ?? secureRefreshTokenStorage;
  const kindStorage = dependencies.sessionKindStorage ?? secureSessionKindStorage;
  const authenticateWithGoogleIdToken =
    dependencies.authenticateWithGoogleIdToken ?? authenticateMobileGoogleIdToken;
  const revokeCookie = dependencies.revokeCookieSession ?? revokeCookieSession;

  // Credentials are mutually exclusive: best-effort revoke a leftover email
  // cookie session server-side before it becomes unreachable behind the new
  // Google session (switching providers without signing out first).
  try {
    if ((await kindStorage.getSessionKind()) === 'email') await revokeCookie();
  } catch {
    // Revocation is best-effort; sign-in must not be blocked by it.
  }

  const authenticated = await authenticateWithGoogleIdToken(credential);
  accessToken = authenticated.accessToken;
  await storage.setRefreshToken(authenticated.refreshToken);
  await kindStorage.setSessionKind('google');

  return {
    accessToken: authenticated.accessToken,
    user: authenticated.user,
  };
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
  dependencies: EmailSignInDependencies = {}
): Promise<EmailSignInResult> {
  const login = dependencies.login ?? postEmailLogin;
  const storage = dependencies.storage ?? secureRefreshTokenStorage;
  const kindStorage = dependencies.sessionKindStorage ?? secureSessionKindStorage;
  const revokeRemoteSession = dependencies.revokeRemoteSession ?? revokeMobileSession;

  const response = await login(email, password);
  if (!response.ok) {
    const bodyCode = await readResponseErrorCode(response);
    return { ok: false, code: mapAuthErrorCode(response.status, bodyCode) };
  }

  const session = readSessionResponse(await response.json());
  accessToken = session.accessToken;
  // Credentials are mutually exclusive: revoke and drop any leftover Google
  // refresh token. Without the server-side revocation the row would stay
  // valid for its full TTL with no one left holding the value; without the
  // local clear a later 401 retry or relaunch would silently resurrect the
  // previous account's session over this one.
  try {
    const leftover = await storage.getRefreshToken();
    if (leftover) await revokeRemoteSession(leftover);
  } catch {
    // Revocation is best-effort; sign-in must not be blocked by it.
  }
  await storage.clearRefreshToken();
  // Mark this as a cookie-backed session so restore knows to use the cookie
  // route and sign-out knows to revoke the cookie.
  await kindStorage.setSessionKind('email');
  return { ok: true, session };
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  name?: string,
  dependencies: EmailSignUpDependencies = {}
): Promise<EmailSignUpResult> {
  const signup = dependencies.signup ?? postEmailSignup;

  const response = await signup(email, password, name);
  if (!response.ok) {
    const bodyCode = await readResponseErrorCode(response);
    return { ok: false, code: mapAuthErrorCode(response.status, bodyCode) };
  }

  return { ok: true };
}

export async function signOutSession(dependencies: SignOutDependencies = {}): Promise<void> {
  const storage = dependencies.storage ?? secureRefreshTokenStorage;
  const kindStorage = dependencies.sessionKindStorage ?? secureSessionKindStorage;
  const revokeRemoteSession = dependencies.revokeRemoteSession ?? revokeMobileSession;
  const revokeCookie = dependencies.revokeCookieSession ?? revokeCookieSession;
  const refreshToken = await storage.getRefreshToken();

  accessToken = null;

  try {
    if (refreshToken) {
      // Google (body-token) session: revoke by refresh-token value.
      await revokeRemoteSession(refreshToken);
    } else {
      // Email/password (cookie) session: revoke the httpOnly refresh cookie.
      await revokeCookie();
    }
  } catch {
    // Local sign-out must still complete when remote revocation fails.
  }

  // Destroy every local credential unconditionally so sign-out is authoritative
  // even when the network is down: clearing the marker stops the next launch
  // from resurrecting a still-valid cookie session (see restore fallback above).
  await storage.clearRefreshToken();
  await kindStorage.clearSessionKind();
}

export async function restoreSession(
  dependencies: RestoreSessionDependencies = {}
): Promise<SessionState | null> {
  pendingRestoreDeps = dependencies;
  return singleFlightRestore();
}
