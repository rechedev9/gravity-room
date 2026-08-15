import { describe, expect, it } from 'vitest';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import { buildWeightsSummary } from './weights-summary';

function makeFields(fieldCount: number): ProgramDefinition['configFields'] {
  return Array.from({ length: fieldCount }, (_, i) => ({
    key: `w${i}`,
    label: `Lift ${i + 1}`,
    type: 'weight' as const,
    min: 2.5,
    step: 2.5,
  }));
}

describe('buildWeightsSummary', () => {
  const cases: ReadonlyArray<{
    readonly name: string;
    readonly fieldCount: number;
    readonly limit?: number;
    readonly expected: string;
  }> = [
    {
      name: 'lists up to four weight fields',
      fieldCount: 3,
      expected: 'Lift 1 1 · Lift 2 2 · Lift 3 3',
    },
    {
      name: 'appends a readable overflow label instead of a bare +N',
      fieldCount: 6,
      expected: 'Lift 1 1 · Lift 2 2 · Lift 3 3 · Lift 4 4 · +2 more',
    },
    {
      name: 'supports a shorter mobile summary without losing the overflow count',
      fieldCount: 6,
      limit: 1,
      expected: 'Lift 1 1 · +5 more',
    },
  ];

  it.each(cases)('$name', ({ fieldCount, limit, expected }) => {
    const fields = makeFields(fieldCount);
    const config = Object.fromEntries(fields.map((f, i) => [f.key, i + 1]));

    expect(buildWeightsSummary(config, fields, (n) => `+${n} more`, undefined, limit)).toBe(
      expected
    );
  });

  it('applies the localized label when one is provided', () => {
    const fields = makeFields(2);
    const summary = buildWeightsSummary(
      { w0: 80, w1: 55 },
      fields,
      (n) => `+${n} more`,
      (key) => key.toUpperCase()
    );
    expect(summary).toBe('W0 80 · W1 55');
  });
});
