import { describe, expect, it } from 'bun:test';

import { isRecord } from '@gzclp/domain/type-guards';

describe('domain package', () => {
  it('exports isRecord from the type-guards entrypoint', () => {
    expect(isRecord({ ready: true })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
  });
});
