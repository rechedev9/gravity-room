/**
 * Insights service unit tests — verifies getInsights with mocked DB.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

const NOW = new Date('2026-04-13T12:00:00.000Z');
const VALID_UNTIL = new Date('2026-04-14T12:00:00.000Z');

const INSIGHT_ROWS = [
  {
    insightType: 'frequency',
    exerciseId: null,
    payload: { weekly: 3 },
    computedAt: NOW,
    validUntil: VALID_UNTIL,
  },
  {
    insightType: 'volume_trend',
    exerciseId: 'squat',
    payload: { trend: 'up', pct: 12 },
    computedAt: NOW,
    validUntil: null,
  },
];

let selectResult: unknown[] = [];

const mockOrderBy = vi.fn(() => selectResult);
const mockWhere = vi.fn<(condition: unknown) => { orderBy: typeof mockOrderBy }>(() => ({
  orderBy: mockOrderBy,
}));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

// vitest isolates the module registry per test file, so this `../db` mock is
// scoped to this file automatically — no manual capture/restore is needed.
vi.mock('../db', () => ({
  getDb: () => ({ select: mockSelect }),
}));

const { getInsights } = await import('./insights');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getInsights', () => {
  beforeEach(() => {
    selectResult = INSIGHT_ROWS;
    mockSelect.mockClear();
    mockFrom.mockClear();
    mockWhere.mockClear();
    mockOrderBy.mockClear();
  });

  it('returns all insights when no types filter', async () => {
    const result = await getInsights('user-1', []);
    expect(result).toHaveLength(2);
    expect(result[0]!.insightType).toBe('frequency');
    expect(result[1]!.insightType).toBe('volume_trend');
  });

  it('returns insights filtered by types', async () => {
    selectResult = [INSIGHT_ROWS[0]];
    const result = await getInsights('user-1', ['frequency']);
    expect(result).toHaveLength(1);
    expect(result[0]!.insightType).toBe('frequency');
  });

  it('returns empty array when no insights exist', async () => {
    selectResult = [];
    const result = await getInsights('user-1', []);
    expect(result).toHaveLength(0);
  });

  it('excludes explicitly expired rows at the database boundary', async () => {
    await getInsights('user-1', []);

    const condition: unknown = mockWhere.mock.calls[0]?.[0];
    if (
      condition === null ||
      typeof condition !== 'object' ||
      !('getSQL' in condition) ||
      typeof condition.getSQL !== 'function'
    ) {
      throw new Error('expected a Drizzle SQL condition');
    }
    const query = new PgDialect().sqlToQuery(condition.getSQL());
    expect(query.sql).toContain('"user_insights"."valid_until" is null');
    expect(query.sql).toContain('"user_insights"."valid_until" >');
  });
});
