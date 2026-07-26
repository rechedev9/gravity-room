process.env['LOG_LEVEL'] = 'silent';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { users } from '@gzclp/database/schema';

let activeDb: unknown;

vi.mock('../db', () => ({
  getDb: () => activeDb,
}));

const { fetchAllUsers, fetchLeastRecentlyComputedUsers } = await import('./queries');

function sqlText(condition: unknown): string {
  if (
    condition === null ||
    typeof condition !== 'object' ||
    !('getSQL' in condition) ||
    typeof condition.getSQL !== 'function'
  ) {
    throw new Error('expected a Drizzle SQL condition');
  }
  return new PgDialect().sqlToQuery(condition.getSQL()).sql;
}

describe('analytics user selection', () => {
  beforeEach(() => {
    activeDb = undefined;
  });

  it('excludes soft-deleted users from unbounded analytics runs', async () => {
    const rows = [{ userId: 'qa4-active-user' }];
    const orderBy = vi.fn(() => rows);
    const where = vi.fn<(condition: unknown) => { orderBy: typeof orderBy }>(() => ({ orderBy }));
    const innerJoin = vi.fn<(table: unknown, condition: unknown) => { where: typeof where }>(
      () => ({ where })
    );
    const from = vi.fn(() => ({ innerJoin }));
    activeDb = { selectDistinct: vi.fn(() => ({ from })) };

    await expect(fetchAllUsers()).resolves.toEqual(rows);
    expect(innerJoin.mock.calls[0]?.[0]).toBe(users);
    expect(sqlText(where.mock.calls[0]?.[0])).toContain('"users"."deleted_at" is null');
  });

  it('excludes soft-deleted users from the fair bounded cron batch', async () => {
    const rows = [{ userId: 'qa4-active-user' }];
    const limit = vi.fn<(limit: number) => typeof rows>(() => rows);
    const orderBy = vi.fn(() => ({ limit }));
    const groupBy = vi.fn(() => ({ orderBy }));
    const where = vi.fn<(condition: unknown) => { groupBy: typeof groupBy }>(() => ({ groupBy }));
    const leftJoin = vi.fn<(table: unknown, condition: unknown) => { where: typeof where }>(() => ({
      where,
    }));
    const innerJoin = vi.fn<(table: unknown, condition: unknown) => { leftJoin: typeof leftJoin }>(
      () => ({ leftJoin })
    );
    const from = vi.fn(() => ({ innerJoin }));
    activeDb = { select: vi.fn(() => ({ from })) };

    await expect(fetchLeastRecentlyComputedUsers(4)).resolves.toEqual(rows);
    expect(innerJoin.mock.calls[0]?.[0]).toBe(users);
    expect(sqlText(where.mock.calls[0]?.[0])).toContain('"users"."deleted_at" is null');
    expect(limit).toHaveBeenCalledWith(4);
  });
});
