import {
  buildApiUrl,
  captureAuthorizedSession,
  fetchWithAuthorizedSession,
  fetchWithAccessToken,
  getAccessToken,
  getAuthorizedSessionAccessToken,
  InvalidRefreshTokenError,
  isAuthorizedSessionCurrent,
  ObsoleteAuthorizedSessionError,
  restoreSession,
  setAccessToken,
  signInWithEmailPassword,
  signInWithGoogleIdToken,
  signOutSession,
  signUpWithEmailPassword,
  type SessionState,
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

function runAsProduction(task: () => void): void {
  const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');
  Object.defineProperty(globalThis, '__DEV__', {
    configurable: true,
    value: false,
    writable: true,
  });

  try {
    task();
  } finally {
    if (previousDescriptor) {
      Object.defineProperty(globalThis, '__DEV__', previousDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, '__DEV__');
    }
  }
}

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
    process.env.EXPO_PUBLIC_API_URL = 'http://api.example.com';
    runAsProduction(() => {
      expect(() => buildApiUrl('/programs')).toThrow(/https/);
    });
  });

  it('allows https:// API URL in production builds', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
    runAsProduction(() => {
      expect(buildApiUrl('/programs')).toBe('https://api.example.com/api/programs');
    });
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

  it('does not use a delayed email marker after sign-out clears it', async () => {
    let releaseKindRead: (value: 'email') => void = () => undefined;
    let markKindReadStarted = (): void => undefined;
    const kindReadStarted = new Promise<void>((resolve) => {
      markKindReadStarted = resolve;
    });
    const storage = {
      getRefreshToken: jest.fn(async () => null),
      setRefreshToken: jest.fn(async () => undefined),
      clearRefreshToken: jest.fn(async () => undefined),
    };
    const sessionKindStorage = {
      getSessionKind: jest.fn(
        () =>
          new Promise<'email'>((resolve) => {
            markKindReadStarted();
            releaseKindRead = resolve;
          })
      ),
      setSessionKind: jest.fn(async () => undefined),
      clearSessionKind: jest.fn(async () => undefined),
    };
    const restoreCookieSession = jest.fn<Promise<never>, []>();
    const pendingRestore = restoreSession({
      storage,
      sessionKindStorage,
      restoreCookieSession,
    });
    const restoreExpectation = expect(pendingRestore).rejects.toThrow('session changed');
    await kindReadStarted;

    await expect(
      signOutSession({
        storage,
        sessionKindStorage,
        revokeCookieSession: jest.fn(async () => undefined),
      })
    ).resolves.toBeUndefined();
    releaseKindRead('email');

    await restoreExpectation;
    expect(restoreCookieSession).not.toHaveBeenCalled();
    expect(sessionKindStorage.clearSessionKind).toHaveBeenCalledTimes(1);
  });

  it('aborts an in-flight cookie restore when a newer login starts', async () => {
    let markRestoreStarted = (): void => undefined;
    const restoreStarted = new Promise<void>((resolve) => {
      markRestoreStarted = resolve;
    });
    const restoreSignal: { value: AbortSignal | null } = { value: null };
    globalThis.fetch = jest.fn((_input, init) => {
      restoreSignal.value = init?.signal ?? null;
      markRestoreStarted();
      return new Promise<Response>((_resolve, reject) => {
        restoreSignal.value?.addEventListener('abort', () => {
          reject(new Error('restore aborted'));
        });
      });
    });
    const storage = {
      async getRefreshToken() {
        return null;
      },
      async setRefreshToken() {},
      async clearRefreshToken() {},
    };
    const sessionKindStorage = {
      async getSessionKind() {
        return 'email' as const;
      },
      async setSessionKind() {},
      async clearSessionKind() {},
    };
    const pendingRestore = restoreSession({ storage, sessionKindStorage });
    const restoreExpectation = expect(pendingRestore).rejects.toThrow('session changed');
    await restoreStarted;

    await expect(
      signInWithEmailPassword('athlete@example.com', 'password', {
        login: jest
          .fn<Promise<Response>, [string, string]>()
          .mockResolvedValue(jsonResponse({ code: 'INVALID_CREDENTIALS' }, 401)),
      })
    ).resolves.toEqual({ ok: false, code: 'INVALID_CREDENTIALS' });
    await restoreExpectation;
    expect(restoreSignal.value?.aborted).toBe(true);
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
  it('completes durable sign-out without waiting for a hung restore transition', async () => {
    const accessA = 'a';
    const accessB = 'b';
    const refreshB = 'fixture-b';
    const login = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ user: AUTH_USER, accessToken: accessA }));
    await signInWithEmailPassword('a@example.com', 'password', { login });
    const captured = captureAuthorizedSession(AUTH_USER.id);
    let resolveRefresh: (value: {
      accessToken: string;
      refreshToken: string;
      user: typeof AUTH_USER;
    }) => void = () => undefined;
    let markRefreshStarted = (): void => undefined;
    const refreshStarted = new Promise<void>((resolve) => {
      markRefreshStarted = resolve;
    });
    const restoreStorage = {
      async getRefreshToken() {
        return 'fixture-a';
      },
      async setRefreshToken() {},
      async clearRefreshToken() {},
    };
    const refreshSession = jest.fn(
      () =>
        new Promise<{
          accessToken: string;
          refreshToken: string;
          user: typeof AUTH_USER;
        }>((resolve) => {
          markRefreshStarted();
          resolveRefresh = resolve;
        })
    );
    const pendingRestore = restoreSession({ storage: restoreStorage, refreshSession });
    await refreshStarted;
    const signOutStorage = {
      async getRefreshToken() {
        return null;
      },
      async setRefreshToken() {},
      clearRefreshToken: jest.fn(async () => undefined),
    };

    const pendingSignOut = signOutSession({
      storage: signOutStorage,
      revokeCookieSession: jest.fn(async () => undefined),
    });

    expect(getAccessToken()).toBeNull();
    expect(isAuthorizedSessionCurrent(captured)).toBe(false);
    await expect(pendingSignOut).resolves.toBeUndefined();
    expect(signOutStorage.clearRefreshToken).toHaveBeenCalledTimes(1);
    const postSignOutLogin = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ code: 'INVALID_CREDENTIALS' }, 401));
    await expect(
      signInWithEmailPassword('athlete@example.com', 'password', {
        login: postSignOutLogin,
        storage: signOutStorage,
      })
    ).resolves.toEqual({ ok: false, code: 'INVALID_CREDENTIALS' });
    expect(postSignOutLogin).toHaveBeenCalledTimes(1);

    resolveRefresh({
      accessToken: accessB,
      refreshToken: refreshB,
      user: AUTH_USER,
    });
    await expect(pendingRestore).rejects.toThrow('session changed');
  });

  it('starts a new restore after sign-out instead of joining an obsolete hung restore', async () => {
    let markObsoleteRestoreStarted = (): void => undefined;
    const obsoleteRestoreStarted = new Promise<void>((resolve) => {
      markObsoleteRestoreStarted = resolve;
    });
    const obsoleteRefresh = jest.fn(
      () =>
        new Promise<never>(() => {
          markObsoleteRestoreStarted();
        })
    );
    const obsoleteStorage = {
      async getRefreshToken() {
        return 'fixture-c';
      },
      async setRefreshToken() {},
      async clearRefreshToken() {},
    };

    void restoreSession({ storage: obsoleteStorage, refreshSession: obsoleteRefresh });
    await obsoleteRestoreStarted;

    const signOutStorage = {
      async getRefreshToken() {
        return null;
      },
      async setRefreshToken() {},
      clearRefreshToken: jest.fn(async () => undefined),
    };
    await signOutSession({
      storage: signOutStorage,
      revokeCookieSession: jest.fn(async () => undefined),
    });

    const login = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ user: AUTH_USER, accessToken: 'c' }));
    await expect(
      signInWithEmailPassword('athlete@example.com', 'password', {
        login,
        storage: signOutStorage,
      })
    ).resolves.toMatchObject({ ok: true });

    const refreshE = 'fixture-e';
    const currentRefresh = jest.fn().mockResolvedValue({
      accessToken: 'd',
      refreshToken: refreshE,
      user: AUTH_USER,
    });
    const currentStorage = {
      async getRefreshToken() {
        return 'fixture-d';
      },
      setRefreshToken: jest.fn(async () => undefined),
      async clearRefreshToken() {},
    };

    await expect(
      restoreSession({ storage: currentStorage, refreshSession: currentRefresh })
    ).resolves.toEqual({
      accessToken: 'd',
      user: AUTH_USER,
    });
    expect(obsoleteRefresh).toHaveBeenCalledTimes(1);
    expect(currentRefresh).toHaveBeenCalledWith('fixture-d');
    expect(currentStorage.setRefreshToken).toHaveBeenCalledWith(refreshE);
  });

  it('clears local session state before starting remote refresh-token revocation', async () => {
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
    expect(clearOrder ?? 0).toBeLessThan(revokeOrder ?? 0);
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

  it('attempts remote logout and every local clear when the session marker clear fails', async () => {
    const clearStoredSession = jest.fn(async () => undefined);
    const storage = {
      async getRefreshToken() {
        return null;
      },
      async setRefreshToken() {},
      clearRefreshToken() {
        return clearStoredSession();
      },
    };
    const markerError = new Error('session marker unavailable');
    const sessionKindStorage = {
      getSessionKind: jest.fn<Promise<'google' | 'email' | null>, []>().mockResolvedValue('email'),
      setSessionKind: jest.fn<Promise<void>, ['google' | 'email']>().mockResolvedValue(),
      clearSessionKind: jest.fn<Promise<void>, []>().mockRejectedValue(markerError),
    };
    const revokeCookieSession = jest.fn(async () => undefined);

    await expect(signOutSession({ storage, sessionKindStorage, revokeCookieSession })).rejects.toBe(
      markerError
    );

    expect(clearStoredSession).toHaveBeenCalledTimes(1);
    expect(sessionKindStorage.clearSessionKind).toHaveBeenCalledTimes(1);
    expect(revokeCookieSession).toHaveBeenCalledTimes(1);
  });

  it('blocks restore while sign-out is revoking a marker that could not be cleared', async () => {
    let markRevocationStarted = (): void => undefined;
    const revocationStarted = new Promise<void>((resolve) => {
      markRevocationStarted = resolve;
    });
    let releaseRevocation = (): void => undefined;
    const revocationReleased = new Promise<void>((resolve) => {
      releaseRevocation = resolve;
    });
    const markerError = new Error('session marker unavailable');
    const storage = {
      getRefreshToken: jest.fn(async () => null),
      setRefreshToken: jest.fn(async () => undefined),
      clearRefreshToken: jest.fn(async () => undefined),
    };
    const sessionKindStorage = {
      getSessionKind: jest.fn<Promise<'email'>, []>().mockResolvedValue('email'),
      setSessionKind: jest.fn(async () => undefined),
      clearSessionKind: jest.fn(async () => {
        throw markerError;
      }),
    };
    const pendingSignOut = signOutSession({
      storage,
      sessionKindStorage,
      revokeCookieSession: jest.fn(async () => {
        markRevocationStarted();
        await revocationReleased;
      }),
    });
    const signOutExpectation = expect(pendingSignOut).rejects.toBe(markerError);
    await revocationStarted;
    const restoreCookieSession = jest.fn<Promise<never>, []>();

    await expect(
      restoreSession({ storage, sessionKindStorage, restoreCookieSession })
    ).resolves.toBeNull();
    expect(restoreCookieSession).not.toHaveBeenCalled();

    releaseRevocation();
    await signOutExpectation;
  });

  it('orders a later email sign-in after cookie revocation completes', async () => {
    let releaseRevocation = (): void => undefined;
    let markRevocationStarted = (): void => undefined;
    const revocationStarted = new Promise<void>((resolve) => {
      markRevocationStarted = resolve;
    });
    const revocationReleased = new Promise<void>((resolve) => {
      releaseRevocation = resolve;
    });
    const storage = {
      async getRefreshToken() {
        return null;
      },
      async setRefreshToken() {},
      async clearRefreshToken() {},
    };
    const sessionKindStorage = {
      getSessionKind: jest.fn<Promise<'google' | 'email' | null>, []>().mockResolvedValue('email'),
      setSessionKind: jest.fn<Promise<void>, ['google' | 'email']>().mockResolvedValue(),
      clearSessionKind: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };
    const pendingSignOut = signOutSession({
      storage,
      sessionKindStorage,
      revokeCookieSession: jest.fn(async () => {
        markRevocationStarted();
        await revocationReleased;
      }),
    });
    await revocationStarted;
    const login = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ code: 'INVALID_CREDENTIALS' }, 401));
    const pendingSignIn = signInWithEmailPassword('athlete@example.com', 'password', {
      storage,
      sessionKindStorage,
      login,
    });

    await Promise.resolve();
    expect(login).not.toHaveBeenCalled();

    releaseRevocation();
    await expect(pendingSignOut).resolves.toBeUndefined();
    await expect(pendingSignIn).resolves.toEqual({
      ok: false,
      code: 'INVALID_CREDENTIALS',
    });
    expect(login).toHaveBeenCalledTimes(1);
  });

  it('aborts an already-dispatched cookie sign-in before revoking the session', async () => {
    let markLoginStarted = (): void => undefined;
    const loginStarted = new Promise<void>((resolve) => {
      markLoginStarted = resolve;
    });
    const loginWithSignal = jest.fn(
      (_email: string, _password: string, signal?: AbortSignal) =>
        new Promise<Response>((_resolve, reject) => {
          markLoginStarted();
          signal?.addEventListener('abort', () => {
            reject(new Error('login aborted'));
          });
        })
    );
    const pendingSignIn = signInWithEmailPassword('athlete@example.com', 'password', {
      loginWithSignal,
    });
    const signInExpectation = expect(pendingSignIn).rejects.toThrow('login aborted');
    await loginStarted;
    const revokeCookieSession = jest.fn(async () => undefined);

    await expect(signOutSession({ revokeCookieSession })).resolves.toBeUndefined();
    await signInExpectation;

    const signal = loginWithSignal.mock.calls[0]?.[2];
    expect(signal?.aborted).toBe(true);
    expect(revokeCookieSession).toHaveBeenCalledTimes(1);
  });
});

describe('failed Google sign-in persistence', () => {
  it('clears a persisted Google credential when the local commit fails', async () => {
    const persistenceError = new Error('session marker write failed');
    let persistedRefreshToken: string | null = null;
    let persistedSessionKind: 'google' | 'email' | null = null;
    let failKindPersistence = false;
    const storage = {
      async getRefreshToken() {
        return persistedRefreshToken;
      },
      async setRefreshToken(value: string) {
        persistedRefreshToken = value;
      },
      clearRefreshToken: jest.fn(async () => {
        persistedRefreshToken = null;
      }),
    };
    const sessionKindStorage = {
      async getSessionKind() {
        return persistedSessionKind;
      },
      async setSessionKind(value: 'google' | 'email') {
        persistedSessionKind = value;
        if (failKindPersistence) {
          throw persistenceError;
        }
      },
      clearSessionKind: jest.fn(async () => {
        persistedSessionKind = null;
      }),
    };
    await signInWithEmailPassword('a@example.com', 'password', {
      login: jest.fn(async () => jsonResponse({ user: AUTH_USER, accessToken: 'a' })),
      storage,
      sessionKindStorage,
    });
    failKindPersistence = true;
    const userB = { ...AUTH_USER, id: 'user-b', email: 'b@example.com' };
    const authenticateWithGoogleIdToken = jest.fn().mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'rotated',
      user: userB,
    });
    const revokeRemoteSession = jest.fn().mockRejectedValue(new Error('offline'));

    await expect(
      signInWithGoogleIdToken('dummy', {
        storage,
        sessionKindStorage,
        authenticateWithGoogleIdToken,
        revokeRemoteSession,
      })
    ).rejects.toBe(persistenceError);

    expect(storage.clearRefreshToken).toHaveBeenCalledTimes(2);
    expect(sessionKindStorage.clearSessionKind).toHaveBeenCalledTimes(1);
    expect(persistedRefreshToken).toBeNull();
    expect(persistedSessionKind).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(() => captureAuthorizedSession(AUTH_USER.id)).toThrow(ObsoleteAuthorizedSessionError);

    const refreshSession = jest.fn();
    await expect(
      restoreSession({ storage, sessionKindStorage, refreshSession })
    ).resolves.toBeNull();
    expect(refreshSession).not.toHaveBeenCalled();
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

  it('revokes a newly issued cookie when local session persistence fails', async () => {
    const persistenceError = new Error('session marker write failed');
    let failKindPersistence = false;
    const login = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValueOnce(jsonResponse({ user: AUTH_USER, accessToken: 'a' }))
      .mockResolvedValueOnce(
        jsonResponse({
          user: { ...AUTH_USER, id: 'user-b', email: 'b@example.com' },
          accessToken: 'b',
        })
      );
    const storage = {
      getRefreshToken: jest.fn(async () => null),
      setRefreshToken: jest.fn(async () => undefined),
      clearRefreshToken: jest.fn(async () => undefined),
    };
    const sessionKindStorage = {
      getSessionKind: jest.fn(async () => null),
      setSessionKind: jest.fn(async () => {
        if (failKindPersistence) {
          throw persistenceError;
        }
      }),
      clearSessionKind: jest.fn(async () => undefined),
    };
    const revokeCookieSession = jest.fn(async () => undefined);
    await signInWithEmailPassword('a@example.com', 'password', {
      login,
      storage,
      sessionKindStorage,
      revokeCookieSession,
    });
    failKindPersistence = true;

    await expect(
      signInWithEmailPassword('b@example.com', 'password', {
        login,
        storage,
        sessionKindStorage,
        revokeCookieSession,
      })
    ).rejects.toBe(persistenceError);

    expect(revokeCookieSession).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    expect(() => captureAuthorizedSession(AUTH_USER.id)).toThrow(ObsoleteAuthorizedSessionError);
  });

  it('prevents restore after email marker persistence and cookie revocation both fail', async () => {
    const persistenceError = new Error('session marker write failed');
    const login = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ user: AUTH_USER, accessToken: 'a' }));
    let persistedSessionKind: 'google' | 'email' | null = 'email';
    const storage = {
      getRefreshToken: jest.fn(async () => null),
      setRefreshToken: jest.fn(async () => undefined),
      clearRefreshToken: jest.fn(async () => undefined),
    };
    const sessionKindStorage = {
      getSessionKind: jest.fn(async () => persistedSessionKind),
      setSessionKind: jest.fn(async (value: 'google' | 'email') => {
        persistedSessionKind = value;
        throw persistenceError;
      }),
      clearSessionKind: jest.fn(async () => {
        persistedSessionKind = null;
      }),
    };
    const revokeCookieSession = jest.fn(async () => {
      throw new Error('offline');
    });

    await expect(
      signInWithEmailPassword('athlete@example.com', 'password', {
        login,
        storage,
        sessionKindStorage,
        revokeCookieSession,
      })
    ).rejects.toBe(persistenceError);

    expect(sessionKindStorage.clearSessionKind).toHaveBeenCalledTimes(1);
    expect(persistedSessionKind).toBeNull();
    expect(revokeCookieSession).toHaveBeenCalledTimes(1);

    const restoreCookieSession = jest.fn();
    await expect(
      restoreSession({ storage, sessionKindStorage, restoreCookieSession })
    ).resolves.toBeNull();
    expect(restoreCookieSession).not.toHaveBeenCalled();
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

describe('owner-pinned authorized requests', () => {
  it('discards a late restore when a newer login is requested', async () => {
    const accessA = 'a';
    const accessB = 'b';
    const rotatedA = 'r';
    const persistRestored = jest.fn<Promise<void>, [string]>().mockResolvedValue();
    const restoreStorage = {
      async getRefreshToken() {
        return 'fixture-a';
      },
      setRefreshToken(value: string) {
        return persistRestored(value);
      },
      async clearRefreshToken() {},
    };
    let resolveRefresh: (response: {
      accessToken: string;
      refreshToken: string;
      user: typeof AUTH_USER;
    }) => void = () => undefined;
    let markRefreshStarted: () => void = () => undefined;
    const refreshStarted = new Promise<void>((resolve) => {
      markRefreshStarted = resolve;
    });
    const refreshSession = jest.fn(
      () =>
        new Promise<{
          accessToken: string;
          refreshToken: string;
          user: typeof AUTH_USER;
        }>((resolve) => {
          markRefreshStarted();
          resolveRefresh = resolve;
        })
    );
    const pendingRestore = restoreSession({ storage: restoreStorage, refreshSession });
    await refreshStarted;
    expect(refreshSession).toHaveBeenCalledWith('fixture-a');

    const userB = { ...AUTH_USER, id: 'user-b', email: 'b@example.com' };
    const loginB = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ user: userB, accessToken: accessB }));
    const loginStorage = {
      async getRefreshToken() {
        return null;
      },
      async setRefreshToken() {},
      async clearRefreshToken() {},
    };
    const loginKindStorage = {
      getSessionKind: jest.fn<Promise<'google' | 'email' | null>, []>().mockResolvedValue(null),
      setSessionKind: jest.fn<Promise<void>, ['google' | 'email']>().mockResolvedValue(),
      clearSessionKind: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };

    const pendingLogin = signInWithEmailPassword('b@example.com', 'password', {
      login: loginB,
      storage: loginStorage,
      sessionKindStorage: loginKindStorage,
    });
    resolveRefresh({
      accessToken: accessA,
      refreshToken: rotatedA,
      user: AUTH_USER,
    });

    await expect(pendingRestore).rejects.toThrow('session changed');
    await expect(pendingLogin).resolves.toMatchObject({ ok: true });
    expect(persistRestored).not.toHaveBeenCalled();
    expect(captureAuthorizedSession('user-b')).toEqual({
      ownerUserId: 'user-b',
      accessToken: accessB,
      generation: expect.any(Number),
    });
    expect(getAccessToken()).toBe(accessB);
  });

  it('discards a late failed restore when a newer login is requested', async () => {
    const accessB = 'b';
    const restoreStorage = {
      async getRefreshToken() {
        return 'fixture-a';
      },
      async setRefreshToken() {},
      async clearRefreshToken() {},
    };
    let rejectRefresh: (error: Error) => void = () => undefined;
    let markRefreshStarted: () => void = () => undefined;
    const refreshStarted = new Promise<void>((resolve) => {
      markRefreshStarted = resolve;
    });
    const refreshSession = jest.fn(
      () =>
        new Promise<never>((_resolve, reject) => {
          markRefreshStarted();
          rejectRefresh = reject;
        })
    );
    const pendingRestore = restoreSession({ storage: restoreStorage, refreshSession });
    await refreshStarted;
    expect(refreshSession).toHaveBeenCalledWith('fixture-a');

    const userB = { ...AUTH_USER, id: 'user-b', email: 'b@example.com' };
    const loginB = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ user: userB, accessToken: accessB }));
    const loginStorage = {
      async getRefreshToken() {
        return null;
      },
      async setRefreshToken() {},
      async clearRefreshToken() {},
    };
    const loginKindStorage = {
      getSessionKind: jest.fn<Promise<'google' | 'email' | null>, []>().mockResolvedValue(null),
      setSessionKind: jest.fn<Promise<void>, ['google' | 'email']>().mockResolvedValue(),
      clearSessionKind: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };

    const pendingLogin = signInWithEmailPassword('b@example.com', 'password', {
      login: loginB,
      storage: loginStorage,
      sessionKindStorage: loginKindStorage,
    });
    rejectRefresh(new Error('restore failed'));

    await expect(pendingRestore).rejects.toThrow('session changed');
    await expect(pendingLogin).resolves.toMatchObject({ ok: true });
    expect(captureAuthorizedSession('user-b')).toEqual({
      ownerUserId: 'user-b',
      accessToken: accessB,
      generation: expect.any(Number),
    });
    expect(getAccessToken()).toBe(accessB);
  });

  it('orders a newer login after an in-flight restore credential write', async () => {
    const accessA = 'a';
    const accessB = 'b';
    const rotatedA = 'ra';
    const rotatedB = 'rb';
    let persistedValue = 'fixture-a';
    let resolveRestoreWrite: () => void = () => undefined;
    let markRestoreWriteStarted: () => void = () => undefined;
    const restoreWriteStarted = new Promise<void>((resolve) => {
      markRestoreWriteStarted = resolve;
    });
    const restoreWriteReleased = new Promise<void>((resolve) => {
      resolveRestoreWrite = resolve;
    });
    const storage = {
      async getRefreshToken() {
        return persistedValue;
      },
      async setRefreshToken(value: string) {
        if (value === rotatedA) {
          markRestoreWriteStarted();
          await restoreWriteReleased;
        }
        persistedValue = value;
      },
      async clearRefreshToken() {
        persistedValue = '';
      },
    };
    const restore = jest.fn().mockResolvedValue({
      accessToken: accessA,
      refreshToken: rotatedA,
      user: AUTH_USER,
    });
    const pendingRestore = restoreSession({ storage, refreshSession: restore });

    await restoreWriteStarted;

    const userB = { ...AUTH_USER, id: 'user-b', email: 'b@example.com' };
    const authenticate = jest.fn().mockResolvedValue({
      accessToken: accessB,
      refreshToken: rotatedB,
      user: userB,
    });
    const kindStorage = {
      getSessionKind: jest.fn<Promise<'google' | 'email' | null>, []>().mockResolvedValue(null),
      setSessionKind: jest.fn<Promise<void>, ['google' | 'email']>().mockResolvedValue(),
      clearSessionKind: jest.fn<Promise<void>, []>().mockResolvedValue(),
    };
    const pendingLogin = signInWithGoogleIdToken('credential-b', {
      authenticateWithGoogleIdToken(credential) {
        return authenticate(credential);
      },
      storage,
      sessionKindStorage: kindStorage,
    });

    resolveRestoreWrite();

    await expect(pendingRestore).rejects.toThrow('session changed');
    await expect(pendingLogin).resolves.toMatchObject({ user: userB });
    expect(persistedValue).toBe(rotatedB);
    expect(captureAuthorizedSession('user-b')).toMatchObject({
      accessToken: accessB,
      ownerUserId: 'user-b',
    });
  });

  it('keeps an allowed sign-in durable when a later queued sign-in fails', async () => {
    const accessA = 'a';
    const rotatedA = 'ra';
    let persistedValue = '';
    let resolveAuthentication: (response: {
      accessToken: string;
      refreshToken: string;
      user: typeof AUTH_USER;
    }) => void = () => undefined;
    let markAuthenticationStarted: () => void = () => undefined;
    const authenticationStarted = new Promise<void>((resolve) => {
      markAuthenticationStarted = resolve;
    });
    const authenticate = jest.fn(
      () =>
        new Promise<{
          accessToken: string;
          refreshToken: string;
          user: typeof AUTH_USER;
        }>((resolve) => {
          markAuthenticationStarted();
          resolveAuthentication = resolve;
        })
    );
    const storage = {
      async getRefreshToken() {
        return persistedValue || null;
      },
      async setRefreshToken(value: string) {
        persistedValue = value;
      },
      async clearRefreshToken() {
        persistedValue = '';
      },
    };
    let sessionKind: 'google' | 'email' | null = null;
    const sessionKindStorage = {
      async getSessionKind() {
        return sessionKind;
      },
      async setSessionKind(value: 'google' | 'email') {
        sessionKind = value;
      },
      async clearSessionKind() {
        sessionKind = null;
      },
    };
    const pendingLoginA = signInWithGoogleIdToken('credential-a', {
      authenticateWithGoogleIdToken() {
        return authenticate();
      },
      storage,
      sessionKindStorage,
    });
    await authenticationStarted;

    const rejectedLogin = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ code: 'INVALID_CREDENTIALS' }, 401));
    const pendingLoginB = signInWithEmailPassword('b@example.com', 'wrong-password', {
      login: rejectedLogin,
      storage,
      sessionKindStorage,
    });
    resolveAuthentication({
      accessToken: accessA,
      refreshToken: rotatedA,
      user: AUTH_USER,
    });

    await expect(pendingLoginA).resolves.toMatchObject({ user: AUTH_USER });
    await expect(pendingLoginB).resolves.toEqual({ ok: false, code: 'INVALID_CREDENTIALS' });
    expect(persistedValue).toBe(rotatedA);
    expect(sessionKind).toBe('google');
    expect(captureAuthorizedSession(AUTH_USER.id)).toMatchObject({
      accessToken: accessA,
      ownerUserId: AUTH_USER.id,
    });
  });

  it('lets a later queued sign-out win over earlier queued sign-ins', async () => {
    const accessA = 'a';
    const accessB = 'b';
    const rotatedA = 'r';
    const userB = { ...AUTH_USER, id: 'user-b', email: 'b@example.com' };
    let persistedValue = '';
    let sessionKind: 'google' | 'email' | null = null;
    let releaseGoogleAuthentication: (response: {
      accessToken: string;
      refreshToken: string;
      user: typeof AUTH_USER;
    }) => void = () => undefined;
    let markGoogleAuthenticationStarted: () => void = () => undefined;
    const googleAuthenticationStarted = new Promise<void>((resolve) => {
      markGoogleAuthenticationStarted = resolve;
    });
    let releaseSignOutRevocation = (): void => undefined;
    let markSignOutRevocationStarted = (): void => undefined;
    const signOutRevocationStarted = new Promise<void>((resolve) => {
      markSignOutRevocationStarted = resolve;
    });
    const signOutRevocationReleased = new Promise<void>((resolve) => {
      releaseSignOutRevocation = resolve;
    });
    const storage = {
      async getRefreshToken() {
        return persistedValue || null;
      },
      async setRefreshToken(value: string) {
        persistedValue = value;
      },
      async clearRefreshToken() {
        persistedValue = '';
      },
    };
    const sessionKindStorage = {
      async getSessionKind() {
        return sessionKind;
      },
      async setSessionKind(value: 'google' | 'email') {
        sessionKind = value;
      },
      async clearSessionKind() {
        sessionKind = null;
      },
    };
    const pendingGoogleLogin = signInWithGoogleIdToken('credential-a', {
      authenticateWithGoogleIdToken() {
        return new Promise((resolve) => {
          markGoogleAuthenticationStarted();
          releaseGoogleAuthentication = resolve;
        });
      },
      revokeRemoteSession: jest.fn(async () => undefined),
      storage,
      sessionKindStorage,
    });
    await googleAuthenticationStarted;

    const pendingEmailLogin = signInWithEmailPassword('b@example.com', 'password', {
      login: jest.fn(async () => jsonResponse({ user: userB, accessToken: accessB })),
      storage,
      sessionKindStorage,
    });
    const pendingSignOut = signOutSession({
      storage,
      sessionKindStorage,
      revokeRemoteSession: jest.fn(async () => undefined),
      revokeCookieSession: jest.fn(async () => {
        markSignOutRevocationStarted();
        await signOutRevocationReleased;
      }),
    });
    expect(getAccessToken()).toBeNull();
    const googleExpectation = expect(pendingGoogleLogin).rejects.toThrow('session changed');
    const emailExpectation = expect(pendingEmailLogin).rejects.toThrow('session changed');

    releaseGoogleAuthentication({
      accessToken: accessA,
      refreshToken: rotatedA,
      user: AUTH_USER,
    });

    await signOutRevocationStarted;
    expect(getAccessToken()).toBeNull();
    expect(() => captureAuthorizedSession('user-b')).toThrow('session changed');
    releaseSignOutRevocation();
    await expect(pendingSignOut).resolves.toBeUndefined();
    await googleExpectation;
    await emailExpectation;
    expect(getAccessToken()).toBeNull();
    expect(persistedValue).toBe('');
    expect(sessionKind).toBeNull();
  });

  it('does not let a hung Google authentication block sign-out or a later sign-in', async () => {
    let markGoogleAuthenticationStarted = (): void => undefined;
    const googleAuthenticationStarted = new Promise<void>((resolve) => {
      markGoogleAuthenticationStarted = resolve;
    });
    const storage = {
      getRefreshToken: jest.fn(async () => null),
      setRefreshToken: jest.fn(async () => undefined),
      clearRefreshToken: jest.fn(async () => undefined),
    };
    const sessionKindStorage = {
      getSessionKind: jest.fn<Promise<'google' | 'email' | null>, []>().mockResolvedValue(null),
      setSessionKind: jest.fn<Promise<void>, ['google' | 'email']>().mockResolvedValue(),
      clearSessionKind: jest.fn(async () => undefined),
    };
    const pendingGoogleLogin = signInWithGoogleIdToken('credential-a', {
      authenticateWithGoogleIdToken() {
        markGoogleAuthenticationStarted();
        return new Promise<never>(() => undefined);
      },
      storage,
      sessionKindStorage,
    });
    void pendingGoogleLogin;
    await googleAuthenticationStarted;

    await expect(
      signOutSession({
        storage,
        sessionKindStorage,
        revokeCookieSession: jest.fn(async () => undefined),
      })
    ).resolves.toBeUndefined();

    const userB = { ...AUTH_USER, id: 'user-b', email: 'b@example.com' };
    await expect(
      signInWithEmailPassword('b@example.com', 'password', {
        login: jest.fn(async () => jsonResponse({ user: userB, accessToken: 'b' })),
        storage,
        sessionKindStorage,
      })
    ).resolves.toMatchObject({ ok: true, session: { user: userB } });
    expect(captureAuthorizedSession(userB.id)).toMatchObject({ ownerUserId: userB.id });
  });

  it('reads a refreshed token from a still-current same-owner session', async () => {
    const accessA = 'access-a';
    const accessB = 'access-b';
    const refreshB = 'fixture-b';
    const login = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ user: AUTH_USER, accessToken: accessA }));
    await signInWithEmailPassword('a@example.com', 'password', { login });
    const captured = captureAuthorizedSession(AUTH_USER.id);
    const storage = {
      async getRefreshToken() {
        return 'fixture-a';
      },
      async setRefreshToken() {},
      async clearRefreshToken() {},
    };
    const refreshSession = jest.fn().mockResolvedValue({
      accessToken: accessB,
      refreshToken: refreshB,
      user: AUTH_USER,
    });

    await expect(restoreSession({ storage, refreshSession })).resolves.toMatchObject({
      user: AUTH_USER,
    });

    expect(getAuthorizedSessionAccessToken(captured)).toBe(accessB);
  });

  it('returns the original 401 when session restore fails before any retry', async () => {
    const access = 'a';
    const login = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ user: AUTH_USER, accessToken: access }));
    await signInWithEmailPassword('a@example.com', 'password', { login });
    const captured = captureAuthorizedSession(AUTH_USER.id);
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('expired', { status: 401 }));
    const restoreAuthorizedSession = jest
      .fn<Promise<SessionState | null>, []>()
      .mockRejectedValue(new Error('refresh unavailable'));

    const response = await fetchWithAuthorizedSession(captured, '/programs', undefined, {
      restoreAuthorizedSession,
    });

    expect(response.status).toBe(401);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects a refresh failure that races with an authenticated owner switch', async () => {
    const loginA = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ user: AUTH_USER, accessToken: 'a' }));
    await signInWithEmailPassword('a@example.com', 'password', { login: loginA });
    const sessionA = captureAuthorizedSession(AUTH_USER.id);
    const userB = { ...AUTH_USER, id: 'user-b', email: 'b@example.com' };
    const loginB = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ user: userB, accessToken: 'b' }));
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('expired', { status: 401 }));
    const restoreAuthorizedSession = jest.fn(async () => {
      await signInWithEmailPassword('b@example.com', 'password', { login: loginB });
      throw new Error('old refresh failed');
    });

    await expect(
      fetchWithAuthorizedSession(sessionA, '/programs', undefined, {
        restoreAuthorizedSession,
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('session changed'),
      requestDispatched: true,
    });
  });

  it('rejects a delayed response after the authenticated owner switches', async () => {
    const loginA = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ user: AUTH_USER, accessToken: 'token-a' }));
    await signInWithEmailPassword('a@example.com', 'password', { login: loginA });
    const sessionA = captureAuthorizedSession(AUTH_USER.id);

    let resolveFetch: (response: Response) => void = () => undefined;
    globalThis.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    const pending = fetchWithAuthorizedSession(sessionA, '/programs');
    await Promise.resolve();

    const userB = { ...AUTH_USER, id: 'user-b', email: 'b@example.com' };
    const loginB = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ user: userB, accessToken: 'token-b' }));
    await signInWithEmailPassword('b@example.com', 'password', { login: loginB });
    resolveFetch(jsonResponse({ data: [], nextCursor: null }));

    await expect(pending).rejects.toMatchObject({
      message: expect.stringContaining('session changed'),
      requestDispatched: true,
    });
    const request = jest.mocked(globalThis.fetch).mock.calls[0]?.[1];
    expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer token-a');
  });

  it('marks an obsolete authorized request as unsent when preflight rejects it', async () => {
    const accessA = 'a';
    const login = jest
      .fn<Promise<Response>, [string, string]>()
      .mockResolvedValue(jsonResponse({ user: AUTH_USER, accessToken: accessA }));
    await signInWithEmailPassword('a@example.com', 'password', { login });
    const captured = captureAuthorizedSession(AUTH_USER.id);
    setAccessToken(null);
    globalThis.fetch = jest.fn();

    await expect(fetchWithAuthorizedSession(captured, '/programs')).rejects.toMatchObject({
      requestDispatched: false,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
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
