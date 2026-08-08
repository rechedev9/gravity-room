import { describe, expect, it } from 'vitest';
import { computeGenericProgram } from '@gzclp/domain/generic-engine';
import { extractGenericChartData } from '@gzclp/domain/generic-stats';
import { DEFAULT_WEIGHTS, GZCLP_DEFINITION_FIXTURE } from '../../../test/helpers/fixtures';

describe('profile progression chart data', () => {
  it('keeps T1 progression separate from the lighter T2 appearances', () => {
    const rows = computeGenericProgram(GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS, {});

    const combined = extractGenericChartData(GZCLP_DEFINITION_FIXTURE, rows);
    const primary = extractGenericChartData(GZCLP_DEFINITION_FIXTURE, rows, undefined, 't1');

    expect(combined.squat.slice(0, 4).map((point) => point.workout)).toEqual([1, 3, 5, 7]);
    expect(primary.squat.slice(0, 4).map((point) => point.workout)).toEqual([1, 5, 9, 13]);
    expect(primary.squat.every((point) => (point.workout - 1) % 4 === 0)).toBe(true);
  });
});
