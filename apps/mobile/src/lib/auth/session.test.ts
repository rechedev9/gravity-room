import {
  getAccessToken,
  InvalidRefreshTokenError,
  restoreSession,
  setAccessToken,
} from './session';

afterEach(() => {
  setAccessToken(null);
});

describe('restoreSession', () => {
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
});
