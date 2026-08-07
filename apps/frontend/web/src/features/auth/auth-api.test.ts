import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiFetchOptions } from '@/lib/api-functions';

const { mockApiFetch } = vi.hoisted(() => ({
  mockApiFetch: vi.fn<(path: string, options?: RequestInit) => Promise<unknown>>(),
}));

vi.mock('@/lib/api-functions', () => ({ apiFetch: mockApiFetch }));

import {
  deleteAuthenticatedAccount,
  endAuthenticatedSession,
  resendEmailVerification,
  resetPasswordWithToken,
  sendPasswordResetEmail,
  signInAsDevelopmentUser,
  signInWithEmailCredentials,
  signInWithGoogleCredential,
  signUpWithEmailCredentials,
  verifyEmailToken,
} from './auth-api';

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockResolvedValue(null);
});

describe('authenticated session requests', () => {
  const cases = [
    {
      name: 'Google credential',
      invoke: () => signInWithGoogleCredential('google-token'),
      path: '/auth/google',
      options: {
        method: 'POST',
        body: JSON.stringify({ credential: 'google-token' }),
      },
    },
    {
      name: 'email credentials',
      invoke: () => signInWithEmailCredentials('athlete@example.com', 'password'),
      path: '/auth/login',
      options: {
        method: 'POST',
        body: JSON.stringify({ email: 'athlete@example.com', password: 'password' }),
        retryAuth: false,
      },
    },
    {
      name: 'email verification token',
      invoke: () => verifyEmailToken('verification-token'),
      path: '/auth/verify-email',
      options: {
        method: 'POST',
        body: JSON.stringify({ token: 'verification-token' }),
        retryAuth: false,
      },
    },
    {
      name: 'development credentials',
      invoke: () => signInAsDevelopmentUser('dev-secret', 'dev@example.com'),
      path: '/auth/dev',
      options: {
        method: 'POST',
        headers: { 'x-dev-auth-secret': 'dev-secret' },
        body: JSON.stringify({ email: 'dev@example.com' }),
      },
    },
  ] satisfies ReadonlyArray<{
    readonly name: string;
    readonly invoke: () => Promise<unknown>;
    readonly path: string;
    readonly options: ApiFetchOptions;
  }>;

  it.each(cases)('owns the $name request contract', async ({ invoke, path, options }) => {
    mockApiFetch.mockResolvedValue({
      accessToken: 'access-token',
      user: { id: 'user-1', email: 'athlete@example.com' },
    });

    await expect(invoke()).resolves.toEqual({
      accessToken: 'access-token',
      user: { id: 'user-1', email: 'athlete@example.com' },
    });
    expect(mockApiFetch).toHaveBeenCalledWith(path, options);
  });

  it.each([
    ['missing access token', { user: { id: 'user-1', email: 'athlete@example.com' } }],
    ['invalid user', { accessToken: 'access-token', user: { id: 42 } }],
    ['non-object payload', 'not-an-object'],
  ])('rejects an invalid %s response at the API boundary', async (_name, response) => {
    mockApiFetch.mockResolvedValue(response);

    await expect(signInWithGoogleCredential('google-token')).resolves.toBeNull();
  });
});

describe('authentication commands', () => {
  const cases = [
    {
      name: 'sign up',
      invoke: () => signUpWithEmailCredentials('athlete@example.com', 'password', 'Athlete'),
      path: '/auth/signup',
      options: {
        method: 'POST',
        body: JSON.stringify({
          email: 'athlete@example.com',
          password: 'password',
          name: 'Athlete',
        }),
        retryAuth: false,
      },
    },
    {
      name: 'resend verification',
      invoke: () => resendEmailVerification('athlete@example.com'),
      path: '/auth/resend-verification',
      options: {
        method: 'POST',
        body: JSON.stringify({ email: 'athlete@example.com' }),
        retryAuth: false,
      },
    },
    {
      name: 'request password reset',
      invoke: () => sendPasswordResetEmail('athlete@example.com'),
      path: '/auth/forgot-password',
      options: {
        method: 'POST',
        body: JSON.stringify({ email: 'athlete@example.com' }),
        retryAuth: false,
      },
    },
    {
      name: 'reset password',
      invoke: () => resetPasswordWithToken('reset-token', 'new-password'),
      path: '/auth/reset-password',
      options: {
        method: 'POST',
        body: JSON.stringify({ token: 'reset-token', password: 'new-password' }),
        retryAuth: false,
      },
    },
    {
      name: 'sign out',
      invoke: endAuthenticatedSession,
      path: '/auth/signout',
      options: { method: 'POST', retryAuth: false },
    },
    {
      name: 'delete account',
      invoke: deleteAuthenticatedAccount,
      path: '/auth/me',
      options: { method: 'DELETE' },
    },
  ] satisfies ReadonlyArray<{
    readonly name: string;
    readonly invoke: () => Promise<void>;
    readonly path: string;
    readonly options: ApiFetchOptions;
  }>;

  it.each(cases)('owns the $name request contract', async ({ invoke, path, options }) => {
    await invoke();

    expect(mockApiFetch).toHaveBeenCalledWith(path, options);
  });
});
