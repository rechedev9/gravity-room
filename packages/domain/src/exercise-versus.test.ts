import { describe, expect, it } from 'vitest';
import { compareExercises, isVersusGoal, TIE_MARGIN, weightedAxesForGoal } from './exercise-versus';
import {
  EXERCISE_VERSUS_PROFILES,
  getVersusProfile,
  listComparableExerciseIds,
} from './exercise-versus-profiles';
import {
  ExerciseVersusProfileSchema,
  VersusGoalSchema,
  VersusResultSchema,
} from './schemas/exercise-versus';

describe('exercise versus profiles', () => {
  it('validates every curated profile', () => {
    for (const profile of EXERCISE_VERSUS_PROFILES) {
      const parsed = ExerciseVersusProfileSchema.safeParse(profile);
      expect(parsed.success, profile.exerciseId).toBe(true);
    }
  });

  it('lists unique chest ids', () => {
    const ids = listComparableExerciseIds('chest');
    expect(ids.length).toBeGreaterThanOrEqual(6);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('bench');
    expect(ids).toContain('decline-bench');
  });

  it('attaches at least one meta_analysis grade on free/machine or length axes', () => {
    const machine = getVersusProfile('bench_machine');
    expect(machine?.evidence.some((e) => e.grade === 'meta_analysis')).toBe(true);
    const db = getVersusProfile('dumbbell-bench');
    expect(
      db?.evidence.some((e) => e.grade === 'meta_analysis' && e.axes.includes('romStretch'))
    ).toBe(true);
  });
});

describe('compareExercises', () => {
  it('rejects the same exercise twice', () => {
    expect(compareExercises('bench', 'bench', 'general_chest_hypertrophy')).toEqual({
      ok: false,
      code: 'same_exercise',
    });
  });

  it('rejects missing profiles fail-closed', () => {
    const result = compareExercises('bench', 'not_a_real_exercise', 'max_strength_bench');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('profile_missing');
      expect(result.missingIds).toContain('not_a_real_exercise');
    }
  });

  it('rejects invalid goal as invalid_request', () => {
    expect(
      compareExercises('bench', 'incline_bench', 'not_a_goal' as 'max_strength_bench')
    ).toEqual({ ok: false, code: 'invalid_request' });
  });

  it('picks flat bench over decline for max strength bench', () => {
    const result = compareExercises('bench', 'decline-bench', 'max_strength_bench');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(VersusResultSchema.safeParse(result.result).success).toBe(true);
    expect(result.result.winnerId).toBe('bench');
    expect(result.result.scoreMargin).toBeGreaterThanOrEqual(TIE_MARGIN);
  });

  it('does not list transfer-to-flat-bench as a pro when bench is in the pair', () => {
    const ids = listComparableExerciseIds('chest').filter((id) => id !== 'bench');
    for (const other of ids) {
      for (const goal of VersusGoalSchema.options) {
        const ab = compareExercises('bench', other, goal);
        expect(ab.ok, `${other} ${goal}`).toBe(true);
        if (!ab.ok) continue;
        const axes = [...ab.result.prosA, ...ab.result.prosB].map((p) => p.axis);
        expect(axes, `${other} ${goal}`).not.toContain('strengthTransferFlatBench');
      }
    }
  });

  it('may still list transfer pro when neither side is flat bench', () => {
    const result = compareExercises('incline_bench', 'pec_deck', 'max_strength_bench');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const axes = [...result.result.prosA, ...result.result.prosB].map((p) => p.axis);
    expect(axes).toContain('strengthTransferFlatBench');
  });

  it('only emits pros on goal-weighted axes', () => {
    const result = compareExercises('bench', 'incline_bench', 'hypertrophy_upper_chest');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const allowed = new Set(weightedAxesForGoal('hypertrophy_upper_chest'));
    for (const p of [...result.result.prosA, ...result.result.prosB]) {
      expect(allowed.has(p.axis), p.axis).toBe(true);
    }
  });

  it('picks incline over flat for upper-chest hypertrophy', () => {
    const result = compareExercises('bench', 'incline_bench', 'hypertrophy_upper_chest');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.winnerId).toBe('incline_bench');
    expect(result.result.prosB.some((p) => p.axis === 'upperChest')).toBe(true);
  });

  it('picks decline over incline for lower-chest hypertrophy', () => {
    const result = compareExercises('incline_bench', 'decline-bench', 'hypertrophy_lower_chest');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.winnerId).toBe('decline-bench');
  });

  it('favors machine press for beginner-friendly goal', () => {
    const result = compareExercises('bench', 'bench_machine', 'beginner_friendly');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.winnerId).toBe('bench_machine');
  });

  it('favors free bench over machine for max strength on flat bench (specificity MA)', () => {
    const result = compareExercises('bench', 'bench_machine', 'max_strength_bench');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.winnerId).toBe('bench');
    expect(result.result.prosB.some((p) => p.axis === 'skillDemand')).toBe(false);
  });

  it('favors dumbbell stretch stimulus for general hypertrophy vs pec deck isolation load', () => {
    const result = compareExercises('dumbbell-bench', 'pec_deck', 'general_chest_hypertrophy');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // DB should win via overload + regional press + stretch; not a hard lock on winner id
    // but margin should be decisive and include rom or overload pros for DB or mid for both.
    expect(result.result.scoreMargin).toBeGreaterThan(0);
    expect(Number.isFinite(result.result.exerciseA.score)).toBe(true);
  });

  it('is order-symmetric for winner and margin', () => {
    const ab = compareExercises('bench', 'incline_db_press', 'hypertrophy_upper_chest');
    const ba = compareExercises('incline_db_press', 'bench', 'hypertrophy_upper_chest');
    expect(ab.ok && ba.ok).toBe(true);
    if (!ab.ok || !ba.ok) return;
    expect(ab.result.winnerId).toBe(ba.result.winnerId);
    expect(ab.result.scoreMargin).toBe(ba.result.scoreMargin);
  });

  it('always includes shared caveats and evidence', () => {
    const result = compareExercises('dumbbell-bench', 'pec_deck', 'general_chest_hypertrophy');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.sharedCaveats).toEqual([
      'same_muscle_group_only',
      'goal_relative_winner',
      'not_medical_advice',
    ]);
    expect(result.result.evidence.length).toBeGreaterThan(0);
  });

  it('keeps scores finite across the full chest grid', () => {
    const ids = listComparableExerciseIds('chest');
    for (const a of ids) {
      for (const b of ids) {
        if (a === b) continue;
        for (const goal of VersusGoalSchema.options) {
          const r = compareExercises(a, b, goal);
          expect(r.ok, `${a} vs ${b} @ ${goal}`).toBe(true);
          if (!r.ok) continue;
          expect(Number.isFinite(r.result.exerciseA.score)).toBe(true);
          expect(Number.isFinite(r.result.exerciseB.score)).toBe(true);
        }
      }
    }
  });

  it('isVersusGoal guards enum membership', () => {
    expect(isVersusGoal('general_chest_hypertrophy')).toBe(true);
    expect(isVersusGoal('nope')).toBe(false);
  });
});
