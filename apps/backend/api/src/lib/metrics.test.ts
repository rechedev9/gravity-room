/**
 * metrics.ts unit tests — verify dbQueriesTotal is always registered.
 *
 * After the scalability-p1p2 change, dbQueriesTotal is unconditionally
 * registered as a Counter regardless of NODE_ENV. These tests verify that.
 */
process.env['LOG_LEVEL'] = 'silent';

import { Counter } from 'prom-client';
import { describe, it, expect } from 'bun:test';
import { dbQueriesTotal } from './metrics';

// ---------------------------------------------------------------------------
// Tests: dbQueriesTotal unconditional registration (REQ-DBMETRICS-001)
// ---------------------------------------------------------------------------

describe('dbQueriesTotal — unconditional registration', () => {
  it('is always a Counter instance regardless of NODE_ENV', () => {
    // Assert: dbQueriesTotal is always defined and is a Counter
    expect(dbQueriesTotal).toBeDefined();
    expect(dbQueriesTotal).toBeInstanceOf(Counter);
  });

  it('can be incremented with query_type label without throwing', () => {
    // Act / Assert: no error thrown
    let error: unknown;
    try {
      dbQueriesTotal.inc({ query_type: 'select' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
  });
});
