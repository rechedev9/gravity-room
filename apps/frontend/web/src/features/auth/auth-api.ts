import type { UserInfo } from '@gzclp/domain/schemas/user';
import { parseUserSafe } from '@gzclp/domain/schemas/user';
import { isRecord } from '@gzclp/domain/type-guards';
import { apiFetch, type ApiFetchOptions } from '@/lib/api-functions';

export interface AuthenticatedSession {
  readonly accessToken: string;
  readonly user: UserInfo;
}

function parseAuthenticatedSession(data: unknown): AuthenticatedSession | null {
  if (!isRecord(data) || typeof data.accessToken !== 'string') return null;

  const user = parseUserSafe(data.user);
  return user ? { accessToken: data.accessToken, user } : null;
}

async function requestAuthenticatedSession(
  path: string,
  options: ApiFetchOptions
): Promise<AuthenticatedSession | null> {
  return parseAuthenticatedSession(await apiFetch(path, options));
}

export function signInWithGoogleCredential(
  credential: string
): Promise<AuthenticatedSession | null> {
  return requestAuthenticatedSession('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });
}

export function signInWithEmailCredentials(
  email: string,
  password: string
): Promise<AuthenticatedSession | null> {
  return requestAuthenticatedSession('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    retryAuth: false,
  });
}

export function verifyEmailToken(token: string): Promise<AuthenticatedSession | null> {
  return requestAuthenticatedSession('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
    retryAuth: false,
  });
}

export function signInAsDevelopmentUser(
  secret: string,
  email: string
): Promise<AuthenticatedSession | null> {
  return requestAuthenticatedSession('/auth/dev', {
    method: 'POST',
    headers: { 'x-dev-auth-secret': secret },
    body: JSON.stringify({ email }),
  });
}

export async function signUpWithEmailCredentials(
  email: string,
  password: string,
  name?: string
): Promise<void> {
  await apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, ...(name ? { name } : {}) }),
    retryAuth: false,
  });
}

export async function resendEmailVerification(email: string): Promise<void> {
  await apiFetch('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
    retryAuth: false,
  });
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  await apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
    retryAuth: false,
  });
}

export async function resetPasswordWithToken(token: string, password: string): Promise<void> {
  await apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
    retryAuth: false,
  });
}

export async function endAuthenticatedSession(): Promise<void> {
  await apiFetch('/auth/signout', { method: 'POST', retryAuth: false });
}

export async function deleteAuthenticatedAccount(): Promise<void> {
  await apiFetch('/auth/me', { method: 'DELETE' });
}
