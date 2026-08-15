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
    readonly expectedSummary: string;
    readonly expectedFull: string;
  }> = [
    {
      name: 'lists up to four weight fields',
      fieldCount: 3,
      expectedSummary: 'L1 1 · L2 2 · L3 3',
      expectedFull: 'Lift 1 1 · Lift 2 2 · Lift 3 3',
    },
    {
      name: 'appends a readable overflow label instead of a bare +N',
      fieldCount: 6,
      expectedSummary: 'L1 1 · L2 2 · L3 3 · L4 4 · +2 more',
      // `full` is never truncated — it lists every field regardless of `limit`.
      expectedFull: 'Lift 1 1 · Lift 2 2 · Lift 3 3 · Lift 4 4 · Lift 5 5 · Lift 6 6',
    },
    {
      name: 'supports a shorter mobile summary without losing the overflow count',
      fieldCount: 6,
      limit: 1,
      expectedSummary: 'L1 1 · +5 more',
      expectedFull: 'Lift 1 1 · Lift 2 2 · Lift 3 3 · Lift 4 4 · Lift 5 5 · Lift 6 6',
    },
  ];

  it.each(cases)('$name', ({ fieldCount, limit, expectedSummary, expectedFull }) => {
    const fields = makeFields(fieldCount);
    const config = Object.fromEntries(fields.map((f, i) => [f.key, i + 1]));

    const result = buildWeightsSummary(config, fields, (n) => `+${n} more`, undefined, limit);
    expect(result.summary).toBe(expectedSummary);
    expect(result.full).toBe(expectedFull);
  });

  it('applies the localized label when one is provided', () => {
    const fields = makeFields(2);
    const result = buildWeightsSummary(
      { w0: 80, w1: 55 },
      fields,
      (n) => `+${n} more`,
      (key) => key.toUpperCase()
    );
    // "W0"/"W1" are already single "words" (no space), so the code is a prefix.
    expect(result.summary).toBe('W0 80 · W1 55');
    expect(result.full).toBe('W0 80 · W1 55');
  });

  it('keeps `full` untruncated even when `summary` is limited to a single field', () => {
    const fields = makeFields(5);
    const config = Object.fromEntries(fields.map((f, i) => [f.key, i + 1]));

    const result = buildWeightsSummary(config, fields, (n) => `+${n} more`, undefined, 1);
    expect(result.summary).toBe('L1 1 · +4 more');
    expect(result.full).toBe('Lift 1 1 · Lift 2 2 · Lift 3 3 · Lift 4 4 · Lift 5 5');
  });

  it('keeps the mobile (limit = 1) code identical to the desktop code for the same field', () => {
    const fields = [
      { key: 'squat', label: 'Sentadilla', type: 'weight' as const, min: 20, step: 2.5 },
      { key: 'bench', label: 'Press Banca', type: 'weight' as const, min: 20, step: 2.5 },
    ];
    const config = { squat: 115, bench: 102.5 };

    const desktop = buildWeightsSummary(config, fields, (n) => `+${n} more`);
    const mobile = buildWeightsSummary(config, fields, (n) => `+${n} more`, undefined, 1);

    const squatCodeDesktop = desktop.summary.split(' · ')[0];
    const squatCodeMobile = mobile.summary.split(' · ')[0];
    expect(squatCodeDesktop).toBe(squatCodeMobile);
  });

  describe('abbreviation shape', () => {
    const abbreviationCases: ReadonlyArray<{
      readonly name: string;
      readonly labels: readonly string[];
      readonly expectedCodes: readonly string[];
    }> = [
      {
        name: 'strips a parenthetical qualifier before abbreviating',
        labels: ['Sentadilla (peso inicial semana 5)'],
        expectedCodes: ['SEN'],
      },
      {
        name: 'shortens a single word to its first 3 letters',
        labels: ['Remo'],
        expectedCodes: ['REM'],
      },
      {
        name: 'uses initials for a multi-word label',
        labels: ['Press Banca'],
        expectedCodes: ['PB'],
      },
      {
        name: 'resolves colliding initials deterministically by extending one code',
        labels: ['Press Banca', 'Peso Muerto', 'Press Militar'],
        // "Press Banca" -> PB (first, no collision yet).
        // "Peso Muerto" -> PM (first, no collision yet).
        // "Press Militar" -> PM collides, extends via its last word -> PMI.
        expectedCodes: ['PB', 'PM', 'PMI'],
      },
    ];

    it.each(abbreviationCases)('$name', ({ labels, expectedCodes }) => {
      const fields = labels.map((label, i) => ({
        key: `f${i}`,
        label,
        type: 'weight' as const,
        min: 20,
        step: 2.5,
      }));
      const config = Object.fromEntries(fields.map((f, i) => [f.key, 10 + i]));

      const { summary } = buildWeightsSummary(
        config,
        fields,
        (n) => `+${n} more`,
        undefined,
        fields.length
      );
      const codes = summary.split(' · ').map((part) => part.split(' ')[0]);
      expect(codes).toEqual(expectedCodes);
    });

    it('never produces duplicate codes within one summary', () => {
      const labels = ['Press Militar', 'Peso Muerto', 'Press Media', 'Peso Muerto'];
      const fields = labels.map((label, i) => ({
        key: `f${i}`,
        label,
        type: 'weight' as const,
        min: 20,
        step: 2.5,
      }));
      const config = Object.fromEntries(fields.map((f, i) => [f.key, 10 + i]));

      const { summary } = buildWeightsSummary(
        config,
        fields,
        (n) => `+${n} more`,
        undefined,
        fields.length
      );
      const codes = summary.split(' · ').map((part) => part.split(' ')[0]);
      expect(new Set(codes).size).toBe(codes.length);
    });
  });
});
