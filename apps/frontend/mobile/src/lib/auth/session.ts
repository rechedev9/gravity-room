import { secureRefreshTokenStorage, type RefreshTokenStorage } from './secure-storage';

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
  readonly authenticateWithGoogleIdToken?: (credential: string) => Promise<RefreshResponse>;
}

interface SignOutDependencies {
  readonly storage?: RefreshTokenStorage;
  readonly revokeRemoteSession?: (refreshToken: string) => Promise<void>;
}

export class InvalidRefreshTokenError extends Error {
  constructor(message = 'Invalid refresh token') {
    super(message);
    this.name = 'InvalidRefreshTokenError';
  }
}

interface RestoreSessionDependencies {
  readonly storage?: RefreshTokenStorage;
  readonly refreshSession?: (refreshToken: string) => Promise<RefreshResponse>;
}

let accessToken: string | null = null;
let inFlightRestore: Promise<SessionState | null> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

function getApiBaseUrl(): string {
  const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (typeof configuredApiUrl === 'string' && configuredApiUrl.length > 0) {
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
  const authenticateWithGoogleIdToken =
    dependencies.authenticateWithGoogleIdToken ?? authenticateMobileGoogleIdToken;

  const authenticated = await authenticateWithGoogleIdToken(credential);
  accessToken = authenticated.accessToken;
  await storage.setRefreshToken(authenticated.refreshToken);

  return {
    accessToken: authenticated.accessToken,
    user: authenticated.user,
  };
}

export async function signOutSession(dependencies: SignOutDependencies = {}): Promise<void> {
  const storage = dependencies.storage ?? secureRefreshTokenStorage;
  const revokeRemoteSession = dependencies.revokeRemoteSession ?? revokeMobileSession;
  const refreshToken = await storage.getRefreshToken();

  accessToken = null;

  try {
    if (refreshToken) {
      await revokeRemoteSession(refreshToken);
    }
  } catch {
    // Local sign-out must still complete when remote revocation fails.
  }

  await storage.clearRefreshToken();
}

export async function restoreSession(
  dependencies: RestoreSessionDependencies = {}
): Promise<SessionState | null> {
  if (inFlightRestore) return inFlightRestore;

  const storage = dependencies.storage ?? secureRefreshTokenStorage;
  const refreshSession = dependencies.refreshSession ?? refreshMobileSession;

  inFlightRestore = (async () => {
    const refreshToken = await storage.getRefreshToken();
    if (!refreshToken) {
      accessToken = null;
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
  })();

  try {
    return await inFlightRestore;
  } finally {
    inFlightRestore = null;
  }
}
