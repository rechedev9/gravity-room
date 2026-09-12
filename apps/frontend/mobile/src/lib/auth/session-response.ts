import { isRecord } from '@gzclp/domain/type-guards';

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

export function readAuthUser(value: unknown): AuthUser {
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

export function readRefreshResponse(value: unknown): RefreshResponse {
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
export function readSessionResponse(value: unknown): SessionState {
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
