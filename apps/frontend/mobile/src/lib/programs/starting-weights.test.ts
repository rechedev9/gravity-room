import { MAX_PROGRAM_CONFIG_WEIGHT, type ProgramDefinition } from '@gzclp/domain';

import {
  parseStartingWeight,
  startingChoiceFields,
  startingWeightFields,
  validateStartingWeights,
} from './starting-weights';

const DEFINITION = {
  id: 'gzclp',
  name: 'GZCLP',
  description: 'Linear progression',
  author: 'Gravity Room',
  version: 1,
  category: 'strength',
  source: 'preset',
  days: [],
  cycleLength: 1,
  totalWorkouts: 1,
  workoutsPerWeek: 3,
  exercises: { squat: { name: 'Squat' }, bench: { name: 'Bench' } },
  configFields: [
    { key: 'squat', label: 'Sentadilla', type: 'weight', min: 2.5, step: 2.5, hint: 'Top set' },
    { key: 'bench', label: 'Press Banca', type: 'weight', min: 0, step: 2.5 },
    { key: 'ohp', label: 'Press Militar', type: 'weight', min: 0, step: 0 || 1 },
    {
      key: 'unit',
      label: 'Unit',
      type: 'select',
      options: [
        { label: 'kg', value: 'kg' },
        { label: 'lb', value: 'lb' },
      ],
    },
  ],
  weightIncrements: { T1: 2.5 },
} satisfies ProgramDefinition;

describe('startingWeightFields', () => {
  it('lists only weight fields, in catalog order, with the domain default as the starting value', () => {
    expect(startingWeightFields(DEFINITION)).toEqual([
      {
        key: 'squat',
        label: 'Sentadilla',
        min: 2.5,
        step: 2.5,
        hint: 'Top set',
        defaultValue: 2.5,
      },
      { key: 'bench', label: 'Press Banca', min: 0, step: 2.5, defaultValue: 20 },
      { key: 'ohp', label: 'Press Militar', min: 0, step: 1, defaultValue: 8 },
    ]);
  });

  it('returns an empty list for a program without weight fields', () => {
    expect(startingWeightFields({ ...DEFINITION, configFields: [] })).toEqual([]);
  });
});

describe('parseStartingWeight', () => {
  it.each([
    ['60', 60],
    ['62,5', 62.5],
    [' 80 ', 80],
    ['0', 0],
  ])('parses %s', (text, expected) => {
    expect(parseStartingWeight(text)).toBe(expected);
  });

  it.each(['', '  ', 'abc', '1e309', '60kg', '-'])('returns null for %s', (text) => {
    expect(parseStartingWeight(text)).toBeNull();
  });
});

describe('validateStartingWeights', () => {
  const fields = startingWeightFields(DEFINITION);

  it('accepts values at or above each minimum and keeps decimals', () => {
    expect(validateStartingWeights(fields, { squat: '82,5', bench: '60', ohp: '0' })).toEqual({
      ok: true,
      weights: { squat: 82.5, bench: 60, ohp: 0 },
    });
  });

  it('reports one issue per invalid field and none for valid ones', () => {
    expect(
      validateStartingWeights(fields, {
        squat: '',
        bench: 'heavy',
        ohp: String(MAX_PROGRAM_CONFIG_WEIGHT + 0.5),
      })
    ).toEqual({
      ok: false,
      issues: { squat: 'required', bench: 'invalid', ohp: 'above_max' },
    });
  });

  it('flags a value below the program minimum and a missing field', () => {
    expect(validateStartingWeights(fields, { squat: '2', bench: '20' })).toEqual({
      ok: false,
      issues: { squat: 'below_min', ohp: 'required' },
    });
  });

  it('rejects negative numbers even when the minimum is zero', () => {
    expect(validateStartingWeights(fields, { squat: '20', bench: '-5', ohp: '10' })).toEqual({
      ok: false,
      issues: { bench: 'below_min' },
    });
  });
});

describe('startingChoiceFields', () => {
  it('lists select fields with their first option as the default', () => {
    expect(startingChoiceFields(DEFINITION)).toEqual([
      {
        key: 'unit',
        label: 'Unit',
        options: [
          { label: 'kg', value: 'kg' },
          { label: 'lb', value: 'lb' },
        ],
        defaultValue: 'kg',
      },
    ]);
  });
});
