import { Platform } from 'react-native';
import { secureOfflineIdentityStorage, secureLocalDataOwnerStorage } from './secure-storage';

import {
  buildApiUrl,
  DEFAULT_DEV_AUTH_EMAIL,
  DEFAULT_DEV_AUTH_SECRET,
  fetchWithAccessToken,
  getAccessToken,
  InvalidRefreshTokenError,
  SessionUnavailableError,
  readOfflineUser,
  rememberOfflineUser,
  resolveApiBaseUrl,
  restoreSession,
  SignOutCredentialDeletionError,
  setAccessToken,
  signInWithDev,
  signInWithEmailPassword,
  signInWithGoogleIdToken,
  signOutSession,
  signUpWithEmailPassword,
} from './session';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const AUTH_USER = {
  id: 'user-123',
  email: 'athlete@example.com',
  name: 'Test Athlete',
  avatarUrl: null,
} as const;

const originalFetch = globalThis.fetch;
const originalExpoPublicApiUrl = process.env.EXPO_PUBLIC_API_URL;

afterEach(() => {
  jest.restoreAllMocks();
  setAccessToken(null);
  globalThis.fetch = originalFetch;
  if (originalExpoPublicApiUrl === undefined) {
    delete process.env.EXPO_PUBLIC_API_URL;
    return;
  }

  process.env.EXPO_PUBLIC_API_URL = originalExpoPublicApiUrl;
});

describe('buildApiUrl', () => {
  it.each([
    { configured: undefined, expected: 'http://localhost:3001' },
    { configured: '', expected: 'http://localhost:3001' },
    { configured: 'http://127.0.0.1:3001', expected: 'http://127.0.0.1:3001' },
    { configured: 'http://10.0.2.2:3001', expected: 'http://10.0.2.2:3001' },
    { configured: 'https://api.example.com', expected: 'https://api.example.com' },
  ])('resolves an allowed development base URL: $configured', ({ configured, expected }) => {
    expect(resolveApiBaseUrl(configured, true)).toBe(expected);
  });

  it.each([
    { configured: undefined, error: /required/ },
    { configured: '', error: /required/ },
    { configured: 'http://api.example.com', error: /https/ },
    { configured: 'ftp://api.example.com', error: /https/ },
    { configured: 'https://user:pass@api.example.com', error: /credentials/ },
    { configured: 'https://api.example.com?token=x', error: /query/ },
    { configured: 'not a url', error: /valid absolute URL/ },
  ])('rejects an unsafe production base URL: $configured', ({ configured, error }) => {
    expect(() => resolveApiBaseUrl(configured, false)).toThrow(error);
  });

  it('defaults to the /api route prefix when no API path is configured', () => {
    expect(buildApiUrl('/programs')).toBe('http://localhost:3001/api/programs');
  });

  it('preserves a configured API path prefix', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/mobile-api';

    expect(buildApiUrl('/programs')).toBe('https://api.example.com/mobile-api/programs');
  });

  it('rejects a cleartext http:// API URL in production builds', () => {
    const prevDev = (globalThis as { __DEV__?: boolean | undefined }).__DEV__;
    (globalThis as { __DEV__?: boolean | undefined }).__DEV__ = false;
    process.env.EXPO_PUBLIC_API_URL = 'http://api.example.com';
    try {
      expect(() => buildApiUrl('/programs')).toThrow(/https/);
    } finally {
      (globalThis as { __DEV__?: boolean | undefined }).__DEV__ = prevDev;
    }
  });

  it('allows https:// API URL in production builds', () => {
    const prevDev = (globalThis as { __DEV__?: boolean | undefined }).__DEV__;
    (globalThis as { __DEV__?: boolean | undefined }).__DEV__ = false;
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
    try {
      expect(buildApiUrl('/programs')).toBe('https://api.example.com/api/programs');
    } finally {
      (globalThis as { __DEV__?: boolean | undefined }).__DEV__ = prevDev;
    }
  });
});

describe('restoreSession', () => {
  it('uses the /api mobile refresh route by default', async () => {
    const storage = {
      getRefreshToken: jest
        .fn<Promise<string | null>, []>()
        .mockResolvedValue('stored-refresh-token'),
      setRefreshToken: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
      clearRefreshToken: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };

    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          accessToken: 'new-access-token',
          refreshToken: 'rotated-refresh-token',
          user: {
            id: 'user-123',
            email: 'athlete@example.com',
            name: 'Test Athlete',
            avatarUrl: null,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await expect(restoreSession({ storage })).resolves.toEqual({
      accessToken: 'new-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/api/auth/mobile/refresh',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: 'stored-refresh-token' }),
      })
    );
  });

  it('restores the user session and rotates the stored refresh token', async () => {
    const storage = {
      getRefreshToken: jest
        .fn<Promise<string | null>, []>()
        .mockResolvedValue('stored-refresh-token'),
      setRefreshToken: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
      clearRefreshToken: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };

    const refreshSession = jest
      .fn<
        Promise<{
          accessToken: string;
          refreshToken: string;
          user: {
            id: string;
            email: string;
            name: string | null;
            avatarUrl: string | null;
          };
        }>,
        [string]
      >()
      .mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'rotated-refresh-token',
        user: {
          id: 'user-123',
          email: 'athlete@example.com',
          name: 'Test Athlete',
          avatarUrl: null,
        },
      });

    await expect(restoreSession({ storage, refreshSession })).resolves.toEqual({
      accessToken: 'new-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });

    expect(storage.getRefreshToken).toHaveBeenCalledTimes(1);
    expect(refreshSession).toHaveBeenCalledWith('stored-refresh-token');
    expect(storage.setRefreshToken).toHaveBeenCalledWith('rotated-refresh-token');
    expect(storage.clearRefreshToken).not.toHaveBeenCalled();
  });

  it('reuses a single in-flight refresh request for concurrent restores', async () => {
    const storage = {
      getRefreshToken: jest
        .fn<Promise<string | null>, []>()
        .mockResolvedValue('stored-refresh-token'),
      setRefreshToken: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
      clearRefreshToken: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };

    const refreshSession = jest.fn().mockImplementation(
      async () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              accessToken: 'shared-access-token',
              refreshToken: 'shared-refresh-token',
              user: {
                id: 'user-123',
                email: 'athlete@example.com',
                name: 'Test Athlete',
                avatarUrl: null,
              },
            });
          }, 0);
        })
    );

    const [first, second] = await Promise.all([
      restoreSession({ storage, refreshSession }),
      restoreSession({ storage, refreshSession }),
    ]);

    expect(first).toEqual(second);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(storage.setRefreshToken).toHaveBeenCalledTimes(1);
  });

  it('returns null and clears the stored refresh token when refresh is auth-invalid', async () => {
    const storage = {
      getRefreshToken: jest
        .fn<Promise<string | null>, []>()
        .mockResolvedValue('stale-refresh-token'),
      setRefreshToken: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
      clearRefreshToken: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };

    const refreshSession = jest
      .fn<Promise<never>, [string]>()
      .mockRejectedValue(new InvalidRefreshTokenError('AUTH_INVALID_REFRESH'));

    await expect(restoreSession({ storage, refreshSession })).resolves.toBeNull();

    expect(refreshSession).toHaveBeenCalledWith('stale-refresh-token');
    expect(storage.clearRefreshToken).toHaveBeenCalledTimes(1);
    expect(storage.setRefreshToken).not.toHaveBeenCalled();
  });

  it('preserves the stored refresh token when refresh fails transiently', async () => {
    const storage = {
      getRefreshToken: jest
        .fn<Promise<string | null>, []>()
        .mockResolvedValue('retryable-refresh-token'),
      setRefreshToken: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
      clearRefreshToken: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };

    const refreshSession = jest
      .fn<Promise<never>, [string]>()
      .mockRejectedValue(new Error('Network request failed'));

    setAccessToken('stale-access-token');

    await expect(restoreSession({ storage, refreshSession })).resolves.toBeNull();

    expect(refreshSession).toHaveBeenCalledWith('retryable-refresh-token');
    expect(storage.clearRefreshToken).not.toHaveBeenCalled();
    expect(storage.setRefreshToken).not.toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
  });

  it('falls back to the cookie-based session for an email session marker', async () => {
    const storage = {
      getRefreshToken: jest.fn<Promise<string | null>, []>().mockResolvedValue(null),
      setRefreshToken: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
      clearRefreshToken: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };
    const sessionKindStorage = {
      getSessionKind: jest.fn<Promise<'google' | 'email' | null>, []>().mockResolvedValue('email'),
      setSessionKind: jest.fn<Promise<void>, ['google' | 'email']>().mockResolvedValue(),
      clearSessionKind: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };

    const restoreCookieSession = jest
      .fn<Promise<{ accessToken: string; user: typeof AUTH_USER } | null>, []>()
      .mockResolvedValue({ accessToken: 'cookie-access-token', user: AUTH_USER });

    await expect(
      restoreSession({ storage, sessionKindStorage, restoreCookieSession })
    ).resolves.toEqual({ accessToken: 'cookie-access-token', user: AUTH_USER });

    expect(restoreCookieSession).toHaveBeenCalledTimes(1);
    expect(storage.setRefreshToken).not.toHaveBeenCalled();
  });

  it('skips the cookie fallback and returns null when no session marker is present', async () => {
    const storage = {
      getRefreshToken: jest.fn<Promise<string | null>, []>().mockResolvedValue(null),
      setRefreshToken: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
      clearRefreshToken: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };
    const sessionKindStorage = {
      getSessionKind: jest.fn<Promise<'google' | 'email' | null>, []>().mockResolvedValue(null),
      setSessionKind: jest.fn<Promise<void>, ['google' | 'email']>().mockResolvedValue(),
      clearSessionKind: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };

    const restoreCookieSession = jest.fn<Promise<null>, []>().mockResolvedValue(null);

    await expect(
      restoreSession({ storage, sessionKindStorage, restoreCookieSession })
    ).resolves.toBeNull();
    // A signed-out or Google user must not incur a cookie round-trip at launch.
    expect(restoreCookieSession).not.toHaveBeenCalled();
  });

  it('refreshes the mobile session and retries unauthorized requests once', async () => {
    setAccessToken('expired-access-token');

    const restoreAuthorizedSession = jest.fn().mockResolvedValue({
      accessToken: 'fresh-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });

    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(new Response('expired', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));

    const { accessToken, response } = await fetchWithAccessToken('/programs', undefined, {
      restoreAuthorizedSession,
    });

    expect(response.status).toBe(200);
    expect(accessToken).toBe('fresh-access-token');
    expect(restoreAuthorizedSession).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3001/api/programs',
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3001/api/programs',
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );

    const firstHeaders = fetchSpy.mock.calls[0]?.[1]?.headers;
    if (!(firstHeaders instanceof Headers)) {
      throw new Error('Expected the first authorized request to include Headers');
    }

    const secondHeaders = fetchSpy.mock.calls[1]?.[1]?.headers;
    if (!(secondHeaders instanceof Headers)) {
      throw new Error('Expected the retried authorized request to include Headers');
    }

    expect(firstHeaders.get('Authorization')).toBe('Bearer expired-access-token');
    expect(secondHeaders.get('Authorization')).toBe('Bearer fresh-access-token');
  });
});

describe('signInWithGoogleIdToken', () => {
  it('exchanges the Google credential and stores the rotated refresh token', async () => {
    const storage = {
      getRefreshToken: jest.fn<Promise<string | null>, []>().mockResolvedValue(null),
      setRefreshToken: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
      clearRefreshToken: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };

    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          user: {
            id: 'user-123',
            email: 'athlete@example.com',
            name: 'Test Athlete',
            avatarUrl: null,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await expect(signInWithGoogleIdToken('google-id-token', { storage })).resolves.toEqual({
      accessToken: 'new-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/api/auth/mobile/google',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential: 'google-id-token' }),
      })
    );
    expect(storage.setRefreshToken).toHaveBeenCalledWith('new-refresh-token');
    // AuthProvider publishes this only after SQLite/SecureStore ownership passes.
    expect(getAccessToken()).toBeNull();
  });

  it('keeps an existing email session when the Google exchange fails', async () => {
    const sessionKindStorage = {
      getSessionKind: jest.fn<Promise<'google' | 'email' | null>, []>().mockResolvedValue('email'),
      setSessionKind: jest.fn<Promise<void>, ['google' | 'email']>().mockResolvedValue(),
      clearSessionKind: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };
    const revokeCookieSession = jest.fn<Promise<void>, []>().mockResolvedValue();
    const authenticateWithGoogleIdToken = jest
      .fn()
      .mockRejectedValue(new Error('Google exchange failed'));

    await expect(
      signInWithGoogleIdToken('bad-google-token', {
        sessionKindStorage,
        authenticateWithGoogleIdToken,
        revokeCookieSession,
      })
    ).rejects.toThrow('Google exchange failed');

    expect(revokeCookieSession).not.toHaveBeenCalled();
    expect(sessionKindStorage.setSessionKind).not.toHaveBeenCalled();
  });

  it('rejects production Expo Web before creating a server session', async () => {
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const authenticateWithGoogleIdToken = jest.fn().mockResolvedValue({
      accessToken: 'must-not-be-created',
      refreshToken: 'must-not-be-created',
      user: AUTH_USER,
    });

    try {
      await expect(
        signInWithGoogleIdToken('google-id-token', { authenticateWithGoogleIdToken })
      ).rejects.toThrow(/unavailable in production Expo Web/);
      expect(authenticateWithGoogleIdToken).not.toHaveBeenCalled();
    } finally {
      if (originalPlatformDescriptor) {
        Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
      }
      if (originalDev === undefined) {
        delete (globalThis as { __DEV__?: boolean }).__DEV__;
      } else {
        (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
      }
    }
  });

  it('revokes the minted session when its refresh token cannot be stored securely', async () => {
    const storage = {
      getRefreshToken: jest.fn<Promise<string | null>, []>().mockResolvedValue(null),
      setRefreshToken: jest
        .fn<Promise<void>, [string]>()
        .mockRejectedValue(new Error('SecureStore unavailable')),
      clearRefreshToken: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };
    const authenticateWithGoogleIdToken = jest.fn().mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      user: AUTH_USER,
    });
    const revokeRemoteSession = jest.fn<Promise<void>, [string]>().mockResolvedValue();

    await expect(
      signInWithGoogleIdToken('google-id-token', {
        storage,
        authenticateWithGoogleIdToken,
        revokeRemoteSession,
      })
    ).rejects.toThrow('SecureStore unavailable');

    expect(revokeRemoteSession).toHaveBeenCalledWith('new-refresh-token');
    expect(getAccessToken()).toBeNull();
  });
});

describe('signOutSession', () => {
  function createSignOutStorage() {
    return {
      storage: {
        getRefreshToken: jest
          .fn<Promise<string | null>, []>()
          .mockResolvedValue('stored-refresh-token'),
        setRefreshToken: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
        clearRefreshToken: jest.fn<Promise<void>, []>().mockResolvedValue(),
      },
      sessionKindStorage: {
        getSessionKind: jest
          .fn<Promise<'google' | 'email' | null>, []>()
          .mockResolvedValue('google'),
        setSessionKind: jest.fn<Promise<void>, ['google' | 'email']>().mockResolvedValue(),
        clearSessionKind: jest.fn<Promise<void>, []>().mockResolvedValue(),
      },
    };
  }

  it('revokes the remote refresh token before clearing durable and in-memory state', async () => {
    const { storage, sessionKindStorage } = createSignOutStorage();
    const revokeRemoteSession = jest.fn<Promise<void>, [string]>().mockResolvedValue();
    setAccessToken('mobile-access-token');

    await expect(
      signOutSession({ storage, sessionKindStorage, revokeRemoteSession })
    ).resolves.toBeUndefined();

    expect(revokeRemoteSession).toHaveBeenCalledWith('stored-refresh-token');
    expect(storage.clearRefreshToken).toHaveBeenCalledTimes(1);
    expect(sessionKindStorage.clearSessionKind).toHaveBeenCalledTimes(1);
    expect(revokeRemoteSession.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      storage.clearRefreshToken.mock.invocationCallOrder[0] ?? 0
    );
    expect(getAccessToken()).toBeNull();
  });

  it('revokes the cookie session when there is no stored refresh token', async () => {
    const { storage, sessionKindStorage } = createSignOutStorage();
    storage.getRefreshToken.mockResolvedValue(null);
    const revokeRemoteSession = jest.fn<Promise<void>, [string]>().mockResolvedValue();
    const revokeCookieSession = jest.fn<Promise<void>, []>().mockResolvedValue();
    setAccessToken('cookie-access-token');

    await expect(
      signOutSession({
        storage,
        sessionKindStorage,
        revokeRemoteSession,
        revokeCookieSession,
      })
    ).resolves.toBeUndefined();

    expect(revokeCookieSession).toHaveBeenCalledTimes(1);
    expect(revokeRemoteSession).not.toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
  });

  it('clears durable credentials even when cookie revocation fails offline', async () => {
    const { storage, sessionKindStorage } = createSignOutStorage();
    storage.getRefreshToken.mockResolvedValue(null);
    const revokeCookieSession = jest
      .fn<Promise<void>, []>()
      .mockRejectedValue(new Error('Network request failed'));

    await expect(
      signOutSession({ storage, sessionKindStorage, revokeCookieSession })
    ).resolves.toBeUndefined();

    expect(sessionKindStorage.clearSessionKind).toHaveBeenCalledTimes(1);
    expect(storage.clearRefreshToken).toHaveBeenCalledTimes(1);
  });

  it.each([
    { failedCredential: 'refreshToken' as const },
    { failedCredential: 'sessionKind' as const },
  ])(
    'retains in-memory state and attempts both deletions when $failedCredential deletion fails',
    async ({ failedCredential }) => {
      const { storage, sessionKindStorage } = createSignOutStorage();
      if (failedCredential === 'refreshToken') {
        storage.clearRefreshToken.mockRejectedValue(new Error('SecureStore token delete failed'));
      } else {
        sessionKindStorage.clearSessionKind.mockRejectedValue(
          new Error('SecureStore marker delete failed')
        );
      }
      setAccessToken('retryable-access-token');

      const signOut = signOutSession({
        storage,
        sessionKindStorage,
        revokeRemoteSession: jest.fn().mockResolvedValue(undefined),
      });

      await expect(signOut).rejects.toEqual(
        expect.objectContaining<Partial<SignOutCredentialDeletionError>>({
          name: 'SignOutCredentialDeletionError',
          failedCredentials: [failedCredential],
        })
      );
      expect(storage.clearRefreshToken).toHaveBeenCalledTimes(1);
      expect(sessionKindStorage.clearSessionKind).toHaveBeenCalledTimes(1);
      expect(getAccessToken()).toBe('retryable-access-token');
    }
  );
});

describe('signInWithEmailPassword', () => {
  it('establishes an access-token session from the login response', async () => {
    const login = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ user: AUTH_USER, accessToken: 'email-access-token' }));

    await expect(
      signInWithEmailPassword('athlete@example.com', 'correct-horse', { login })
    ).resolves.toEqual({
      ok: true,
      session: { accessToken: 'email-access-token', user: AUTH_USER },
    });

    expect(login).toHaveBeenCalledWith('athlete@example.com', 'correct-horse');
    // AuthProvider publishes this only after SQLite/SecureStore ownership passes.
    expect(getAccessToken()).toBeNull();
  });

  it('maps a 401 to INVALID_CREDENTIALS', async () => {
    const login = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ error: 'Invalid email or password' }, 401));

    await expect(
      signInWithEmailPassword('athlete@example.com', 'wrong', { login })
    ).resolves.toEqual({ ok: false, code: 'INVALID_CREDENTIALS' });
    expect(getAccessToken()).toBeNull();
  });

  it('surfaces the EMAIL_NOT_VERIFIED code from a 403 body', async () => {
    const login = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(
        jsonResponse({ error: 'Email not verified', code: 'EMAIL_NOT_VERIFIED' }, 403)
      );

    await expect(
      signInWithEmailPassword('athlete@example.com', 'unverified', { login })
    ).resolves.toEqual({ ok: false, code: 'EMAIL_NOT_VERIFIED' });
  });

  it('maps a 429 to RATE_LIMITED when the body carries no code', async () => {
    const login = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(new Response('rate limited', { status: 429 }));

    await expect(
      signInWithEmailPassword('athlete@example.com', 'correct-horse', { login })
    ).resolves.toEqual({ ok: false, code: 'RATE_LIMITED' });
  });

  it('revokes and clears a leftover Google refresh token on successful email sign-in', async () => {
    const login = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ user: AUTH_USER, accessToken: 'email-access-token' }));
    const storage = {
      getRefreshToken: jest
        .fn<Promise<string | null>, []>()
        .mockResolvedValue('stale-google-token'),
      setRefreshToken: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
      clearRefreshToken: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };
    const revokeRemoteSession = jest.fn<Promise<void>, [string]>().mockResolvedValue();

    await expect(
      signInWithEmailPassword('athlete@example.com', 'correct-horse', {
        login,
        storage,
        revokeRemoteSession,
      })
    ).resolves.toMatchObject({ ok: true });

    // The stale token is revoked server-side BEFORE the local copy is dropped;
    // otherwise the server row stays valid for its full TTL with nobody left
    // holding the value.
    expect(revokeRemoteSession).toHaveBeenCalledWith('stale-google-token');
    expect(storage.clearRefreshToken).toHaveBeenCalledTimes(1);
  });

  it('still signs in when revoking the leftover token fails', async () => {
    const login = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ user: AUTH_USER, accessToken: 'email-access-token' }));
    const storage = {
      getRefreshToken: jest
        .fn<Promise<string | null>, []>()
        .mockResolvedValue('stale-google-token'),
      setRefreshToken: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
      clearRefreshToken: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };
    const revokeRemoteSession = jest
      .fn<Promise<void>, [string]>()
      .mockRejectedValue(new Error('offline'));

    await expect(
      signInWithEmailPassword('athlete@example.com', 'correct-horse', {
        login,
        storage,
        revokeRemoteSession,
      })
    ).resolves.toMatchObject({ ok: true });

    expect(storage.clearRefreshToken).toHaveBeenCalledTimes(1);
  });
});

describe('signUpWithEmailPassword', () => {
  it('reports success without minting a session', async () => {
    const signup = jest
      .fn<Promise<Response>, [string, string, string | undefined]>()
      .mockResolvedValue(jsonResponse({ message: 'Account created.' }, 201));

    await expect(
      signUpWithEmailPassword('new@example.com', 'brand-new-pass', 'New Athlete', { signup })
    ).resolves.toEqual({ ok: true });

    expect(signup).toHaveBeenCalledWith('new@example.com', 'brand-new-pass', 'New Athlete');
    expect(getAccessToken()).toBeNull();
  });

  it('surfaces the EMAIL_TAKEN code from a 409 conflict', async () => {
    const signup = jest
      .fn<Promise<Response>, [string, string, string | undefined]>()
      .mockResolvedValue(
        jsonResponse(
          { error: 'An account with this email already exists', code: 'EMAIL_TAKEN' },
          409
        )
      );

    await expect(
      signUpWithEmailPassword('taken@example.com', 'another-pass', undefined, { signup })
    ).resolves.toEqual({ ok: false, code: 'EMAIL_TAKEN' });
  });
});

describe('signInWithDev', () => {
  it('mints a cookie session and marks session kind as email', async () => {
    const authenticate = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ accessToken: 'dev-access', user: AUTH_USER }, 201));
    const storage = {
      getRefreshToken: jest.fn<Promise<string | null>, []>().mockResolvedValue(null),
      setRefreshToken: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
      clearRefreshToken: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };
    const sessionKindStorage = {
      getSessionKind: jest.fn<Promise<'google' | 'email' | null>, []>().mockResolvedValue(null),
      setSessionKind: jest.fn<Promise<void>, ['google' | 'email']>().mockResolvedValue(),
      clearSessionKind: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };

    const result = await signInWithDev({ authenticate, storage, sessionKindStorage });

    expect(result).toEqual({
      ok: true,
      session: { accessToken: 'dev-access', user: AUTH_USER },
    });
    expect(authenticate).toHaveBeenCalledWith(DEFAULT_DEV_AUTH_EMAIL, DEFAULT_DEV_AUTH_SECRET);
    expect(sessionKindStorage.setSessionKind).toHaveBeenCalledWith('email');
    // AuthProvider publishes this only after SQLite/SecureStore ownership passes.
    expect(getAccessToken()).toBeNull();
  });

  it('maps 401 to UNAUTHORIZED/INVALID_CREDENTIALS path via status', async () => {
    const authenticate = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ error: 'nope', code: 'UNAUTHORIZED' }, 401));

    await expect(signInWithDev({ authenticate })).resolves.toEqual({
      ok: false,
      code: 'UNAUTHORIZED',
    });
  });
});

describe('offline identity and refresh boundaries', () => {
  const storage = () => ({
    getRefreshToken: jest.fn(async () => 'durable-refresh'),
    setRefreshToken: jest.fn(async (_token: string) => undefined),
    clearRefreshToken: jest.fn(async () => undefined),
  });
  const marker = () => ({
    getSessionKind: jest.fn(async (): Promise<'email'> => 'email'),
    setSessionKind: jest.fn(async () => undefined),
    clearSessionKind: jest.fn(async () => undefined),
  });

  it.each([408, 429, 500, 503])(
    'exposes a retryable %i without deleting credentials',
    async (status) => {
      globalThis.fetch = jest.fn(async () => jsonResponse({}, status));
      const credentials = storage();
      await expect(restoreSession({ storage: credentials })).rejects.toBeInstanceOf(
        SessionUnavailableError
      );
      expect(credentials.clearRefreshToken).not.toHaveBeenCalled();
      credentials.getRefreshToken.mockResolvedValue('');
      const sessionKindStorage = marker();
      await expect(
        restoreSession({ storage: credentials, sessionKindStorage })
      ).rejects.toBeInstanceOf(SessionUnavailableError);
      expect(sessionKindStorage.clearSessionKind).not.toHaveBeenCalled();
    }
  );

  it('distinguishes native connectivity failures from malformed server responses and storage failures', async () => {
    const credentials = storage();
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(restoreSession({ storage: credentials })).rejects.toBeInstanceOf(
      SessionUnavailableError
    );
    globalThis.fetch = jest.fn(async () => jsonResponse({ unexpected: true }));
    await expect(restoreSession({ storage: credentials })).resolves.toBeNull();
    globalThis.fetch = jest.fn(async () =>
      jsonResponse({ user: AUTH_USER, accessToken: 'access', refreshToken: 'new' })
    );
    credentials.setRefreshToken.mockRejectedValue(new TypeError('SecureStore failed'));
    await expect(restoreSession({ storage: credentials })).resolves.toBeNull();
  });

  it.each([401, 403])(
    'invalidates cookie offline eligibility after explicit HTTP %i',
    async (status) => {
      globalThis.fetch = jest.fn(async () => jsonResponse({}, status));
      const credentials = storage();
      credentials.getRefreshToken.mockResolvedValue('');
      const sessionKindStorage = marker();
      await expect(
        restoreSession({ storage: credentials, sessionKindStorage })
      ).resolves.toBeNull();
      expect(sessionKindStorage.clearSessionKind).toHaveBeenCalledTimes(1);
    }
  );

  it('only reads valid identity belonging to the secure local owner', async () => {
    const read = jest
      .spyOn(secureOfflineIdentityStorage, 'get')
      .mockResolvedValue(JSON.stringify(AUTH_USER));
    const owner = jest
      .spyOn(secureLocalDataOwnerStorage, 'getOwnerId')
      .mockResolvedValue(AUTH_USER.id);
    await expect(readOfflineUser()).resolves.toEqual(AUTH_USER);
    owner.mockResolvedValue('different-owner');
    await expect(readOfflineUser()).resolves.toBeNull();
    owner.mockResolvedValue(AUTH_USER.id);
    read.mockResolvedValue('{broken');
    await expect(readOfflineUser()).resolves.toBeNull();
    read.mockRejectedValue(new Error('SecureStore unavailable'));
    await expect(readOfflineUser()).rejects.toThrow('SecureStore unavailable');
  });

  it('does not persist an identity before its owner is prepared', async () => {
    jest.spyOn(secureLocalDataOwnerStorage, 'getOwnerId').mockResolvedValue('another-owner');
    const write = jest.spyOn(secureOfflineIdentityStorage, 'set').mockResolvedValue();
    await expect(rememberOfflineUser(AUTH_USER)).rejects.toThrow('does not own');
    expect(write).not.toHaveBeenCalled();
  });

  it('finishes refresh rotation before sign-out deletion and blocks new restores during sign-out', async () => {
    const credentials = storage();
    let finishRefresh = (_response: {
      user: typeof AUTH_USER;
      accessToken: string;
      refreshToken: string;
    }): void => undefined;
    const refreshSession = jest.fn(
      () =>
        new Promise<{ user: typeof AUTH_USER; accessToken: string; refreshToken: string }>(
          (resolve) => {
            finishRefresh = resolve;
          }
        )
    );
    const restoring = restoreSession({ storage: credentials, refreshSession });
    await Promise.resolve();
    const signingOut = signOutSession({
      storage: credentials,
      sessionKindStorage: marker(),
      revokeRemoteSession: async () => undefined,
    });
    await expect(restoreSession({ storage: credentials, refreshSession })).resolves.toBeNull();
    expect(credentials.clearRefreshToken).not.toHaveBeenCalled();
    finishRefresh({ user: AUTH_USER, accessToken: 'rotated', refreshToken: 'rotated' });
    await Promise.all([restoring, signingOut]);
    expect(credentials.setRefreshToken.mock.invocationCallOrder[0] ?? Infinity).toBeLessThan(
      credentials.clearRefreshToken.mock.invocationCallOrder[0] ?? 0
    );
    expect(getAccessToken()).toBeNull();
  });
  it('preserves refresh Retry-After across immediate recovery and later resume attempts', async () => {
    let now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
    const credentials = storage();
    const fetchSpy = jest
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '60' } }))
      .mockResolvedValue(
        jsonResponse({ user: AUTH_USER, accessToken: 'access', refreshToken: 'rotated' })
      );
    globalThis.fetch = fetchSpy;
    try {
      await expect(restoreSession({ storage: credentials })).rejects.toMatchObject({
        retryAt: now + 60_000,
      });
      await expect(restoreSession({ storage: credentials })).rejects.toBeInstanceOf(
        SessionUnavailableError
      );
      now += 59_999;
      await expect(restoreSession({ storage: credentials })).rejects.toBeInstanceOf(
        SessionUnavailableError
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      now += 1;
      await expect(restoreSession({ storage: credentials })).resolves.toMatchObject({
        accessToken: 'access',
      });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    } finally {
      // Expire the process-local pause even when an assertion fails.
      now += 60_000;
      await restoreSession({ storage: credentials });
      clock.mockRestore();
    }
  });
});
