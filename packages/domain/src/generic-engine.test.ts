import { describe, expect, it } from 'bun:test';

import { computeGenericProgram } from './generic-engine';
import type { GenericResults } from './schemas/instance';
import type { ProgramDefinition } from './schemas/program-definition';

const BASE_SLOT: ProgramDefinition['days'][number]['slots'][number] = {
  id: 'squat-t1',
  exerciseId: 'squat',
  tier: 't1',
  stages: [{ sets: 3, reps: 5, amrap: true }],
  onSuccess: { type: 'add_weight' },
  onMidStageFail: { type: 'no_change' },
  onFinalStageFail: { type: 'no_change' },
  startWeightKey: 'squat',
};

const BASE_DEFINITION: ProgramDefinition = {
  id: 'test-prog',
  name: 'Test Program',
  description: 'Minimal fixture for generic engine tests.',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 1,
  totalWorkouts: 1,
  workoutsPerWeek: 1,
  exercises: {
    squat: { name: 'Squat' },
  },
  configFields: [{ key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 }],
  weightIncrements: { squat: 5 },
  days: [
    {
      name: 'Day A',
      slots: [BASE_SLOT],
    },
  ],
};

describe('computeGenericProgram', () => {
  it('uses progressionSetIndex to derive the result from the selected set log', () => {
    const definition: ProgramDefinition = {
      ...BASE_DEFINITION,
      days: [
        {
          name: 'Day A',
          slots: [
            {
              ...BASE_SLOT,
              onSuccess: { type: 'double_progression', repRangeTop: 5, repRangeBottom: 3 },
              progressionSetIndex: 1,
            },
          ],
        },
      ],
    };
    const results: GenericResults = {
      0: {
        'squat-t1': {
          setLogs: [{ reps: 2 }, { reps: 5 }],
        },
      },
    };

    const rows = computeGenericProgram(definition, { squat: 100 }, results);

    expect(rows[0]?.slots[0]?.result).toBe('success');
  });

  it('updates the training max for later workouts when update_tm succeeds', () => {
    const definition: ProgramDefinition = {
      ...BASE_DEFINITION,
      totalWorkouts: 2,
      days: [
        {
          name: 'Day A',
          slots: [
            {
              ...BASE_SLOT,
              onSuccess: { type: 'update_tm', amount: 5, minAmrapReps: 8 },
              trainingMaxKey: 'squat_tm',
              tmPercent: 1,
            },
          ],
        },
      ],
    };
    const results: GenericResults = {
      0: {
        'squat-t1': {
          result: 'success',
          amrapReps: 8,
        },
      },
    };

    const rows = computeGenericProgram(definition, { squat: 100, squat_tm: 100 }, results);

    expect(rows[0]?.slots[0]?.weight).toBe(100);
    expect(rows[1]?.slots[0]?.weight).toBe(105);
  });

  it('throws a clear error when a slot references a missing exercise definition', () => {
    const definition: ProgramDefinition = {
      ...BASE_DEFINITION,
      exercises: {},
    };

    expect(() => computeGenericProgram(definition, { squat: 100 }, {})).toThrow(
      'Missing exercise definition for squat'
    );
  });
});
