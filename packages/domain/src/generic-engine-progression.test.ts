import { describe, expect, it } from 'vitest';

import { computeGenericProgram } from './generic-engine';
import type { GenericResults } from './schemas/instance';
import type { ProgramDefinition } from './schemas/program-definition';

type SlotDef = ProgramDefinition['days'][number]['slots'][number];

const BASE_SLOT: SlotDef = {
  id: 'squat-t1',
  exerciseId: 'squat',
  tier: 't1',
  stages: [{ sets: 3, reps: 5 }],
  onSuccess: { type: 'add_weight' },
  onMidStageFail: { type: 'no_change' },
  onFinalStageFail: { type: 'no_change' },
  startWeightKey: 'squat',
};

const BASE_DEFINITION: ProgramDefinition = {
  id: 'test-prog',
  name: 'Test Program',
  description: 'Progression-branch fixture for generic engine tests.',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 1,
  totalWorkouts: 4,
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

function withSlot(slot: SlotDef, totalWorkouts = 4): ProgramDefinition {
  return {
    ...BASE_DEFINITION,
    totalWorkouts,
    days: [{ name: 'Day A', slots: [slot] }],
  };
}

describe('applySlotProgression — fail branch selection (GZCLP heart)', () => {
  // GZCLP T1-style slot: 3 stages, mid-stage fail advances the stage,
  // final-stage fail triggers a percentage deload back to stage 0.
  const gzclpSlot: SlotDef = {
    ...BASE_SLOT,
    stages: [
      { sets: 5, reps: 3 },
      { sets: 6, reps: 2 },
      { sets: 10, reps: 1 },
    ],
    onSuccess: { type: 'add_weight' },
    onMidStageFail: { type: 'advance_stage' },
    onFinalStageFail: { type: 'deload_percent', percent: 15 },
  };

  it('advances the stage on mid-stage fails and deloads on the final-stage fail', () => {
    const definition = withSlot(gzclpSlot, 4);
    const results: GenericResults = {
      0: { 'squat-t1': { result: 'fail' } }, // stage 0 -> 1
      1: { 'squat-t1': { result: 'fail' } }, // stage 1 -> 2 (final)
      2: { 'squat-t1': { result: 'fail' } }, // final stage -> deload
    };

    const rows = computeGenericProgram(definition, { squat: 100 }, results);

    expect(rows[0]?.slots[0]?.stage).toBe(0);
    expect(rows[1]?.slots[0]?.stage).toBe(1);
    expect(rows[1]?.slots[0]?.weight).toBe(100); // advance_stage keeps the weight
    expect(rows[2]?.slots[0]?.stage).toBe(2);
    // deload_percent: 100 * (1 - 15/100) = 85, stage reset to 0.
    expect(rows[3]?.slots[0]?.stage).toBe(0);
    expect(rows[3]?.slots[0]?.weight).toBe(85);
  });

  it('advancing a stage also switches the prescription to the new stage config', () => {
    const definition = withSlot(gzclpSlot, 2);
    const results: GenericResults = { 0: { 'squat-t1': { result: 'fail' } } };

    const rows = computeGenericProgram(definition, { squat: 100 }, results);

    expect(rows[0]?.slots[0]?.sets).toBe(5);
    expect(rows[0]?.slots[0]?.reps).toBe(3);
    expect(rows[1]?.slots[0]?.sets).toBe(6);
    expect(rows[1]?.slots[0]?.reps).toBe(2);
  });

  it('flags the post-deload workout as a deload (weight dropped for the exercise)', () => {
    const definition = withSlot(
      { ...gzclpSlot, stages: [{ sets: 5, reps: 3 }] }, // single stage: first fail deloads
      2
    );
    const results: GenericResults = { 0: { 'squat-t1': { result: 'fail' } } };

    const rows = computeGenericProgram(definition, { squat: 100 }, results);

    expect(rows[0]?.slots[0]?.isDeload).toBe(false);
    expect(rows[1]?.slots[0]?.isDeload).toBe(true);
  });
});

describe('deload_percent rounding', () => {
  it('rounds the deloaded weight to the configured rounding step', () => {
    const definition = withSlot(
      { ...BASE_SLOT, onFinalStageFail: { type: 'deload_percent', percent: 10 } },
      2
    );
    const results: GenericResults = { 0: { 'squat-t1': { result: 'fail' } } };

    // 97.5 * 0.9 = 87.75 -> nearest 2.5 is 87.5
    const rows = computeGenericProgram(definition, { squat: 97.5 }, results);

    expect(rows[1]?.slots[0]?.weight).toBe(87.5);
  });

  it('honors a custom rounding step from config', () => {
    const definition = withSlot(
      { ...BASE_SLOT, onFinalStageFail: { type: 'deload_percent', percent: 10 } },
      2
    );
    const results: GenericResults = { 0: { 'squat-t1': { result: 'fail' } } };

    // 97.5 * 0.9 = 87.75 -> nearest 1 is 88
    const rows = computeGenericProgram(definition, { squat: 97.5, rounding: 1 }, results);

    expect(rows[1]?.slots[0]?.weight).toBe(88);
  });
});

describe('add_weight_reset_stage', () => {
  it('adds the configured amount, rounds it, and resets the stage to 0', () => {
    const slot: SlotDef = {
      ...BASE_SLOT,
      stages: [
        { sets: 3, reps: 5 },
        { sets: 3, reps: 3 },
      ],
      onSuccess: { type: 'add_weight' },
      onMidStageFail: { type: 'advance_stage' },
      onFinalStageFail: { type: 'add_weight_reset_stage', amount: 2.6 },
    };
    const definition = withSlot(slot, 3);
    const results: GenericResults = {
      0: { 'squat-t1': { result: 'fail' } }, // stage 0 -> 1 (final)
      1: { 'squat-t1': { result: 'fail' } }, // final fail -> +2.6, stage 0
    };

    const rows = computeGenericProgram(definition, { squat: 100 }, results);

    expect(rows[1]?.slots[0]?.stage).toBe(1);
    // 100 + 2.6 = 102.6 -> nearest 2.5 is 102.5; stage back to 0.
    expect(rows[2]?.slots[0]?.stage).toBe(0);
    expect(rows[2]?.slots[0]?.weight).toBe(102.5);
  });
});

describe('advance_stage / advance_stage_add_weight clamping', () => {
  it('clamps advance_stage at the last stage index', () => {
    const slot: SlotDef = {
      ...BASE_SLOT,
      stages: [
        { sets: 3, reps: 5 },
        { sets: 3, reps: 3 },
      ],
      onSuccess: { type: 'advance_stage' },
    };
    const definition = withSlot(slot, 3);
    const results: GenericResults = {
      0: { 'squat-t1': { result: 'success' } },
      1: { 'squat-t1': { result: 'success' } },
    };

    const rows = computeGenericProgram(definition, { squat: 100 }, results);

    expect(rows[1]?.slots[0]?.stage).toBe(1);
    expect(rows[2]?.slots[0]?.stage).toBe(1); // clamped at maxStageIdx
  });

  it('advance_stage_add_weight bumps stage and weight together, clamping the stage', () => {
    const slot: SlotDef = {
      ...BASE_SLOT,
      stages: [
        { sets: 3, reps: 5 },
        { sets: 3, reps: 3 },
      ],
      onSuccess: { type: 'advance_stage_add_weight' },
    };
    const definition = withSlot(slot, 3);
    const results: GenericResults = {
      0: { 'squat-t1': { result: 'success' } },
      1: { 'squat-t1': { result: 'success' } },
    };

    const rows = computeGenericProgram(definition, { squat: 100 }, results);

    expect(rows[1]?.slots[0]?.stage).toBe(1);
    expect(rows[1]?.slots[0]?.weight).toBe(105); // +5 increment
    expect(rows[2]?.slots[0]?.stage).toBe(1); // clamped
    expect(rows[2]?.slots[0]?.weight).toBe(110);
  });
});

describe('onFinalStageSuccess selection', () => {
  it('uses onFinalStageSuccess instead of onSuccess once the final stage is reached', () => {
    const slot: SlotDef = {
      ...BASE_SLOT,
      stages: [
        { sets: 3, reps: 5 },
        { sets: 3, reps: 3 },
      ],
      onSuccess: { type: 'advance_stage' },
      onFinalStageSuccess: { type: 'add_weight' },
    };
    const definition = withSlot(slot, 3);
    const results: GenericResults = {
      0: { 'squat-t1': { result: 'success' } }, // mid-stage success -> advance
      1: { 'squat-t1': { result: 'success' } }, // final-stage success -> add weight
    };

    const rows = computeGenericProgram(definition, { squat: 100 }, results);

    expect(rows[1]?.slots[0]?.stage).toBe(1);
    expect(rows[1]?.slots[0]?.weight).toBe(100);
    expect(rows[2]?.slots[0]?.stage).toBe(1); // add_weight does not reset the stage
    expect(rows[2]?.slots[0]?.weight).toBe(105);
  });
});

describe('update_tm failure path', () => {
  const tmSlot: SlotDef = {
    ...BASE_SLOT,
    onSuccess: { type: 'update_tm', amount: 5, minAmrapReps: 8 },
    trainingMaxKey: 'squat_tm',
    tmPercent: 1,
  };

  it('leaves the training max unchanged when AMRAP reps are below the minimum', () => {
    const definition = withSlot(tmSlot, 2);
    const results: GenericResults = {
      0: { 'squat-t1': { result: 'success', amrapReps: 7 } },
    };

    const rows = computeGenericProgram(definition, { squat: 100, squat_tm: 100 }, results);

    expect(rows[0]?.slots[0]?.weight).toBe(100);
    expect(rows[1]?.slots[0]?.weight).toBe(100);
  });

  it('leaves the training max unchanged when AMRAP reps are missing entirely', () => {
    const definition = withSlot(tmSlot, 2);
    const results: GenericResults = {
      0: { 'squat-t1': { result: 'success' } },
    };

    const rows = computeGenericProgram(definition, { squat: 100, squat_tm: 100 }, results);

    expect(rows[1]?.slots[0]?.weight).toBe(100);
  });
});

describe('AMRAP reps resolution', () => {
  it('derives AMRAP reps from the last set log when the stage is AMRAP', () => {
    const slot: SlotDef = {
      ...BASE_SLOT,
      stages: [{ sets: 3, reps: 5, amrap: true }],
    };
    const definition = withSlot(slot, 1);
    const results: GenericResults = {
      0: { 'squat-t1': { setLogs: [{ reps: 5 }, { reps: 5 }, { reps: 9 }] } },
    };

    const rows = computeGenericProgram(definition, { squat: 100 }, results);

    expect(rows[0]?.slots[0]?.isAmrap).toBe(true);
    expect(rows[0]?.slots[0]?.amrapReps).toBe(9);
  });

  it('falls back to the explicit amrapReps when no set logs exist', () => {
    const slot: SlotDef = {
      ...BASE_SLOT,
      stages: [{ sets: 3, reps: 5, amrap: true }],
    };
    const definition = withSlot(slot, 1);
    const results: GenericResults = {
      0: { 'squat-t1': { result: 'success', amrapReps: 11 } },
    };

    const rows = computeGenericProgram(definition, { squat: 100 }, results);

    expect(rows[0]?.slots[0]?.amrapReps).toBe(11);
  });

  it('does not derive AMRAP reps from set logs on a non-AMRAP stage', () => {
    const definition = withSlot(BASE_SLOT, 1); // stage has no amrap flag
    const results: GenericResults = {
      0: { 'squat-t1': { setLogs: [{ reps: 5 }, { reps: 5 }, { reps: 9 }] } },
    };

    const rows = computeGenericProgram(definition, { squat: 100 }, results);

    expect(rows[0]?.slots[0]?.isAmrap).toBe(false);
    expect(rows[0]?.slots[0]?.amrapReps).toBeUndefined();
  });
});

describe('start-weight resolution', () => {
  it('applies startWeightMultiplier and rounds to the rounding step', () => {
    const definition = withSlot({ ...BASE_SLOT, startWeightMultiplier: 0.9 }, 1);

    // 61 * 0.9 = 54.9 -> nearest 2.5 is 55
    const rows = computeGenericProgram(definition, { squat: 61 }, {});

    expect(rows[0]?.slots[0]?.weight).toBe(55);
  });

  it('applies startWeightOffset in units of the exercise weight increment', () => {
    const definition = withSlot({ ...BASE_SLOT, startWeightOffset: 2 }, 1);

    // 100 - 2 * increment(5) = 90
    const rows = computeGenericProgram(definition, { squat: 100 }, {});

    expect(rows[0]?.slots[0]?.weight).toBe(90);
  });

  it('combines multiplier and offset: (base * multiplier) - offset * increment', () => {
    const definition = withSlot(
      { ...BASE_SLOT, startWeightMultiplier: 0.5, startWeightOffset: 1 },
      1
    );

    // 100 * 0.5 = 50, then 50 - 1 * 5 = 45
    const rows = computeGenericProgram(definition, { squat: 100 }, {});

    expect(rows[0]?.slots[0]?.weight).toBe(45);
  });
});
