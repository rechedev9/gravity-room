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

function getApiBaseUrl(): string {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  return processEnv?.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
}

async function refreshMobileSession(refreshToken: string): Promise<RefreshResponse> {
  const response = await fetch(`${getApiBaseUrl()}/auth/mobile/refresh`, {
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

  return (await response.json()) as RefreshResponse;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function clearSession(
  storage: RefreshTokenStorage = secureRefreshTokenStorage
): Promise<void> {
  accessToken = null;
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
