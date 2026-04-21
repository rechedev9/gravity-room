import {
  buildApiUrl,
  fetchWithAccessToken,
  getAccessToken,
  InvalidRefreshTokenError,
  restoreSession,
  setAccessToken,
  signInWithGoogleIdToken,
  signOutSession,
} from './session';

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
});
