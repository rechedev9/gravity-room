import { describe, expect, it } from 'vitest';

import { previewSlotOutcome } from './progression-preview';
import type { GenericResults } from './schemas/instance';
import type { ProgramDefinition } from './schemas/program-definition';
import type { ResultValue } from './types';

/** Two-day GZCLP-shaped fixture: a T1 stage ladder plus a T2 that adds weight. */
const DEFINITION: ProgramDefinition = {
  id: 'preview-fixture',
  name: 'Preview Fixture',
  description: 'Minimal fixture for progression previews.',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 2,
  totalWorkouts: 8,
  workoutsPerWeek: 2,
  exercises: {
    squat: { name: 'Squat' },
    bench: { name: 'Bench' },
  },
  configFields: [
    { key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 },
    { key: 'bench', label: 'Bench', type: 'weight', min: 20, step: 2.5 },
  ],
  weightIncrements: { squat: 5, bench: 2.5 },
  days: [
    {
      name: 'Day A',
      slots: [
        {
          id: 'a-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [
            { sets: 5, reps: 3, amrap: true },
            { sets: 6, reps: 2, amrap: true },
            { sets: 10, reps: 1, amrap: true },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 15 },
          startWeightKey: 'squat',
        },
      ],
    },
    {
      name: 'Day B',
      slots: [
        {
          id: 'b-t2',
          exerciseId: 'bench',
          tier: 't2',
          stages: [{ sets: 3, reps: 10 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'bench',
        },
      ],
    },
  ],
};

const CONFIG = { squat: 100, bench: 60 };

describe('previewSlotOutcome', () => {
  const cases: ReadonlyArray<{
    readonly name: string;
    readonly workoutIndex: number;
    readonly slotId: string;
    readonly value: ResultValue;
    readonly results?: GenericResults;
    readonly expected: {
      readonly workoutIndex: number;
      readonly weight: number;
      readonly stage: number;
      readonly sets: number;
      readonly reps: number;
      readonly weightDelta: number;
      readonly stageChanged: boolean;
    };
  }> = [
    {
      name: 'T1 success adds weight and keeps the stage',
      workoutIndex: 0,
      slotId: 'a-t1',
      value: 'success',
      expected: {
        workoutIndex: 2,
        weight: 105,
        stage: 0,
        sets: 5,
        reps: 3,
        weightDelta: 5,
        stageChanged: false,
      },
    },
    {
      name: 'T1 mid-stage failure advances the ladder without losing load',
      workoutIndex: 0,
      slotId: 'a-t1',
      value: 'fail',
      expected: {
        workoutIndex: 2,
        weight: 100,
        stage: 1,
        sets: 6,
        reps: 2,
        weightDelta: 0,
        stageChanged: true,
      },
    },
    {
      name: 'final-stage failure deloads and resets to stage 1',
      workoutIndex: 4,
      slotId: 'a-t1',
      value: 'fail',
      results: {
        '0': { 'a-t1': { result: 'fail' } },
        '2': { 'a-t1': { result: 'fail' } },
      },
      expected: {
        workoutIndex: 6,
        weight: 85,
        stage: 0,
        sets: 5,
        reps: 3,
        weightDelta: -15,
        stageChanged: true,
      },
    },
    {
      name: 'T2 success adds its own increment',
      workoutIndex: 1,
      slotId: 'b-t2',
      value: 'success',
      expected: {
        workoutIndex: 3,
        weight: 62.5,
        stage: 0,
        sets: 3,
        reps: 10,
        weightDelta: 2.5,
        stageChanged: false,
      },
    },
    {
      name: 'T2 failure holds everything in place',
      workoutIndex: 1,
      slotId: 'b-t2',
      value: 'fail',
      expected: {
        workoutIndex: 3,
        weight: 60,
        stage: 0,
        sets: 3,
        reps: 10,
        weightDelta: 0,
        stageChanged: false,
      },
    },
  ];

  it.each(cases)('$name', ({ workoutIndex, slotId, value, results, expected }) => {
    const preview = previewSlotOutcome(
      DEFINITION,
      CONFIG,
      results ?? {},
      workoutIndex,
      slotId,
      value
    );

    expect(preview).not.toBeNull();
    expect(preview?.next.workoutIndex).toBe(expected.workoutIndex);
    expect(preview?.next.weight).toBe(expected.weight);
    expect(preview?.next.stage).toBe(expected.stage);
    expect(preview?.next.sets).toBe(expected.sets);
    expect(preview?.next.reps).toBe(expected.reps);
    expect(preview?.weightDelta).toBe(expected.weightDelta);
    expect(preview?.stageChanged).toBe(expected.stageChanged);
  });

  it('reports the current occurrence alongside the next one', () => {
    const preview = previewSlotOutcome(DEFINITION, CONFIG, {}, 0, 'a-t1', 'success');
    expect(preview?.current).toEqual({
      workoutIndex: 0,
      weight: 100,
      stage: 0,
      stagesCount: 3,
      sets: 5,
      reps: 3,
      isAmrap: true,
    });
  });

  it('ignores set logs already recorded for the previewed slot', () => {
    // Logged sets would otherwise derive a success and mask the hypothetical fail.
    const results: GenericResults = {
      '0': {
        'a-t1': { setLogs: [{ reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 8 }] },
      },
    };
    const preview = previewSlotOutcome(DEFINITION, CONFIG, results, 0, 'a-t1', 'fail');
    expect(preview?.next.stage).toBe(1);
    expect(preview?.next.weight).toBe(100);
  });

  it('returns null when the slot never comes up again', () => {
    const preview = previewSlotOutcome(DEFINITION, CONFIG, {}, 6, 'a-t1', 'success');
    expect(preview).toBeNull();
  });

  it('returns null for an unknown slot id', () => {
    expect(previewSlotOutcome(DEFINITION, CONFIG, {}, 0, 'nope', 'success')).toBeNull();
  });

  it('returns null for a negative workout index', () => {
    expect(previewSlotOutcome(DEFINITION, CONFIG, {}, -1, 'a-t1', 'success')).toBeNull();
  });
});
