import { describe, expect, it } from 'bun:test';

import {
  MAX_DAYS,
  MAX_SLOTS_PER_DAY,
  MAX_TOTAL_WORKOUTS,
  ProgramDefinitionSchema,
} from './program-definition';

const SLOT = {
  id: 'squat-t1',
  exerciseId: 'squat',
  tier: 't1',
  stages: [{ sets: 3, reps: 5 }],
  onSuccess: { type: 'add_weight' as const },
  onMidStageFail: { type: 'no_change' as const },
  onFinalStageFail: { type: 'no_change' as const },
  startWeightKey: 'squat',
};

const BASE = {
  id: 'test-prog',
  name: 'Test Program',
  description: '',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset' as const,
  cycleLength: 1,
  totalWorkouts: 1,
  workoutsPerWeek: 1,
  exercises: { squat: { name: 'Squat' } },
  configFields: [{ key: 'squat', label: 'Squat', type: 'weight' as const, min: 20, step: 2.5 }],
  weightIncrements: { squat: 5 },
  days: [{ name: 'Day A', slots: [SLOT] }],
};

describe('ProgramDefinitionSchema bounds (DoS guard)', () => {
  it('accepts a minimal valid definition', () => {
    expect(ProgramDefinitionSchema.safeParse(BASE).success).toBe(true);
  });

  it('accepts totalWorkouts at the cap', () => {
    expect(
      ProgramDefinitionSchema.safeParse({ ...BASE, totalWorkouts: MAX_TOTAL_WORKOUTS }).success
    ).toBe(true);
  });

  it('rejects totalWorkouts above the cap', () => {
    expect(
      ProgramDefinitionSchema.safeParse({ ...BASE, totalWorkouts: MAX_TOTAL_WORKOUTS + 1 }).success
    ).toBe(false);
  });

  it('rejects an absurd totalWorkouts (the DoS payload)', () => {
    expect(
      ProgramDefinitionSchema.safeParse({ ...BASE, totalWorkouts: 2_000_000_000 }).success
    ).toBe(false);
  });

  it('rejects more days than the cap', () => {
    const days = Array.from({ length: MAX_DAYS + 1 }, () => ({ name: 'D', slots: [SLOT] }));
    expect(ProgramDefinitionSchema.safeParse({ ...BASE, days }).success).toBe(false);
  });

  it('rejects more slots per day than the cap', () => {
    const slots = Array.from({ length: MAX_SLOTS_PER_DAY + 1 }, (_, i) => ({
      ...SLOT,
      id: `slot-${i}`,
    }));
    expect(
      ProgramDefinitionSchema.safeParse({ ...BASE, days: [{ name: 'D', slots }] }).success
    ).toBe(false);
  });
});
