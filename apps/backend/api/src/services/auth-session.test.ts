/**
 * Refresh-session transaction tests.
 *
 * These use a small Drizzle-shaped transaction double so the ordering contract
 * stays deterministic without requiring external Postgres infrastructure.
 */
process.env['LOG_LEVEL'] = 'silent';

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly authVersion: number;
  readonly deletedAt: Date | null;
}

interface TestRefreshToken {
  readonly userId: string;
  readonly familyId: string;
  readonly familyOrder: number;
  readonly expiresAt: Date;
  readonly tokenHash: string;
  readonly previousTokenHash: string | null;
  readonly consumedAt: Date | null;
  readonly supersededAt: Date | null;
  readonly familyLookupExpiresAt: Date | null;
  readonly createdAt: Date;
}

let selectResults: unknown[][] = [];
let deleteReturningResults: unknown[][] = [];
let updateReturningResults: unknown[][] = [];
let operations: string[] = [];
let insertedValues: unknown[] = [];
let updatedValues: unknown[] = [];

function awaitable(value: unknown): Record<string, unknown> {
  return {
    then: (
      resolve: (resolved: unknown) => unknown,
      reject?: (error: unknown) => unknown
    ): Promise<unknown> => Promise.resolve(value).then(resolve, reject),
  };
}

function selectChain(result: unknown[]): Record<string, unknown> {
  const chain: Record<string, unknown> = { ...awaitable(result) };
  chain['where'] = vi.fn(() => chain);
  chain['orderBy'] = vi.fn(() => chain);
  chain['for'] = vi.fn((mode: string) => {
    operations.push(`lock:${mode}`);
    return chain;
  });
  chain['limit'] = vi.fn(() => Promise.resolve(result.slice(0, 1)));
  return chain;
}

function createMockTx(): Record<string, unknown> {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => {
        operations.push('select');
        return selectChain(selectResults.shift() ?? []);
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((value: unknown) => {
        operations.push('insert');
        insertedValues.push(value);
        return awaitable(undefined);
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((value: unknown) => {
        updatedValues.push(value);
        return {
          where: vi.fn(() => {
            operations.push('update');
            return {
              ...awaitable(undefined),
              returning: vi.fn(() => Promise.resolve(updateReturningResults.shift() ?? [])),
            };
          }),
        };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => {
        operations.push('delete');
        return {
          ...awaitable(undefined),
          returning: vi.fn(() => Promise.resolve(deleteReturningResults.shift() ?? [])),
        };
      }),
    })),
    execute: vi.fn(() => {
      operations.push('execute');
      return Promise.resolve(undefined);
    }),
  };
}

let mockDb: Record<string, unknown> = {};

vi.mock('../db', () => ({
  getDb: () => mockDb,
}));

const authService = await import('./auth');

const USER: TestUser = {
  id: 'user-1',
  email: 'user@example.com',
  authVersion: 4,
  deletedAt: null,
};

const STORED_ROW: TestRefreshToken = {
  userId: USER.id,
  familyId: '11111111-1111-4111-8111-111111111111',
  familyOrder: 1,
  expiresAt: new Date(Date.now() + 60_000),
  tokenHash: 'hash',
  previousTokenHash: null,
  consumedAt: null,
  supersededAt: null,
  familyLookupExpiresAt: null,
  createdAt: new Date(),
};

beforeEach(() => {
  selectResults = [];
  deleteReturningResults = [];
  updateReturningResults = [];
  operations = [];
  insertedValues = [];
  updatedValues = [];
  mockDb = {
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(createMockTx())
    ),
  };
});

describe('createAndStoreRefreshToken', () => {
  it('locks the user epoch before inserting a refresh token', async () => {
    selectResults = [[{ authVersion: USER.authVersion }]];

    await expect(
      authService.createAndStoreRefreshToken(USER.id, USER.authVersion, undefined, 2)
    ).resolves.toHaveLength(64);
    expect(operations).toEqual(['select', 'lock:update', 'insert']);
  });

  it('rejects a delayed producer after global revocation advances the user epoch', async () => {
    selectResults = [[{ authVersion: USER.authVersion + 1 }]];

    await expect(
      authService.createAndStoreRefreshToken(USER.id, USER.authVersion, undefined, 2)
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_SESSION_SUPERSEDED',
    });
    expect(operations).toEqual(['select', 'lock:update']);
  });

  it('atomically consumes the cookie session before inserting its login successor', async () => {
    selectResults = [
      [{ authVersion: USER.authVersion }],
      [{ userId: USER.id, tokenHash: 'old', familyOrder: STORED_ROW.familyOrder }],
    ];
    updateReturningResults = [[{ tokenHash: 'old' }]];

    await expect(
      authService.createAndStoreRefreshToken(
        USER.id,
        USER.authVersion,
        {
          tokenHash: 'old',
          familyId: STORED_ROW.familyId,
          userId: USER.id,
        },
        2
      )
    ).resolves.toHaveLength(64);
    expect(operations).toEqual([
      'execute',
      'select',
      'lock:update',
      'select',
      'update',
      'update',
      'insert',
    ]);
    expect(insertedValues).toEqual([
      expect.objectContaining({
        familyId: STORED_ROW.familyId,
        familyOrder: 2,
        previousTokenHash: 'old',
      }),
    ]);
    expect(updatedValues).toContainEqual(
      expect.objectContaining({ familyLookupExpiresAt: expect.any(Date) })
    );
  });

  it('lets a later login intent consume the current descendant of its captured family', async () => {
    selectResults = [
      [{ authVersion: USER.authVersion }],
      [
        {
          userId: USER.id,
          tokenHash: 'active-descendant',
          familyOrder: STORED_ROW.familyOrder,
        },
      ],
    ];
    updateReturningResults = [[{ tokenHash: 'active-descendant' }]];

    await expect(
      authService.createAndStoreRefreshToken(
        USER.id,
        USER.authVersion,
        {
          tokenHash: 'captured-before-refresh',
          familyId: STORED_ROW.familyId,
          userId: USER.id,
        },
        2
      )
    ).resolves.toHaveLength(64);
    expect(operations).toEqual([
      'execute',
      'select',
      'lock:update',
      'select',
      'update',
      'update',
      'insert',
    ]);
    expect(insertedValues).toEqual([
      expect.objectContaining({
        familyId: STORED_ROW.familyId,
        familyOrder: 2,
        previousTokenHash: 'active-descendant',
      }),
    ]);
    expect(operations).not.toContain('delete');
  });

  it('rejects an older login intent after a newer family transition has committed', async () => {
    selectResults = [
      [{ authVersion: USER.authVersion }],
      [{ userId: USER.id, tokenHash: 'newer-login-descendant', familyOrder: 3 }],
    ];

    await expect(
      authService.createAndStoreRefreshToken(
        USER.id,
        USER.authVersion,
        {
          tokenHash: 'captured-before-newer-login',
          familyId: STORED_ROW.familyId,
          userId: USER.id,
        },
        2
      )
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_SESSION_SUPERSEDED',
    });
    expect(operations).toEqual(['execute', 'select', 'lock:update', 'select']);
    expect(insertedValues).toEqual([]);
  });

  it('starts a new family instead of linking a login across account owners', async () => {
    selectResults = [
      [{ authVersion: USER.authVersion }],
      [{ userId: 'other-user', tokenHash: 'other-account-token', familyOrder: 1 }],
    ];

    await expect(
      authService.createAndStoreRefreshToken(
        USER.id,
        USER.authVersion,
        {
          tokenHash: 'captured-other-account-token',
          familyId: STORED_ROW.familyId,
          userId: 'other-user',
        },
        2
      )
    ).resolves.toHaveLength(64);

    expect(operations).toEqual(['execute', 'select', 'lock:update', 'select', 'insert']);
    expect(insertedValues).toHaveLength(1);
    expect(insertedValues[0]).toEqual(
      expect.objectContaining({
        userId: USER.id,
        familyOrder: 2,
      })
    );
    expect(insertedValues[0]).not.toEqual(
      expect.objectContaining({
        familyId: STORED_ROW.familyId,
      })
    );
    expect(insertedValues[0]).not.toEqual(
      expect.objectContaining({
        previousTokenHash: expect.anything(),
      })
    );
  });

  it('starts a cross-account family after the presented family disappears', async () => {
    selectResults = [[{ authVersion: USER.authVersion }], []];

    await expect(
      authService.createAndStoreRefreshToken(
        USER.id,
        USER.authVersion,
        {
          tokenHash: 'captured-other-account-token',
          familyId: STORED_ROW.familyId,
          userId: 'other-user',
        },
        2
      )
    ).resolves.toHaveLength(64);

    expect(operations).toEqual(['execute', 'select', 'lock:update', 'select', 'insert']);
    expect(insertedValues).toEqual([
      expect.objectContaining({
        userId: USER.id,
        familyOrder: 2,
      }),
    ]);
    expect(insertedValues[0]).not.toEqual(
      expect.objectContaining({
        familyId: STORED_ROW.familyId,
      })
    );
  });

  it('rejects a login producer when logout consumed its cookie session first', async () => {
    selectResults = [[{ authVersion: USER.authVersion }], []];

    await expect(
      authService.createAndStoreRefreshToken(
        USER.id,
        USER.authVersion,
        {
          tokenHash: 'old',
          familyId: STORED_ROW.familyId,
          userId: USER.id,
        },
        2
      )
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_SESSION_SUPERSEDED',
    });
    expect(operations).toEqual(['execute', 'select', 'lock:update', 'select']);
  });

  it('rejects a second login based on a cookie already superseded by the winner', async () => {
    selectResults = [[{ authVersion: USER.authVersion }], []];

    await expect(
      authService.createAndStoreRefreshToken(
        USER.id,
        USER.authVersion,
        {
          tokenHash: 'superseded-cookie',
          familyId: STORED_ROW.familyId,
          userId: USER.id,
        },
        2
      )
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_SESSION_SUPERSEDED',
    });
    expect(operations).toEqual(['execute', 'select', 'lock:update', 'select']);
    expect(insertedValues).toEqual([]);
  });
});

describe('revokeRefreshToken', () => {
  it('deletes only the presented session when logout wins the race', async () => {
    selectResults = [
      [
        {
          familyId: STORED_ROW.familyId,
          familyOrder: STORED_ROW.familyOrder,
          userId: USER.id,
        },
      ],
      [{ id: USER.id }],
      [{ familyOrder: STORED_ROW.familyOrder }],
    ];

    await authService.revokeRefreshToken('presented-hash');

    expect(operations).toEqual(['select', 'execute', 'select', 'lock:update', 'select', 'delete']);
  });

  it('deletes the direct successor when refresh won the race', async () => {
    selectResults = [
      [
        {
          familyId: STORED_ROW.familyId,
          familyOrder: STORED_ROW.familyOrder,
          userId: USER.id,
        },
      ],
      [{ id: USER.id }],
      [{ familyOrder: STORED_ROW.familyOrder }],
    ];

    await authService.revokeRefreshToken('presented-hash');

    expect(operations).toEqual(['select', 'execute', 'select', 'lock:update', 'select', 'delete']);
  });

  it('revokes the latest descendant when presented with a multi-rotation ancestor', async () => {
    selectResults = [
      [
        {
          familyId: STORED_ROW.familyId,
          familyOrder: STORED_ROW.familyOrder,
          userId: USER.id,
        },
      ],
      [{ id: USER.id }],
      [{ familyOrder: STORED_ROW.familyOrder }],
    ];

    await authService.revokeRefreshToken('presented-hash');

    expect(operations).toEqual(['select', 'execute', 'select', 'lock:update', 'select', 'delete']);
  });

  it('does not revoke a newer login generation that won the family lock first', async () => {
    selectResults = [
      [
        {
          familyId: STORED_ROW.familyId,
          familyOrder: STORED_ROW.familyOrder,
          userId: USER.id,
        },
      ],
      [{ id: USER.id }],
      [{ familyOrder: STORED_ROW.familyOrder + 1 }],
    ];

    await authService.revokeRefreshToken('presented-before-newer-login');

    expect(operations).toEqual(['select', 'execute', 'select', 'lock:update', 'select']);
    expect(operations).not.toContain('delete');
  });
});

describe('revokeBrowserRefreshTokens', () => {
  it('batch-revokes every family represented by the captured cookie snapshot', async () => {
    selectResults = [
      [{ familyId: STORED_ROW.familyId, userId: USER.id }],
      [{ id: USER.id }],
      [{ familyId: STORED_ROW.familyId, familyOrder: STORED_ROW.familyOrder }],
      [{ familyId: STORED_ROW.familyId, familyOrder: STORED_ROW.familyOrder }],
    ];

    await authService.revokeBrowserRefreshTokens(['presented-hash', 'rotated-ancestor-hash']);

    expect(operations).toEqual([
      'select',
      'execute',
      'select',
      'lock:update',
      'select',
      'select',
      'delete',
    ]);
  });

  it('retains a newer login generation absent from the captured cookie snapshot', async () => {
    selectResults = [
      [{ familyId: STORED_ROW.familyId, userId: USER.id }],
      [{ id: USER.id }],
      [{ familyId: STORED_ROW.familyId, familyOrder: STORED_ROW.familyOrder }],
      [{ familyId: STORED_ROW.familyId, familyOrder: STORED_ROW.familyOrder + 1 }],
    ];

    await authService.revokeBrowserRefreshTokens(['presented-before-newer-login']);

    expect(operations).toEqual(['select', 'execute', 'select', 'lock:update', 'select', 'select']);
    expect(operations).not.toContain('delete');
  });

  it('does not treat a successor linked from a delayed cookie as presented', async () => {
    // The browser still sent the predecessor. The successor is a newer login
    // generation and only refers to it through previous_token_hash, so it must
    // be absent from both candidate queries and remain active.
    selectResults = [
      [{ familyId: STORED_ROW.familyId, userId: USER.id }],
      [{ id: USER.id }],
      [{ familyId: STORED_ROW.familyId, familyOrder: STORED_ROW.familyOrder }],
      [{ familyId: STORED_ROW.familyId, familyOrder: STORED_ROW.familyOrder + 1 }],
    ];

    await authService.revokeBrowserRefreshTokens(['delayed-predecessor-hash']);

    expect(operations).toEqual(['select', 'execute', 'select', 'lock:update', 'select', 'select']);
    expect(operations).not.toContain('delete');
  });

  it('revokes the newest generation when its credential was also captured', async () => {
    selectResults = [
      [{ familyId: STORED_ROW.familyId, userId: USER.id }],
      [{ id: USER.id }],
      [
        { familyId: STORED_ROW.familyId, familyOrder: STORED_ROW.familyOrder },
        { familyId: STORED_ROW.familyId, familyOrder: STORED_ROW.familyOrder + 1 },
      ],
      [{ familyId: STORED_ROW.familyId, familyOrder: STORED_ROW.familyOrder + 1 }],
    ];

    await authService.revokeBrowserRefreshTokens(['older-hash', 'newest-hash']);

    expect(operations.at(-1)).toBe('delete');
  });
});

describe('rotateRefreshToken', () => {
  it('retains the consumed ancestor after replacing it under the user epoch lock', async () => {
    selectResults = [[STORED_ROW], [USER]];
    updateReturningResults = [[STORED_ROW]];

    await expect(authService.rotateRefreshToken(STORED_ROW.tokenHash)).resolves.toMatchObject({
      status: 'rotated',
      user: USER,
    });
    expect(operations).toEqual([
      'select',
      'execute',
      'select',
      'lock:update',
      'update',
      'insert',
      'update',
    ]);
    expect(insertedValues).toEqual([
      expect.objectContaining({
        familyId: STORED_ROW.familyId,
        familyOrder: STORED_ROW.familyOrder,
        previousTokenHash: STORED_ROW.tokenHash,
      }),
    ]);
    expect(updatedValues).toContainEqual(
      expect.objectContaining({ familyLookupExpiresAt: expect.any(Date) })
    );
  });

  it('reports a family removed by logout while rotation waited as superseded', async () => {
    selectResults = [[STORED_ROW], [USER], []];
    updateReturningResults = [[]];

    await expect(authService.rotateRefreshToken(STORED_ROW.tokenHash)).resolves.toEqual({
      status: 'superseded',
    });
    expect(operations).toEqual(['select', 'execute', 'select', 'lock:update', 'update', 'select']);
    expect(insertedValues).toEqual([]);
  });

  it('reports a delayed refresh that starts after login replacement as superseded', async () => {
    const loginSuperseded = {
      ...STORED_ROW,
      consumedAt: new Date(),
      supersededAt: new Date(),
    };
    selectResults = [[loginSuperseded], [USER], [loginSuperseded]];
    updateReturningResults = [[]];

    await expect(authService.rotateRefreshToken(STORED_ROW.tokenHash)).resolves.toEqual({
      status: 'superseded',
    });
    expect(operations).toEqual(['select', 'execute', 'select', 'lock:update', 'update', 'select']);
    expect(insertedValues).toEqual([]);
  });

  it('keeps ordinary consumed-token replay distinct from login supersession', async () => {
    const consumedByRefresh = { ...STORED_ROW, consumedAt: new Date() };
    selectResults = [[consumedByRefresh], [USER], [consumedByRefresh]];
    updateReturningResults = [[]];

    await expect(authService.rotateRefreshToken(STORED_ROW.tokenHash)).resolves.toEqual({
      status: 'not_found',
    });
    expect(operations).toEqual(['select', 'execute', 'select', 'lock:update', 'update', 'select']);
    expect(insertedValues).toEqual([]);
  });
});
