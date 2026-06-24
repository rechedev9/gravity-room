process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'silent';

import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { ApiError } from './error-handler';

const mockFindUserById = mock<(id: string) => Promise<{ id: string } | undefined>>(() =>
  Promise.resolve({ id: 'user-123' })
);

mock.module('../services/auth', () => ({
  findUserById: mockFindUserById,
}));

mock.module('../lib/redis', () => ({
  getRedis: mock(() => null),
}));

import { JWT_AUDIENCE, JWT_ISSUER, resolveUserId } from './auth-guard';

function jwtFor(payload: Record<string, unknown>) {
  return {
    verify: mock(() => Promise.resolve(payload)),
  };
}

describe('resolveUserId', () => {
  beforeEach(() => {
    mockFindUserById.mockClear();
    mockFindUserById.mockImplementation(() => Promise.resolve({ id: 'user-123' }));
  });

  it('returns the subject for a valid token belonging to an active user', async () => {
    const result = await resolveUserId({
      jwt: jwtFor({ sub: 'user-123', iss: JWT_ISSUER, aud: JWT_AUDIENCE }),
      headers: { authorization: 'Bearer token' },
    });

    expect(result).toEqual({ userId: 'user-123' });
    expect(mockFindUserById).toHaveBeenCalledWith('user-123');
  });

  it('rejects a valid token when the user no longer exists or is soft-deleted', async () => {
    mockFindUserById.mockImplementation(() => Promise.resolve(undefined));

    let thrown: unknown;
    try {
      await resolveUserId({
        jwt: jwtFor({ sub: 'user-123', iss: JWT_ISSUER, aud: JWT_AUDIENCE }),
        headers: { authorization: 'Bearer token' },
      });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(401);
    expect((thrown as ApiError).code).toBe('TOKEN_USER_INACTIVE');
  });
});
