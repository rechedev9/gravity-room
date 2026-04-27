import { describe, it, expect } from 'bun:test';
import { INSIGHT_TYPES, parseInsightTypesQuery } from './insight-types';

describe('parseInsightTypesQuery', () => {
  it('returns ok([]) for undefined', () => {
    const result = parseInsightTypesQuery(undefined);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });

  it('returns ok([]) for empty string', () => {
    const result = parseInsightTypesQuery('');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });

  it('accepts a single known type', () => {
    const result = parseInsightTypesQuery('frequency');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(['frequency']);
  });

  it('accepts multiple known types in input order', () => {
    const result = parseInsightTypesQuery('volume_trend,frequency');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(['volume_trend', 'frequency']);
  });

  it('trims whitespace around entries', () => {
    const result = parseInsightTypesQuery(' frequency ');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(['frequency']);
  });

  it('skips empty entries produced by consecutive commas', () => {
    const result = parseInsightTypesQuery('frequency,,volume_trend');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(['frequency', 'volume_trend']);
  });

  it('preserves duplicates — dedup is not a validation concern', () => {
    const result = parseInsightTypesQuery('frequency,frequency');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(['frequency', 'frequency']);
  });

  it('rejects a single unknown type', () => {
    const result = parseInsightTypesQuery('bogus');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.invalidValues).toEqual(['bogus']);
  });

  it('rejects a mix of valid and unknown types, reporting only the unknown', () => {
    const result = parseInsightTypesQuery('frequency,bogus');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.invalidValues).toEqual(['bogus']);
  });

  it('reports multiple invalid values in input order', () => {
    const result = parseInsightTypesQuery('bogus,also-bogus');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.invalidValues).toEqual(['bogus', 'also-bogus']);
  });

  it('INSIGHT_TYPES contains the four documented types', () => {
    expect(INSIGHT_TYPES).toEqual([
      'volume_trend',
      'frequency',
      'plateau_detection',
      'load_recommendation',
    ]);
  });
});
