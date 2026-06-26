import { describe, expect, it } from 'vitest';

import {
  MAX_DAYS,
  MAX_PRESCRIPTIONS_PER_SLOT,
  MAX_STAGES_PER_SLOT,
  MAX_SLOTS_PER_DAY,
  MAX_TOTAL_SLOTS,
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

const MAX_DEFINITION_MAP_KEYS = 100;
const OVERSIZED_SELECT_OPTIONS = 101;
const OVERSIZED_PROGRAM_STRING = 'x'.repeat(1001);
const OVERSIZED_PRESCRIPTIONS = MAX_PRESCRIPTIONS_PER_SLOT + 1;
const OVERSIZED_STAGES = MAX_STAGES_PER_SLOT + 1;

function buildExerciseMap(count: number) {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `exercise-${index}`,
      { name: `Exercise ${index}` },
    ])
  );
}

function buildWeightIncrementMap(count: number) {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => [`exercise-${index}`, 5]));
}

function buildConfigFields(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    key: `exercise-${index}`,
    label: `Exercise ${index}`,
    type: 'weight' as const,
    min: 0,
    step: 2.5,
  }));
}

function buildSelectOptions(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    label: `Option ${index}`,
    value: `option-${index}`,
  }));
}

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

  it('rejects more exercise definitions than the cap', () => {
    expect(
      ProgramDefinitionSchema.safeParse({
        ...BASE,
        exercises: buildExerciseMap(MAX_DEFINITION_MAP_KEYS + 1),
      }).success
    ).toBe(false);
  });

  it('rejects more config fields than the cap', () => {
    expect(
      ProgramDefinitionSchema.safeParse({
        ...BASE,
        configFields: buildConfigFields(MAX_DEFINITION_MAP_KEYS + 1),
      }).success
    ).toBe(false);
  });

  it('rejects more select options than the cap', () => {
    expect(
      ProgramDefinitionSchema.safeParse({
        ...BASE,
        configFields: [
          {
            key: 'variant',
            label: 'Variant',
            type: 'select',
            options: buildSelectOptions(OVERSIZED_SELECT_OPTIONS),
          },
        ],
      }).success
    ).toBe(false);
  });

  it('rejects more weight increments than the cap', () => {
    expect(
      ProgramDefinitionSchema.safeParse({
        ...BASE,
        weightIncrements: buildWeightIncrementMap(MAX_DEFINITION_MAP_KEYS + 1),
      }).success
    ).toBe(false);
  });

  it('rejects string fields above the cap', () => {
    expect(
      ProgramDefinitionSchema.safeParse({
        ...BASE,
        description: OVERSIZED_PROGRAM_STRING,
      }).success
    ).toBe(false);

    expect(
      ProgramDefinitionSchema.safeParse({
        ...BASE,
        days: [{ name: 'Day A', slots: [{ ...SLOT, notes: OVERSIZED_PROGRAM_STRING }] }],
      }).success
    ).toBe(false);

    expect(
      ProgramDefinitionSchema.safeParse({
        ...BASE,
        configFields: [
          {
            key: 'variant',
            label: 'Variant',
            type: 'select',
            options: [{ label: 'Option', value: OVERSIZED_PROGRAM_STRING }],
          },
        ],
      }).success
    ).toBe(false);
  });

  it('rejects more prescriptions per slot than the cap', () => {
    expect(
      ProgramDefinitionSchema.safeParse({
        ...BASE,
        days: [
          {
            name: 'Day A',
            slots: [
              {
                ...SLOT,
                percentOf: 'squat_tm',
                prescriptions: Array.from({ length: OVERSIZED_PRESCRIPTIONS }, () => ({
                  percent: 75,
                  reps: 5,
                  sets: 1,
                })),
              },
            ],
          },
        ],
      }).success
    ).toBe(false);
  });

  it('rejects more stages per slot than the cap', () => {
    expect(
      ProgramDefinitionSchema.safeParse({
        ...BASE,
        days: [
          {
            name: 'Day A',
            slots: [
              {
                ...SLOT,
                stages: Array.from({ length: OVERSIZED_STAGES }, () => ({ sets: 3, reps: 5 })),
              },
            ],
          },
        ],
      }).success
    ).toBe(false);
  });

  it('rejects more aggregate slots than the cap', () => {
    const dayCount = Math.floor(MAX_TOTAL_SLOTS / MAX_SLOTS_PER_DAY) + 1;
    const days = Array.from({ length: dayCount }, (_, dayIndex) => ({
      name: `Day ${dayIndex}`,
      slots: Array.from({ length: MAX_SLOTS_PER_DAY }, (_, slotIndex) => ({
        ...SLOT,
        id: `slot-${dayIndex}-${slotIndex}`,
      })),
    }));

    expect(ProgramDefinitionSchema.safeParse({ ...BASE, days }).success).toBe(false);
  });
});
