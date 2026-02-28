import { describe, it, expect } from 'bun:test';
import {
  computeGraduationTargets,
  checkGraduationCriterion,
  computeEpley1RM,
  suggestNextWeight,
} from './graduation';
import { MUTENROSHI_DEFINITION_JSONB } from '../../../apps/api/src/db/seeds/programs/mutenroshi';
import { ProgramDefinitionSchema } from './schemas/program-definition';

// ---------------------------------------------------------------------------
// Test helper: find a slot and assert it exists (avoids non-null assertions)
// ---------------------------------------------------------------------------

type MutenroshiSlot = (typeof MUTENROSHI_DEFINITION_JSONB)['days'][number]['slots'][number];

function findSlot(
  slots: readonly MutenroshiSlot[],
  predicate: (s: MutenroshiSlot) => boolean
): MutenroshiSlot {
  const found = slots.find(predicate);
  if (found === undefined) {
    throw new Error('Expected slot not found');
  }
  return found;
}

type MutenroshiConfigField = (typeof MUTENROSHI_DEFINITION_JSONB)['configFields'][number];

function findConfigField(key: string): MutenroshiConfigField {
  const found = MUTENROSHI_DEFINITION_JSONB.configFields.find((f) => f.key === key);
  if (found === undefined) {
    throw new Error(`Config field ${key} not found`);
  }
  return found;
}

// ---------------------------------------------------------------------------
// 4.1 — computeGraduationTargets
// ---------------------------------------------------------------------------

describe('computeGraduationTargets', () => {
  it('male 80 kg, rounding 2.5 returns targets at 80 kg', () => {
    const targets = computeGraduationTargets(80, 'male', 2.5);

    expect(targets).toHaveLength(3);
    expect(targets[0].targetWeight).toBe(80);
    expect(targets[1].targetWeight).toBe(80);
    expect(targets[2].targetWeight).toBe(80);
  });

  it('male 80 kg squat target requires 3 reps', () => {
    const targets = computeGraduationTargets(80, 'male', 2.5);

    expect(targets[0].exercise).toBe('squat');
    expect(targets[0].requiredReps).toBe(3);
  });

  it('male 80 kg bench target requires 1 rep', () => {
    const targets = computeGraduationTargets(80, 'male', 2.5);

    expect(targets[1].exercise).toBe('bench');
    expect(targets[1].requiredReps).toBe(1);
  });

  it('male 80 kg deadlift target requires 10 reps', () => {
    const targets = computeGraduationTargets(80, 'male', 2.5);

    expect(targets[2].exercise).toBe('deadlift');
    expect(targets[2].requiredReps).toBe(10);
  });

  it('female 60 kg, rounding 2.5 returns targets at 42.5 kg (60 * 0.70 = 42 -> 42.5)', () => {
    const targets = computeGraduationTargets(60, 'female', 2.5);

    expect(targets[0].targetWeight).toBe(42.5);
    expect(targets[1].targetWeight).toBe(42.5);
    expect(targets[2].targetWeight).toBe(42.5);
  });

  it('female 55 kg, rounding 1.25 returns targets at 38.75 kg (55 * 0.70 = 38.5 -> 38.75)', () => {
    const targets = computeGraduationTargets(55, 'female', 1.25);

    expect(targets[0].targetWeight).toBe(38.75);
    expect(targets[1].targetWeight).toBe(38.75);
    expect(targets[2].targetWeight).toBe(38.75);
  });
});

// ---------------------------------------------------------------------------
// 4.1 — checkGraduationCriterion
// ---------------------------------------------------------------------------

describe('checkGraduationCriterion', () => {
  it('squat 82.5 kg x 3 reps, target 80 returns true (weight >= target AND reps >= 3)', () => {
    const result = checkGraduationCriterion('squat', 82.5, 3, 80);

    expect(result).toBe(true);
  });

  it('squat 80 kg x 2 reps, target 80 returns false (reps < 3)', () => {
    const result = checkGraduationCriterion('squat', 80, 2, 80);

    expect(result).toBe(false);
  });

  it('squat 77.5 kg x 5 reps, target 80 returns false (weight < target)', () => {
    const result = checkGraduationCriterion('squat', 77.5, 5, 80);

    expect(result).toBe(false);
  });

  it('deadlift 80 kg x 10 reps, target 80 returns true', () => {
    const result = checkGraduationCriterion('deadlift', 80, 10, 80);

    expect(result).toBe(true);
  });

  it('bench 82.5 kg x 1 rep, target 80 returns true', () => {
    const result = checkGraduationCriterion('bench', 82.5, 1, 80);

    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4.2 — computeEpley1RM
// ---------------------------------------------------------------------------

describe('computeEpley1RM', () => {
  it('80 kg x 3 reps returns 88 (80 * (1 + 3/30) = 80 * 1.1 = 88)', () => {
    const result = computeEpley1RM(80, 3);

    expect(result).toBe(88);
  });

  it('80 kg x 1 rep returns approximately 82.667 (80 * (1 + 1/30))', () => {
    const result = computeEpley1RM(80, 1);

    expect(result).toBeCloseTo(82.667, 2);
  });

  it('80 kg x 10 reps returns approximately 106.667 (80 * (1 + 10/30))', () => {
    const result = computeEpley1RM(80, 10);

    expect(result).toBeCloseTo(106.667, 2);
  });

  it('returns 0 when weight is 0', () => {
    const result = computeEpley1RM(0, 5);

    expect(result).toBe(0);
  });

  it('returns 0 when reps is 0', () => {
    const result = computeEpley1RM(80, 0);

    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4.2 — suggestNextWeight
// ---------------------------------------------------------------------------

describe('suggestNextWeight', () => {
  it('returns null when no prior session exists', () => {
    const result = suggestNextWeight(undefined, undefined, 2.5);

    expect(result).toBeNull();
  });

  it('returns previous + rounding when only one session at 40 with rounding 2.5', () => {
    const result = suggestNextWeight(40, undefined, 2.5);

    expect(result).toBe(42.5);
  });

  it('consolidates (returns same weight) when increased from 40 to 42.5', () => {
    const result = suggestNextWeight(42.5, 40, 2.5);

    expect(result).toBe(42.5);
  });

  it('suggests increase when maintained at 42.5 twice', () => {
    const result = suggestNextWeight(42.5, 42.5, 2.5);

    expect(result).toBe(45);
  });
});

// ---------------------------------------------------------------------------
// 4.3 — MUTENROSHI structural tests
// ---------------------------------------------------------------------------

describe('MUTENROSHI program definition structure', () => {
  const def = MUTENROSHI_DEFINITION_JSONB;

  it('has exactly 200 days', () => {
    expect(def.days.length).toBe(200);
  });

  it('totalWorkouts is 200', () => {
    expect(def.totalWorkouts).toBe(200);
  });

  it('cycleLength is 200', () => {
    expect(def.cycleLength).toBe(200);
  });

  it('workoutsPerWeek is 3', () => {
    expect(def.workoutsPerWeek).toBe(3);
  });

  it('day 0 has tiers containing core, activation, proprioception, and fundamental', () => {
    const tiers = new Set(def.days[0].slots.map((s) => s.tier));

    expect(tiers.has('core')).toBe(true);
    expect(tiers.has('activation')).toBe(true);
    expect(tiers.has('proprioception')).toBe(true);
    expect(tiers.has('fundamental')).toBe(true);
  });

  it('day 0 fundamental slot exerciseId is squat_bodyweight (bodyweight phase)', () => {
    const slot = findSlot(def.days[0].slots, (s) => s.tier === 'fundamental');

    expect(slot.exerciseId).toBe('squat_bodyweight');
  });

  it('day 12 fundamental slot exerciseId is squat_barbell (loaded phase)', () => {
    const slot = findSlot(def.days[12].slots, (s) => s.tier === 'fundamental');

    expect(slot.exerciseId).toBe('squat_barbell');
  });

  it('day 0 fundamental stages[0] has sets=6 and reps=5 (week 1 volume)', () => {
    const slot = findSlot(def.days[0].slots, (s) => s.tier === 'fundamental');

    expect(slot.stages[0].sets).toBe(6);
    expect(slot.stages[0].reps).toBe(5);
  });

  it('day 12 fundamental stages[0] has sets=3 and reps=5 (week 5 volume)', () => {
    const slot = findSlot(def.days[12].slots, (s) => s.tier === 'fundamental');

    expect(slot.stages[0].sets).toBe(3);
    expect(slot.stages[0].reps).toBe(5);
  });

  it('day 18 fundamental repeats week 1 volume (6x5 - cycle restarts)', () => {
    const slot = findSlot(def.days[18].slots, (s) => s.tier === 'fundamental');

    expect(slot.stages[0].sets).toBe(6);
    expect(slot.stages[0].reps).toBe(5);
  });

  it('plank slot has non-empty notes', () => {
    const slot = findSlot(def.days[0].slots, (s) => s.exerciseId === 'plank');

    expect(slot.notes).toBeDefined();
    expect(typeof slot.notes).toBe('string');
    expect(String(slot.notes).length).toBeGreaterThan(0);
  });

  it('validates through ProgramDefinitionSchema.safeParse (with hydrated exercises)', () => {
    // Seed definitions have exercises as { id: {} }, but the schema requires { name: string }.
    // Hydrate exercise names for validation purposes.
    const hydrated = {
      ...def,
      exercises: Object.fromEntries(Object.keys(def.exercises).map((id) => [id, { name: id }])),
    };

    const result = ProgramDefinitionSchema.safeParse(hydrated);

    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4.8 — configFields structural tests
// ---------------------------------------------------------------------------

describe('MUTENROSHI configFields', () => {
  it('has gender field with type select and 2 options', () => {
    const genderField = findConfigField('gender');

    expect(genderField.type).toBe('select');
    expect('options' in genderField).toBe(true);
    // Gender field has options — verify via the configFields definition directly
    const optionsField = MUTENROSHI_DEFINITION_JSONB.configFields.find(
      (f) => f.key === 'gender' && f.type === 'select'
    );
    expect(optionsField).toBeDefined();
    if (optionsField !== undefined && 'options' in optionsField) {
      expect(optionsField.options).toHaveLength(2);
    }
  });

  it('has bodyweight field with type weight, min 30, and step 0.5', () => {
    const bwField = findConfigField('bodyweight');

    expect(bwField.type).toBe('weight');
    // Access min/step via the configFields definition directly
    const weightField = MUTENROSHI_DEFINITION_JSONB.configFields.find(
      (f) => f.key === 'bodyweight' && f.type === 'weight'
    );
    expect(weightField).toBeDefined();
    if (weightField !== undefined && 'min' in weightField) {
      expect(weightField.min).toBe(30);
      expect(weightField.step).toBe(0.5);
    }
  });

  it('weightIncrements has entries for squat_start, bench_start, and deadlift_start', () => {
    const def = MUTENROSHI_DEFINITION_JSONB;

    expect(def.weightIncrements.squat_start).toBeDefined();
    expect(def.weightIncrements.bench_start).toBeDefined();
    expect(def.weightIncrements.deadlift_start).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 4.9 — Progression rule structural tests
// ---------------------------------------------------------------------------

describe('MUTENROSHI progression rules', () => {
  const def = MUTENROSHI_DEFINITION_JSONB;

  it('all core slots in any day have no_change progression rules', () => {
    for (const day of def.days) {
      const coreSlots = day.slots.filter((s) => s.tier === 'core');

      for (const slot of coreSlots) {
        expect(slot.onSuccess.type).toBe('no_change');
        expect(slot.onMidStageFail.type).toBe('no_change');
        expect(slot.onFinalStageFail.type).toBe('no_change');
      }
    }
  });

  it('all fundamental slots across all 200 days have onSuccess.type no_change', () => {
    for (const day of def.days) {
      const fundamentalSlots = day.slots.filter((s) => s.tier === 'fundamental');

      for (const slot of fundamentalSlots) {
        expect(slot.onSuccess.type).toBe('no_change');
      }
    }
  });
});
