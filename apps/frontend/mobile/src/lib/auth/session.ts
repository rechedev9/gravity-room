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

export interface AuthorizedSession {
  readonly ownerUserId: string;
  readonly accessToken: string;
  readonly generation: number;
}

export class ObsoleteAuthorizedSessionError extends Error {
  readonly requestDispatched: boolean;

  constructor(requestDispatched = false) {
    super('The authenticated session changed while the request was in flight');
    this.name = 'ObsoleteAuthorizedSessionError';
    this.requestDispatched = requestDispatched;
  }
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
  readonly revokeRemoteSession?: (refreshToken: string) => Promise<void>;
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
  readonly loginWithSignal?: (
    email: string,
    password: string,
    signal: AbortSignal
  ) => Promise<Response>;
  readonly revokeRemoteSession?: (refreshToken: string) => Promise<void>;
  readonly revokeCookieSession?: () => Promise<void>;
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
let authenticatedOwnerUserId: string | null = null;
let authenticatedSessionGeneration = 0;
let sessionTransitionIntentGeneration = 0;
let sessionInvalidationIntentGeneration = 0;
let latestCommittedSignInIntentGeneration = 0;
let sessionRestorationBlocked = false;
let sessionTransitionTail = Promise.resolve();
let sessionCredentialWriteTail = Promise.resolve();
let sessionRevocationTail = Promise.resolve();
const activeCookieAuthControllers = new Set<AbortController>();
let activeRestoreFlight:
  | {
      readonly authenticatedGeneration: number;
      readonly initialAccessToken: string | null;
      readonly invalidationIntentGeneration: number;
      readonly transitionIntentGeneration: number;
      readonly promise: Promise<SessionState | null>;
    }
  | undefined;

async function withSessionTransition<T>(task: () => Promise<T>): Promise<T> {
  const previous = sessionTransitionTail;
  let release = (): void => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  sessionTransitionTail = tail;
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (sessionTransitionTail === tail) {
      sessionTransitionTail = Promise.resolve();
    }
  }
}

async function withSessionCredentialWrite<T>(task: () => Promise<T>): Promise<T> {
  const previous = sessionCredentialWriteTail;
  let release = (): void => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  sessionCredentialWriteTail = tail;
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (sessionCredentialWriteTail === tail) {
      sessionCredentialWriteTail = Promise.resolve();
    }
  }
}

async function withSessionRevocation<T>(task: () => Promise<T>): Promise<T> {
  const previous = sessionRevocationTail;
  let release = (): void => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  sessionRevocationTail = tail;
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (sessionRevocationTail === tail) {
      sessionRevocationTail = Promise.resolve();
    }
  }
}

function assertSessionInvalidationIntentCurrent(generation: number): void {
  if (generation !== sessionInvalidationIntentGeneration) {
    throw new ObsoleteAuthorizedSessionError();
  }
}

function assertSignInAttemptCanCommit(
  signInIntentGeneration: number,
  invalidationIntentGeneration: number
): void {
  assertSessionInvalidationIntentCurrent(invalidationIntentGeneration);
  if (signInIntentGeneration < latestCommittedSignInIntentGeneration) {
    throw new ObsoleteAuthorizedSessionError();
  }
}

function abortActiveCookieAuthRequests(): void {
  for (const controller of activeCookieAuthControllers) {
    controller.abort();
  }
}

function installAuthenticatedSession(session: SessionState, forceNewGeneration = false): void {
  if (forceNewGeneration || authenticatedOwnerUserId !== session.user.id) {
    authenticatedSessionGeneration += 1;
  }
  ({ accessToken } = session);
  authenticatedOwnerUserId = session.user.id;
  sessionRestorationBlocked = false;
}

function invalidateAuthenticatedSession(): void {
  authenticatedSessionGeneration += 1;
  accessToken = null;
  authenticatedOwnerUserId = null;
}

function assertRestoreAttemptCurrent(
  generation: number,
  initialAccessToken: string | null,
  transitionIntentGeneration: number
): void {
  if (
    generation !== authenticatedSessionGeneration ||
    initialAccessToken !== getAccessToken() ||
    transitionIntentGeneration !== sessionTransitionIntentGeneration
  ) {
    throw new ObsoleteAuthorizedSessionError();
  }
}

function guardRefreshTokenStorage(
  source: RefreshTokenStorage,
  generation: number,
  initialAccessToken: string | null,
  transitionIntentGeneration: number
): RefreshTokenStorage {
  return {
    async getRefreshToken() {
      const value = await source.getRefreshToken();
      assertRestoreAttemptCurrent(generation, initialAccessToken, transitionIntentGeneration);
      return value;
    },
    async setRefreshToken(value: string) {
      await withSessionCredentialWrite(async () => {
        assertRestoreAttemptCurrent(generation, initialAccessToken, transitionIntentGeneration);
        await source.setRefreshToken(value);
        assertRestoreAttemptCurrent(generation, initialAccessToken, transitionIntentGeneration);
      });
    },
    async clearRefreshToken() {
      await withSessionCredentialWrite(async () => {
        assertRestoreAttemptCurrent(generation, initialAccessToken, transitionIntentGeneration);
        await source.clearRefreshToken();
        assertRestoreAttemptCurrent(generation, initialAccessToken, transitionIntentGeneration);
      });
    },
  };
}

function guardSignInRefreshTokenStorage(
  source: RefreshTokenStorage,
  invalidationIntentGeneration: number
): RefreshTokenStorage {
  return {
    getRefreshToken: () => source.getRefreshToken(),
    setRefreshToken: (value) =>
      withSessionCredentialWrite(async () => {
        assertSessionInvalidationIntentCurrent(invalidationIntentGeneration);
        await source.setRefreshToken(value);
        assertSessionInvalidationIntentCurrent(invalidationIntentGeneration);
      }),
    clearRefreshToken: () =>
      withSessionCredentialWrite(async () => {
        assertSessionInvalidationIntentCurrent(invalidationIntentGeneration);
        await source.clearRefreshToken();
        assertSessionInvalidationIntentCurrent(invalidationIntentGeneration);
      }),
  };
}

function guardSignInSessionKindStorage(
  source: SessionKindStorage,
  invalidationIntentGeneration: number
): SessionKindStorage {
  return {
    getSessionKind: () => source.getSessionKind(),
    setSessionKind: (value) =>
      withSessionCredentialWrite(async () => {
        assertSessionInvalidationIntentCurrent(invalidationIntentGeneration);
        await source.setSessionKind(value);
        assertSessionInvalidationIntentCurrent(invalidationIntentGeneration);
      }),
    clearSessionKind: () =>
      withSessionCredentialWrite(async () => {
        assertSessionInvalidationIntentCurrent(invalidationIntentGeneration);
        await source.clearSessionKind();
        assertSessionInvalidationIntentCurrent(invalidationIntentGeneration);
      }),
  };
}

async function clearFailedSignInCredentials(
  storage: RefreshTokenStorage,
  kindStorage: SessionKindStorage
): Promise<void> {
  sessionRestorationBlocked = true;
  invalidateAuthenticatedSession();
  await withSessionCredentialWrite(async () => {
    const cleanupErrors: unknown[] = [];
    try {
      await storage.clearRefreshToken();
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      await kindStorage.clearSessionKind();
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, 'Failed to clear credentials after sign-in failure');
    }
  });
}

function guardRestoreSessionKindStorage(
  source: SessionKindStorage,
  generation: number,
  initialAccessToken: string | null,
  transitionIntentGeneration: number
): SessionKindStorage {
  return {
    async getSessionKind() {
      const value = await source.getSessionKind();
      assertRestoreAttemptCurrent(generation, initialAccessToken, transitionIntentGeneration);
      return value;
    },
    setSessionKind: (value) =>
      withSessionCredentialWrite(async () => {
        assertRestoreAttemptCurrent(generation, initialAccessToken, transitionIntentGeneration);
        await source.setSessionKind(value);
        assertRestoreAttemptCurrent(generation, initialAccessToken, transitionIntentGeneration);
      }),
    clearSessionKind: () =>
      withSessionCredentialWrite(async () => {
        assertRestoreAttemptCurrent(generation, initialAccessToken, transitionIntentGeneration);
        await source.clearSessionKind();
        assertRestoreAttemptCurrent(generation, initialAccessToken, transitionIntentGeneration);
      }),
  };
}

async function restoreSessionOnce(
  dependencies: RestoreSessionDependencies,
  generation: number,
  transitionIntentGeneration: number
): Promise<SessionState | null> {
  // Stage the legacy assignments in this function locally. The singleflight
  // owner installs the returned session only after validating this generation.
  let accessToken = getAccessToken();
  const initialAccessToken = accessToken;
  const storage = guardRefreshTokenStorage(
    dependencies.storage ?? secureRefreshTokenStorage,
    generation,
    initialAccessToken,
    transitionIntentGeneration
  );
  const kindStorage = guardRestoreSessionKindStorage(
    dependencies.sessionKindStorage ?? secureSessionKindStorage,
    generation,
    initialAccessToken,
    transitionIntentGeneration
  );
  const refreshSession = dependencies.refreshSession ?? refreshMobileSession;
  const restoreCookie = dependencies.restoreCookieSession ?? restoreCookieSession;

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
}

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

async function postEmailLogin(
  email: string,
  password: string,
  signal?: AbortSignal
): Promise<Response> {
  return fetch(buildApiUrl('/auth/login'), {
    method: 'POST',
    credentials: 'include',
    ...(signal ? { signal } : {}),
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
  let accessToken = getAccessToken();
  const initialAccessToken = accessToken;
  const controller = new AbortController();
  activeCookieAuthControllers.add(controller);
  try {
    const response = await fetch(buildApiUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
    });
    if (initialAccessToken !== getAccessToken()) {
      return null;
    }

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
  } finally {
    activeCookieAuthControllers.delete(controller);
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
  sessionTransitionIntentGeneration += 1;
  sessionInvalidationIntentGeneration += 1;
  authenticatedSessionGeneration += 1;
  authenticatedOwnerUserId = null;
  sessionRestorationBlocked = false;
  accessToken = token;
}

export function captureAuthorizedSession(ownerUserId: string): AuthorizedSession {
  if (
    ownerUserId.length === 0 ||
    accessToken === null ||
    authenticatedOwnerUserId !== ownerUserId
  ) {
    throw new ObsoleteAuthorizedSessionError();
  }
  return {
    ownerUserId,
    accessToken,
    generation: authenticatedSessionGeneration,
  };
}

export function isAuthorizedSessionCurrent(session: AuthorizedSession): boolean {
  return (
    authenticatedOwnerUserId === session.ownerUserId &&
    authenticatedSessionGeneration === session.generation &&
    accessToken !== null
  );
}

export function assertAuthorizedSessionCurrent(
  session: AuthorizedSession,
  requestDispatched = false
): void {
  if (!isAuthorizedSessionCurrent(session)) {
    throw new ObsoleteAuthorizedSessionError(requestDispatched);
  }
}

export function getAuthorizedSessionAccessToken(session: AuthorizedSession): string {
  assertAuthorizedSessionCurrent(session);
  const currentAccessToken = getAccessToken();
  if (currentAccessToken === null) {
    throw new ObsoleteAuthorizedSessionError();
  }
  return currentAccessToken;
}

export async function fetchWithAuthorizedSession(
  session: AuthorizedSession,
  path: string,
  init?: RequestInit,
  dependencies: AuthorizedFetchDependencies = {}
): Promise<Response> {
  assertAuthorizedSessionCurrent(session);
  const currentAccessToken = getAccessToken();
  if (currentAccessToken === null) {
    throw new ObsoleteAuthorizedSessionError();
  }
  let response = await fetchWithToken(path, currentAccessToken, init);
  assertAuthorizedSessionCurrent(session, true);
  if (response.status !== 401) {
    return response;
  }

  const restoreAuthorizedSession = dependencies.restoreAuthorizedSession ?? restoreSession;
  let restored: SessionState | null;
  try {
    restored = await restoreAuthorizedSession();
  } catch {
    assertAuthorizedSessionCurrent(session, true);
    return response;
  }
  assertAuthorizedSessionCurrent(session, true);
  if (restored === null || restored.user.id !== session.ownerUserId) {
    return response;
  }

  const refreshedAccessToken = getAccessToken();
  if (refreshedAccessToken === null) {
    return response;
  }
  response = await fetchWithToken(path, refreshedAccessToken, init);
  assertAuthorizedSessionCurrent(session, true);
  return response;
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
  sessionRestorationBlocked = true;
  sessionTransitionIntentGeneration += 1;
  sessionInvalidationIntentGeneration += 1;
  invalidateAuthenticatedSession();
  await withSessionCredentialWrite(async () => {
    await storage.clearRefreshToken();
  });
  invalidateAuthenticatedSession();
}

async function signInWithGoogleIdTokenOnce(
  credential: string,
  dependencies: SignInDependencies = {}
): Promise<SessionState> {
  let accessToken = getAccessToken();
  void accessToken;
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

function withResolvedGoogleSession(
  dependencies: SignInDependencies,
  authenticated: RefreshResponse
): SignInDependencies {
  return {
    ...dependencies,
    async authenticateWithGoogleIdToken() {
      return authenticated;
    },
  };
}

export async function signInWithGoogleIdToken(
  credential: string,
  dependencies: SignInDependencies = {}
): Promise<SessionState> {
  const signInIntentGeneration = (sessionTransitionIntentGeneration += 1);
  abortActiveCookieAuthRequests();
  const invalidationIntentGeneration = sessionInvalidationIntentGeneration;
  const googleExchange =
    dependencies.authenticateWithGoogleIdToken ?? authenticateMobileGoogleIdToken;
  const revokeRemoteSession = dependencies.revokeRemoteSession ?? revokeMobileSession;
  const authenticated = await googleExchange(credential);
  try {
    return await withSessionTransition(async () => {
      await sessionRevocationTail;
      assertSignInAttemptCanCommit(signInIntentGeneration, invalidationIntentGeneration);
      const storage = dependencies.storage ?? secureRefreshTokenStorage;
      const kindStorage = dependencies.sessionKindStorage ?? secureSessionKindStorage;
      let credentialsMayHaveBeenWritten = false;
      try {
        credentialsMayHaveBeenWritten = true;
        const session = await signInWithGoogleIdTokenOnce(credential, {
          ...withResolvedGoogleSession(dependencies, authenticated),
          storage: guardSignInRefreshTokenStorage(storage, invalidationIntentGeneration),
          sessionKindStorage: guardSignInSessionKindStorage(
            kindStorage,
            invalidationIntentGeneration
          ),
        });
        assertSignInAttemptCanCommit(signInIntentGeneration, invalidationIntentGeneration);
        latestCommittedSignInIntentGeneration = signInIntentGeneration;
        installAuthenticatedSession(session, true);
        return session;
      } catch (error) {
        if (credentialsMayHaveBeenWritten) {
          try {
            await clearFailedSignInCredentials(storage, kindStorage);
          } catch (cleanupError) {
            throw new AggregateError(
              [error, cleanupError],
              'Google sign-in and local credential cleanup both failed'
            );
          }
        }
        throw error;
      }
    });
  } catch (error) {
    try {
      await revokeRemoteSession(authenticated.refreshToken);
    } catch {
      // A superseded token is unusable locally even when best-effort server
      // revocation is unavailable.
    }
    throw error;
  }
}

async function signInWithEmailPasswordOnce(
  email: string,
  password: string,
  dependencies: EmailSignInDependencies = {},
  onCookieSessionIssued: () => void = () => undefined
): Promise<EmailSignInResult> {
  let accessToken = getAccessToken();
  const login = dependencies.login;
  const loginWithSignal = dependencies.loginWithSignal;
  const storage = dependencies.storage ?? secureRefreshTokenStorage;
  const kindStorage = dependencies.sessionKindStorage ?? secureSessionKindStorage;
  const revokeRemoteSession = dependencies.revokeRemoteSession ?? revokeMobileSession;

  const controller = new AbortController();
  activeCookieAuthControllers.add(controller);
  let response: Response;
  try {
    response = loginWithSignal
      ? await loginWithSignal(email, password, controller.signal)
      : login
        ? await login(email, password)
        : await postEmailLogin(email, password, controller.signal);
    if (response.ok) {
      onCookieSessionIssued();
    }
  } finally {
    activeCookieAuthControllers.delete(controller);
  }
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
  void accessToken;
  return { ok: true, session };
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
  dependencies: EmailSignInDependencies = {}
): Promise<EmailSignInResult> {
  const signInIntentGeneration = (sessionTransitionIntentGeneration += 1);
  abortActiveCookieAuthRequests();
  const invalidationIntentGeneration = sessionInvalidationIntentGeneration;
  return withSessionTransition(async () => {
    let cookieSessionIssued = false;
    try {
      await sessionRevocationTail;
      assertSignInAttemptCanCommit(signInIntentGeneration, invalidationIntentGeneration);
      const result = await signInWithEmailPasswordOnce(
        email,
        password,
        {
          ...dependencies,
          storage: guardSignInRefreshTokenStorage(
            dependencies.storage ?? secureRefreshTokenStorage,
            invalidationIntentGeneration
          ),
          sessionKindStorage: guardSignInSessionKindStorage(
            dependencies.sessionKindStorage ?? secureSessionKindStorage,
            invalidationIntentGeneration
          ),
        },
        () => {
          cookieSessionIssued = true;
        }
      );
      if (result.ok) {
        assertSignInAttemptCanCommit(signInIntentGeneration, invalidationIntentGeneration);
        latestCommittedSignInIntentGeneration = signInIntentGeneration;
        installAuthenticatedSession(result.session, true);
      }
      return result;
    } catch (error) {
      if (cookieSessionIssued) {
        const cleanupErrors: unknown[] = [];
        try {
          await clearFailedSignInCredentials(
            dependencies.storage ?? secureRefreshTokenStorage,
            dependencies.sessionKindStorage ?? secureSessionKindStorage
          );
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError);
        }
        try {
          await (dependencies.revokeCookieSession ?? revokeCookieSession)();
        } catch {
          // Local credentials are already unusable. Remote cleanup is best-effort.
        }
        if (cleanupErrors.length > 0) {
          throw new AggregateError(
            [error, ...cleanupErrors],
            'Email sign-in and local credential cleanup both failed'
          );
        }
      }
      throw error;
    }
  });
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
  sessionRestorationBlocked = true;
  sessionTransitionIntentGeneration += 1;
  sessionInvalidationIntentGeneration += 1;
  invalidateAuthenticatedSession();
  abortActiveCookieAuthRequests();
  const storage = dependencies.storage ?? secureRefreshTokenStorage;
  const kindStorage = dependencies.sessionKindStorage ?? secureSessionKindStorage;
  const revokeRemoteSession = dependencies.revokeRemoteSession ?? revokeMobileSession;
  const revokeCookie = dependencies.revokeCookieSession ?? revokeCookieSession;
  const durableClear = withSessionCredentialWrite(async () => {
    let storedRefreshToken: string | null = null;
    let cleanupError: unknown;
    try {
      storedRefreshToken = await storage.getRefreshToken();
    } catch (error) {
      cleanupError = error;
    }
    try {
      await storage.clearRefreshToken();
    } catch (error) {
      cleanupError ??= error;
    }
    try {
      await kindStorage.clearSessionKind();
    } catch (error) {
      cleanupError ??= error;
    }
    return { storedRefreshToken, cleanupError };
  });
  await withSessionRevocation(async () => {
    const { storedRefreshToken, cleanupError } = await durableClear;
    invalidateAuthenticatedSession();

    // Local credentials are already authoritatively gone, but the revocation
    // attempt stays ordered before a later sign-in so an old cookie-logout
    // response cannot clear a newly issued cookie.
    try {
      await (storedRefreshToken ? revokeRemoteSession(storedRefreshToken) : revokeCookie());
    } catch {
      // Local sign-out remains complete when remote revocation fails.
    }
    if (cleanupError !== undefined) {
      throw cleanupError;
    }
  });
}

export async function restoreSession(
  dependencies: RestoreSessionDependencies = {}
): Promise<SessionState | null> {
  if (sessionRestorationBlocked) {
    return null;
  }
  const authenticatedGeneration = authenticatedSessionGeneration;
  const initialAccessToken = getAccessToken();
  const invalidationIntentGeneration = sessionInvalidationIntentGeneration;
  const transitionIntentGeneration = sessionTransitionIntentGeneration;
  const existingFlight = activeRestoreFlight;
  if (
    existingFlight?.authenticatedGeneration === authenticatedGeneration &&
    existingFlight.initialAccessToken === initialAccessToken &&
    existingFlight.invalidationIntentGeneration === invalidationIntentGeneration &&
    existingFlight.transitionIntentGeneration === transitionIntentGeneration
  ) {
    return existingFlight.promise;
  }

  const promise = (async (): Promise<SessionState | null> => {
    assertRestoreAttemptCurrent(
      authenticatedGeneration,
      initialAccessToken,
      transitionIntentGeneration
    );
    const session = await restoreSessionOnce(
      dependencies,
      authenticatedGeneration,
      transitionIntentGeneration
    );
    return withSessionTransition(async () => {
      assertRestoreAttemptCurrent(
        authenticatedGeneration,
        initialAccessToken,
        transitionIntentGeneration
      );
      if (session === null) {
        invalidateAuthenticatedSession();
      } else {
        installAuthenticatedSession(session);
      }
      return session;
    });
  })();
  activeRestoreFlight = {
    authenticatedGeneration,
    initialAccessToken,
    invalidationIntentGeneration,
    transitionIntentGeneration,
    promise,
  };
  const clearFlight = (): void => {
    if (activeRestoreFlight?.promise === promise) {
      activeRestoreFlight = undefined;
    }
  };
  void promise.then(clearFlight, clearFlight);
  return promise;
}
