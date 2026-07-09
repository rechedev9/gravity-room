import {
  buildApiUrl,
  fetchWithAccessToken,
  getAccessToken,
  InvalidRefreshTokenError,
  restoreSession,
  setAccessToken,
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
  setAccessToken(null);
  globalThis.fetch = originalFetch;
  if (originalExpoPublicApiUrl === undefined) {
    delete process.env.EXPO_PUBLIC_API_URL;
    return;
  }

  process.env.EXPO_PUBLIC_API_URL = originalExpoPublicApiUrl;
});

describe('buildApiUrl', () => {
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
    expect(getAccessToken()).toBe('new-access-token');
  });
});

describe('signOutSession', () => {
  it('revokes the remote refresh token before clearing local session state', async () => {
    const storage = {
      getRefreshToken: jest
        .fn<Promise<string | null>, []>()
        .mockResolvedValue('stored-refresh-token'),
      setRefreshToken: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
      clearRefreshToken: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };

    const revokeRemoteSession = jest.fn<Promise<void>, [string]>().mockResolvedValue();
    setAccessToken('mobile-access-token');

    await expect(signOutSession({ storage, revokeRemoteSession })).resolves.toBeUndefined();

    expect(revokeRemoteSession).toHaveBeenCalledWith('stored-refresh-token');
    expect(storage.clearRefreshToken).toHaveBeenCalledTimes(1);

    const revokeOrder = revokeRemoteSession.mock.invocationCallOrder[0];
    const clearOrder = storage.clearRefreshToken.mock.invocationCallOrder[0];
    expect(revokeOrder).toBeDefined();
    expect(clearOrder).toBeDefined();
    expect(revokeOrder ?? 0).toBeLessThan(clearOrder ?? 0);
    expect(getAccessToken()).toBeNull();
  });

  it('revokes the cookie session when there is no stored refresh token', async () => {
    const storage = {
      getRefreshToken: jest.fn<Promise<string | null>, []>().mockResolvedValue(null),
      setRefreshToken: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
      clearRefreshToken: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };

    const revokeRemoteSession = jest.fn<Promise<void>, [string]>().mockResolvedValue();
    const revokeCookieSession = jest.fn<Promise<void>, []>().mockResolvedValue();
    setAccessToken('cookie-access-token');

    await expect(
      signOutSession({ storage, revokeRemoteSession, revokeCookieSession })
    ).resolves.toBeUndefined();

    expect(revokeCookieSession).toHaveBeenCalledTimes(1);
    expect(revokeRemoteSession).not.toHaveBeenCalled();
    expect(storage.clearRefreshToken).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it('clears the session marker even when cookie revocation fails offline', async () => {
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
    const revokeCookieSession = jest
      .fn<Promise<void>, []>()
      .mockRejectedValue(new Error('Network request failed'));

    await expect(
      signOutSession({ storage, sessionKindStorage, revokeCookieSession })
    ).resolves.toBeUndefined();

    // The failed remote revocation must not leave the marker behind, or the next
    // launch would resurrect the still-valid cookie session.
    expect(sessionKindStorage.clearSessionKind).toHaveBeenCalledTimes(1);
    expect(storage.clearRefreshToken).toHaveBeenCalledTimes(1);
  });
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
    expect(getAccessToken()).toBe('email-access-token');
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
