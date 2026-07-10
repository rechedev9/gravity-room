process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'silent';

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ApiError } from './error-handler';

const { mockFindUserById } = vi.hoisted(() => ({
  mockFindUserById: vi.fn<
    (
      id: string
    ) => Promise<{ id: string; authVersion: number; deletedAt?: Date | null } | undefined>
  >(() => Promise.resolve({ id: 'user-123', authVersion: 0 })),
}));

vi.mock('../services/auth', () => ({
  findUserById: mockFindUserById,
}));

vi.mock('../lib/redis', () => ({
  getRedis: vi.fn(() => null),
}));

import { JWT_AUDIENCE, JWT_ISSUER, resolveUserId, verifyAccessToken } from './auth-guard';

function jwtFor(payload: Record<string, unknown>) {
  return {
    verify: vi.fn(() => Promise.resolve(payload)),
  };
}

/** Await a rejecting promise and return the ApiError it threw (narrowed, no casts). */
async function expectApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
  throw new Error('Expected the promise to reject with an ApiError');
}

describe('resolveUserId', () => {
  beforeEach(() => {
    mockFindUserById.mockClear();
    mockFindUserById.mockImplementation(() => Promise.resolve({ id: 'user-123', authVersion: 0 }));
  });

  it('returns the subject for a valid token belonging to an active user', async () => {
    const result = await resolveUserId({
      jwt: jwtFor({ sub: 'user-123', iss: JWT_ISSUER, aud: JWT_AUDIENCE, av: 0 }),
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
        jwt: jwtFor({ sub: 'user-123', iss: JWT_ISSUER, aud: JWT_AUDIENCE, av: 0 }),
        headers: { authorization: 'Bearer token' },
      });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(401);
    expect((thrown as ApiError).code).toBe('TOKEN_USER_INACTIVE');
  });

  it('rejects an access token issued before the user session version changed', async () => {
    mockFindUserById.mockImplementation(() => Promise.resolve({ id: 'user-123', authVersion: 1 }));

    let thrown: unknown;
    try {
      await resolveUserId({
        jwt: jwtFor({ sub: 'user-123', iss: JWT_ISSUER, aud: JWT_AUDIENCE, av: 0 }),
        headers: { authorization: 'Bearer old-token' },
      });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(401);
    expect((thrown as ApiError).code).toBe('TOKEN_REVOKED');
  });

  it('rejects legacy access tokens without a session version', async () => {
    let thrown: unknown;
    try {
      await resolveUserId({
        jwt: jwtFor({ sub: 'user-123', iss: JWT_ISSUER, aud: JWT_AUDIENCE }),
        headers: { authorization: 'Bearer legacy-token' },
      });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).code).toBe('TOKEN_REVOKED');
  });
});

describe('verifyAccessToken — shared trust pipeline', () => {
  const validPayload = { sub: 'user-123', iss: JWT_ISSUER, aud: JWT_AUDIENCE, av: 0 };

  /**
   * A verify() spy that resolves to `payload`. The impl ignores its arguments, but
   * vitest still records every argument it is called with, so `toHaveBeenCalledWith`
   * can assert the pinned `{ algorithms: ['HS256'] }` option was forwarded.
   */
  function verifierReturning(payload: Record<string, unknown> | false) {
    return vi.fn((): Promise<Record<string, unknown> | false> => Promise.resolve(payload));
  }

  beforeEach(() => {
    mockFindUserById.mockClear();
    mockFindUserById.mockImplementation(() => Promise.resolve({ id: 'user-123', authVersion: 0 }));
  });

  it('pins the accepted algorithm to HS256 on the verify call', async () => {
    // Regression for the alg-confusion hardening: without the explicit allow-list an
    // `alg: none` or asymmetric (e.g. RS256) token would rely solely on the symmetric
    // key as an implicit guard. verifyAccessToken must forward `{ algorithms: ['HS256'] }`
    // so jose rejects any other algorithm outright.
    const verify = verifierReturning(validPayload);

    const result = await verifyAccessToken({ verify }, 'token');

    expect(result).toEqual({ userId: 'user-123' });
    expect(verify).toHaveBeenCalledWith('token', { algorithms: ['HS256'] });
  });

  it('rejects a token the verifier refuses (a disallowed alg such as none/RS256 verifies to false)', async () => {
    // jose returns `false` from the plugin verifier when the token header alg is not in
    // the pinned allow-list; the guard must translate that into a 401.
    const err = await expectApiError(
      verifyAccessToken({ verify: verifierReturning(false) }, 'token')
    );

    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('TOKEN_INVALID');
  });

  it('rejects a token issued for a different issuer', async () => {
    const verify = verifierReturning({ ...validPayload, iss: 'someone-else' });

    const err = await expectApiError(verifyAccessToken({ verify }, 'token'));

    expect(err.code).toBe('TOKEN_INVALID');
  });

  it('rejects a token issued for a different audience', async () => {
    const verify = verifierReturning({ ...validPayload, aud: 'someone-else' });

    const err = await expectApiError(verifyAccessToken({ verify }, 'token'));

    expect(err.code).toBe('TOKEN_INVALID');
  });

  it('rejects a token whose subject belongs to a soft-deleted user', async () => {
    // Defense-in-depth: findUserById already filters soft-deleted rows, but the shared
    // pipeline also rejects a row carrying deletedAt so the check can never be skipped.
    mockFindUserById.mockImplementation(() =>
      Promise.resolve({ id: 'user-123', authVersion: 0, deletedAt: new Date() })
    );

    const err = await expectApiError(
      verifyAccessToken({ verify: verifierReturning(validPayload) }, 'token')
    );

    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('TOKEN_USER_INACTIVE');
  });

  it('rejects a token whose session version no longer matches the user', async () => {
    mockFindUserById.mockImplementation(() => Promise.resolve({ id: 'user-123', authVersion: 5 }));

    const err = await expectApiError(
      verifyAccessToken({ verify: verifierReturning(validPayload) }, 'token')
    );

    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('TOKEN_REVOKED');
  });
});
