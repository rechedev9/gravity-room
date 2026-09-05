import { describe, expect, it } from 'vitest';

import {
  computeGenericProgram,
  deriveResultFromSetLogs,
  deriveResultFromSetLogsSimple,
  roundToNearest,
} from './generic-engine';
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

/** Minimal GZCLP-shaped definition covering T1/T2/T3 progression rules. */
const GZCLP_MINI: ProgramDefinition = {
  id: 'gzclp',
  name: 'GZCLP',
  description: 'Fixture for GZCLP progression rules.',
  author: 'Cody Lefever',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 4,
  totalWorkouts: 20,
  workoutsPerWeek: 3,
  exercises: {
    squat: { name: 'Squat' },
    bench: { name: 'Bench' },
    deadlift: { name: 'Deadlift' },
    ohp: { name: 'OHP' },
    latpulldown: { name: 'Lat Pulldown' },
    dbrow: { name: 'DB Row' },
  },
  configFields: [
    { key: 'squat', label: 'Squat', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'bench', label: 'Bench', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'deadlift', label: 'Deadlift', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'ohp', label: 'OHP', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'latpulldown', label: 'Lat Pulldown', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'dbrow', label: 'DB Row', type: 'weight', min: 2.5, step: 2.5 },
  ],
  weightIncrements: {
    squat: 5,
    bench: 2.5,
    deadlift: 5,
    ohp: 2.5,
    latpulldown: 2.5,
    dbrow: 2.5,
  },
  days: [
    {
      name: 'Day 1',
      slots: [
        {
          id: 'd1-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [
            { sets: 5, reps: 3, amrap: true },
            { sets: 6, reps: 2, amrap: true },
            { sets: 10, reps: 1, amrap: true },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'squat',
        },
        {
          id: 'd1-t2',
          exerciseId: 'bench',
          tier: 't2',
          stages: [
            { sets: 3, reps: 10 },
            { sets: 3, reps: 8 },
            { sets: 3, reps: 6 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
          startWeightKey: 'bench',
          startWeightMultiplier: 0.65,
        },
        {
          id: 'latpulldown-t3',
          exerciseId: 'latpulldown',
          tier: 't3',
          stages: [{ sets: 3, reps: 15, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onUndefined: { type: 'no_change' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'latpulldown',
        },
      ],
    },
    {
      name: 'Day 2',
      slots: [
        {
          id: 'd2-t1',
          exerciseId: 'ohp',
          tier: 't1',
          stages: [
            { sets: 5, reps: 3, amrap: true },
            { sets: 6, reps: 2, amrap: true },
            { sets: 10, reps: 1, amrap: true },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'ohp',
        },
        {
          id: 'd2-t2',
          exerciseId: 'deadlift',
          tier: 't2',
          stages: [
            { sets: 3, reps: 10 },
            { sets: 3, reps: 8 },
            { sets: 3, reps: 6 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
          startWeightKey: 'deadlift',
          startWeightMultiplier: 0.65,
        },
        {
          id: 'dbrow-t3',
          exerciseId: 'dbrow',
          tier: 't3',
          stages: [{ sets: 3, reps: 15, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onUndefined: { type: 'no_change' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'dbrow',
        },
      ],
    },
    {
      name: 'Day 3',
      slots: [
        {
          id: 'd3-t1',
          exerciseId: 'bench',
          tier: 't1',
          stages: [
            { sets: 5, reps: 3, amrap: true },
            { sets: 6, reps: 2, amrap: true },
            { sets: 10, reps: 1, amrap: true },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'bench',
        },
        {
          id: 'd3-t2',
          exerciseId: 'squat',
          tier: 't2',
          stages: [
            { sets: 3, reps: 10 },
            { sets: 3, reps: 8 },
            { sets: 3, reps: 6 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
          startWeightKey: 'squat',
          startWeightMultiplier: 0.65,
        },
        {
          id: 'latpulldown-t3',
          exerciseId: 'latpulldown',
          tier: 't3',
          stages: [{ sets: 3, reps: 15, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onUndefined: { type: 'no_change' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'latpulldown',
        },
      ],
    },
    {
      name: 'Day 4',
      slots: [
        {
          id: 'd4-t1',
          exerciseId: 'deadlift',
          tier: 't1',
          stages: [
            { sets: 5, reps: 3, amrap: true },
            { sets: 6, reps: 2, amrap: true },
            { sets: 10, reps: 1, amrap: true },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'deadlift',
        },
        {
          id: 'd4-t2',
          exerciseId: 'ohp',
          tier: 't2',
          stages: [
            { sets: 3, reps: 10 },
            { sets: 3, reps: 8 },
            { sets: 3, reps: 6 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
          startWeightKey: 'ohp',
          startWeightMultiplier: 0.65,
        },
        {
          id: 'dbrow-t3',
          exerciseId: 'dbrow',
          tier: 't3',
          stages: [{ sets: 3, reps: 15, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onUndefined: { type: 'no_change' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'dbrow',
        },
      ],
    },
  ],
};

const GZCLP_CONFIG = {
  squat: 60,
  bench: 40,
  deadlift: 80,
  ohp: 30,
  latpulldown: 30,
  dbrow: 15,
};

const DAY_SLOTS = {
  0: { t1: 'd1-t1', t2: 'd1-t2', t3: 'latpulldown-t3' },
  1: { t1: 'd2-t1', t2: 'd2-t2', t3: 'dbrow-t3' },
  2: { t1: 'd3-t1', t2: 'd3-t2', t3: 'latpulldown-t3' },
  3: { t1: 'd4-t1', t2: 'd4-t2', t3: 'dbrow-t3' },
} as const;

function daySuccess(
  i: number,
  overrides?: Partial<Record<'t1' | 't2' | 't3', 'success' | 'fail'>>
): GenericResults[string] {
  const slots = DAY_SLOTS[(i % 4) as keyof typeof DAY_SLOTS];
  const t1 = overrides?.t1 ?? 'success';
  const t2 = overrides?.t2 ?? 'success';
  const t3 = overrides?.t3 ?? 'success';
  return {
    [slots.t1]: { result: t1 },
    [slots.t2]: { result: t2 },
    [slots.t3]: { result: t3 },
  };
}

function slotAt(
  rows: ReturnType<typeof computeGenericProgram>,
  workoutIndex: number,
  slotId: string
) {
  const row = rows[workoutIndex];
  if (!row) throw new Error(`Missing workout ${workoutIndex}`);
  const slot = row.slots.find((s) => s.slotId === slotId);
  if (!slot) throw new Error(`Missing slot ${slotId} at workout ${workoutIndex}`);
  return slot;
}

describe('computeGenericProgram', () => {
  it.each([
    { reps: 8, nextWeight: 60 },
    { reps: 12, nextWeight: 65 },
  ])(
    'completes a double-progression session at $reps reps while deriving the next weight from logs',
    ({ reps, nextWeight }) => {
      const definition: ProgramDefinition = {
        ...BASE_DEFINITION,
        totalWorkouts: 2,
        days: [
          {
            name: 'Day A',
            slots: [
              {
                ...BASE_SLOT,
                stages: [{ sets: 3, reps: 6, repsMax: 12 }],
                onSuccess: { type: 'double_progression', repRangeBottom: 6, repRangeTop: 12 },
              },
            ],
          },
        ],
      };
      const rows = computeGenericProgram(
        definition,
        { squat: 60 },
        {
          0: { 'squat-t1': { result: 'success', setLogs: [{ reps }, { reps }, { reps }] } },
        }
      );
      expect(slotAt(rows, 0, 'squat-t1').result).toBe('success');
      expect(slotAt(rows, 1, 'squat-t1').weight).toBe(nextWeight);
    }
  );

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

  it.each([
    { amrapReps: 8 },
    { setLogs: [{ reps: 5 }, { reps: 5 }, { reps: 8 }] },
    { amrapReps: 5, setLogs: [{ reps: 5 }, { reps: 5 }, { reps: 8 }] },
  ])('updates the training max from AMRAP logs or legacy metrics: %j', (metrics) => {
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
          ...metrics,
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

  it('stops at maxRows instead of materializing every workout', () => {
    const definition: ProgramDefinition = {
      ...BASE_DEFINITION,
      totalWorkouts: 1000,
    };

    const rows = computeGenericProgram(definition, { squat: 100 }, {}, { maxRows: 10 });

    expect(rows).toHaveLength(10);
  });

  it('ignores maxRows larger than totalWorkouts', () => {
    const definition: ProgramDefinition = {
      ...BASE_DEFINITION,
      totalWorkouts: 3,
    };

    const rows = computeGenericProgram(definition, { squat: 100 }, {}, { maxRows: 100 });

    expect(rows).toHaveLength(3);
  });
});

describe('roundToNearest', () => {
  it('rounds to the nearest multiple of step', () => {
    expect(roundToNearest(101.3, 2.5)).toBe(102.5);
    expect(roundToNearest(102.6, 2.5)).toBe(102.5);
    expect(roundToNearest(67.4999999, 2.5)).toBe(67.5);
  });

  it('rounds to the nearest 0.5 when step is 0.5', () => {
    expect(roundToNearest(116.66666667, 0.5)).toBe(116.5);
    expect(roundToNearest(62.3, 0.5)).toBe(62.5);
    expect(roundToNearest(106.66666667, 0.5)).toBe(106.5);
  });

  it('falls back to nearest-half rounding for a non-positive or non-finite step', () => {
    expect(roundToNearest(11.3, 0)).toBe(11.5);
    expect(roundToNearest(11.3, -1)).toBe(11.5);
  });

  it('clamps negative results to 0', () => {
    expect(roundToNearest(-5, 2.5)).toBe(0);
  });
});

describe('deriveResultFromSetLogs', () => {
  const rule = { type: 'double_progression' as const, repRangeTop: 8, repRangeBottom: 5 };

  it('returns undefined for empty or missing logs', () => {
    expect(deriveResultFromSetLogs(undefined, rule)).toBeUndefined();
    expect(deriveResultFromSetLogs([], rule)).toBeUndefined();
  });

  it('returns success when every set meets the top of the rep range', () => {
    expect(deriveResultFromSetLogs([{ reps: 8 }, { reps: 9 }, { reps: 8 }], rule)).toBe('success');
  });

  it('returns fail when any set is below the bottom of the rep range', () => {
    expect(deriveResultFromSetLogs([{ reps: 8 }, { reps: 4 }, { reps: 8 }], rule)).toBe('fail');
  });

  it('returns undefined for the middle band (keep weight, no progression)', () => {
    expect(deriveResultFromSetLogs([{ reps: 7 }, { reps: 6 }, { reps: 5 }], rule)).toBeUndefined();
  });
});

describe('deriveResultFromSetLogsSimple', () => {
  it('returns undefined for empty or missing logs', () => {
    expect(deriveResultFromSetLogsSimple(undefined, 5)).toBeUndefined();
    expect(deriveResultFromSetLogsSimple([], 5)).toBeUndefined();
  });

  it('returns success when every set meets the target', () => {
    expect(deriveResultFromSetLogsSimple([{ reps: 5 }, { reps: 5 }, { reps: 6 }], 5)).toBe(
      'success'
    );
  });

  it('returns fail when any set is below the target', () => {
    expect(deriveResultFromSetLogsSimple([{ reps: 5 }, { reps: 4 }, { reps: 5 }], 5)).toBe('fail');
  });
});

describe('GZCLP progression rules', () => {
  it('starts T1 at config weight and T2 at 65% of config (rounded)', () => {
    const rows = computeGenericProgram(GZCLP_MINI, GZCLP_CONFIG, {});
    const t1 = slotAt(rows, 0, 'd1-t1');
    const t2 = slotAt(rows, 0, 'd1-t2');

    expect(t1.weight).toBe(60);
    expect(t1.stage).toBe(0);
    expect(t1.sets).toBe(5);
    expect(t1.reps).toBe(3);
    // 40 * 0.65 = 26 → roundToNearest(26, 2.5) = 25
    expect(t2.weight).toBe(25);
    expect(t2.stage).toBe(0);
  });

  it('adds the exercise increment on T1 success for the next occurrence of that slot', () => {
    const results: GenericResults = {
      '0': daySuccess(0),
      '1': daySuccess(1),
      '2': daySuccess(2),
      '3': daySuccess(3),
    };
    const rows = computeGenericProgram(GZCLP_MINI, GZCLP_CONFIG, results);
    // Workout 4 is Day 1 again — squat T1 should be 60 + 5
    const squat = slotAt(rows, 4, 'd1-t1');
    expect(squat.weight).toBe(65);
    expect(squat.stage).toBe(0);
  });

  it('advances T1 stage on mid-stage fail without changing weight', () => {
    const results: GenericResults = {
      '0': daySuccess(0, { t1: 'fail' }),
    };
    const rows = computeGenericProgram(GZCLP_MINI, GZCLP_CONFIG, results);
    const squat = slotAt(rows, 4, 'd1-t1');
    expect(squat.weight).toBe(60);
    expect(squat.stage).toBe(1);
    expect(squat.sets).toBe(6);
    expect(squat.reps).toBe(2);
  });

  it('deloads T1 10% and resets stage on final-stage fail', () => {
    // Fail stages 0 → 1 → 2, then final fail at stage 2
    const results: GenericResults = {
      '0': daySuccess(0, { t1: 'fail' }),
      '4': daySuccess(0, { t1: 'fail' }),
      '8': daySuccess(0, { t1: 'fail' }),
    };
    const rows = computeGenericProgram(GZCLP_MINI, GZCLP_CONFIG, results);
    // After three fails: stage advanced 0→1→2, then deload 10% of 60 = 54 → 55 (step 2.5)
    // Wait: fail at stage 0 → stage 1; fail at stage 1 → stage 2; fail at stage 2 → deload
    const afterFirst = slotAt(rows, 4, 'd1-t1');
    expect(afterFirst.stage).toBe(1);
    expect(afterFirst.weight).toBe(60);

    const afterSecond = slotAt(rows, 8, 'd1-t1');
    expect(afterSecond.stage).toBe(2);
    expect(afterSecond.weight).toBe(60);

    const afterDeload = slotAt(rows, 12, 'd1-t1');
    expect(afterDeload.stage).toBe(0);
    // 60 * 0.9 = 54 → roundToNearest(54, 2.5) = 55
    expect(afterDeload.weight).toBe(55);
  });

  it('on T2 final-stage fail adds fixed weight and resets stage', () => {
    // Bench T2 starts at 25. Fail stages 0 and 1, then final fail at stage 2.
    const results: GenericResults = {
      '0': daySuccess(0, { t2: 'fail' }),
      '4': daySuccess(0, { t2: 'fail' }),
      '8': daySuccess(0, { t2: 'fail' }),
    };
    const rows = computeGenericProgram(GZCLP_MINI, GZCLP_CONFIG, results);

    expect(slotAt(rows, 4, 'd1-t2').stage).toBe(1);
    expect(slotAt(rows, 4, 'd1-t2').weight).toBe(25);
    expect(slotAt(rows, 8, 'd1-t2').stage).toBe(2);
    expect(slotAt(rows, 8, 'd1-t2').weight).toBe(25);

    const afterReset = slotAt(rows, 12, 'd1-t2');
    expect(afterReset.stage).toBe(0);
    // 25 + 15 = 40
    expect(afterReset.weight).toBe(40);
  });

  it('keeps T3 weight unchanged when result is undefined (onUndefined: no_change)', () => {
    const results: GenericResults = {
      '0': {
        'd1-t1': { result: 'success' },
        'd1-t2': { result: 'success' },
        // T3 intentionally omitted → undefined
      },
    };
    const rows = computeGenericProgram(GZCLP_MINI, GZCLP_CONFIG, results);
    const t3Next = slotAt(rows, 4, 'latpulldown-t3');
    expect(t3Next.weight).toBe(30);
  });

  it('adds weight on T3 success', () => {
    const results: GenericResults = {
      '0': daySuccess(0),
    };
    const rows = computeGenericProgram(GZCLP_MINI, GZCLP_CONFIG, results);
    const t3Next = slotAt(rows, 4, 'latpulldown-t3');
    expect(t3Next.weight).toBe(32.5);
  });

  it('derives success/fail from setLogs when explicit result is absent', () => {
    const results: GenericResults = {
      '0': {
        'd1-t1': {
          setLogs: [{ reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 5 }],
        },
        'd1-t2': {
          setLogs: [{ reps: 10 }, { reps: 10 }, { reps: 8 }],
        },
        'latpulldown-t3': { result: 'success' },
      },
    };
    const rows = computeGenericProgram(GZCLP_MINI, GZCLP_CONFIG, results);
    expect(slotAt(rows, 0, 'd1-t1').result).toBe('success');
    expect(slotAt(rows, 0, 'd1-t2').result).toBe('fail');
    // T1 success → next Day 1 squat is +5
    expect(slotAt(rows, 4, 'd1-t1').weight).toBe(65);
    // T2 fail mid-stage → stage advances, weight stays
    expect(slotAt(rows, 4, 'd1-t2').stage).toBe(1);
    expect(slotAt(rows, 4, 'd1-t2').weight).toBe(25);
  });

  it('pulls amrapReps from the last set log when the stage is AMRAP', () => {
    const results: GenericResults = {
      '0': {
        'd1-t1': {
          result: 'success',
          setLogs: [{ reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 12 }],
        },
        'd1-t2': { result: 'success' },
        'latpulldown-t3': { result: 'success' },
      },
    };
    const rows = computeGenericProgram(GZCLP_MINI, GZCLP_CONFIG, results);
    expect(slotAt(rows, 0, 'd1-t1').amrapReps).toBe(12);
  });

  it('stacks successive T1 successes across a full 4-day cycle', () => {
    const results: GenericResults = {};
    for (let i = 0; i < 8; i++) {
      results[String(i)] = daySuccess(i);
    }
    const rows = computeGenericProgram(GZCLP_MINI, GZCLP_CONFIG, results);
    // Two full cycles of Day 1 success → squat 60 + 5 + 5
    expect(slotAt(rows, 8, 'd1-t1').weight).toBe(70);
    // Bench T1 (Day 3) also got two successes: 40 + 2.5 + 2.5
    expect(slotAt(rows, 10, 'd3-t1').weight).toBe(45);
  });
});

describe('progression rule variants', () => {
  it('applies advance_stage_add_weight on success', () => {
    const definition: ProgramDefinition = {
      ...BASE_DEFINITION,
      totalWorkouts: 2,
      days: [
        {
          name: 'Day A',
          slots: [
            {
              ...BASE_SLOT,
              stages: [
                { sets: 3, reps: 5 },
                { sets: 3, reps: 3 },
              ],
              onSuccess: { type: 'advance_stage_add_weight' },
            },
          ],
        },
      ],
    };
    const results: GenericResults = {
      '0': { 'squat-t1': { result: 'success' } },
    };
    const rows = computeGenericProgram(definition, { squat: 100 }, results);
    expect(rows[1]?.slots[0]?.weight).toBe(105);
    expect(rows[1]?.slots[0]?.stage).toBe(1);
  });

  it('resolves percent-based prescription slots without mutating state', () => {
    const definition: ProgramDefinition = {
      ...BASE_DEFINITION,
      totalWorkouts: 2,
      configFields: [
        { key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 },
        { key: 'squat_1rm', label: 'Squat 1RM', type: 'weight', min: 20, step: 2.5 },
      ],
      days: [
        {
          name: 'Day A',
          slots: [
            {
              ...BASE_SLOT,
              id: 'squat-pct',
              percentOf: 'squat_1rm',
              prescriptions: [
                { percent: 70, reps: 5, sets: 1 },
                { percent: 80, reps: 3, sets: 1 },
                { percent: 90, reps: 1, sets: 1 },
              ],
              stages: [{ sets: 1, reps: 1 }],
            },
          ],
        },
      ],
    };
    const rows = computeGenericProgram(definition, { squat: 100, squat_1rm: 200 }, {});
    const slot = rows[0]?.slots[0];
    expect(slot?.weight).toBe(180); // 90% of 200
    expect(slot?.prescriptions).toHaveLength(3);
    expect(slot?.prescriptions?.[0]?.weight).toBe(140);
    expect(slot?.prescriptions?.[1]?.weight).toBe(160);
  });
});
