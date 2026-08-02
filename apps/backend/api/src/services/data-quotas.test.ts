import { describe, expect, it } from 'vitest';
import { USER_DATA_LIMITS } from '../lib/data-limits';
import { findExceededQuota, type UserDataUsage } from './data-quotas';

const AT_LIMIT: UserDataUsage = { ...USER_DATA_LIMITS };

describe('findExceededQuota', () => {
  it('accepts usage exactly at every limit', () => {
    expect(findExceededQuota(AT_LIMIT)).toBeUndefined();
  });

  it.each([
    'programInstances',
    'workoutResults',
    'undoEntries',
    'customExercises',
    'jsonBytes',
  ] as const)('rejects %s above its limit', (resource) => {
    const usage = { ...AT_LIMIT, [resource]: USER_DATA_LIMITS[resource] + 1 };
    expect(findExceededQuota(usage)).toBe(resource);
  });
});
