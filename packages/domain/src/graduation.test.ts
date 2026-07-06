import { describe, expect, it } from 'vitest';

import { computeEpley1RM, computeGraduationTargets } from './graduation';

describe('computeGraduationTargets', () => {
  it('returns one target per lift with the expected reps and a shared target weight', () => {
    const targets = computeGraduationTargets(80, 'male', 2.5);

    expect(targets).toHaveLength(3);
    expect(targets.map((t) => t.exercise)).toEqual(['squat', 'bench', 'deadlift']);
    expect(targets.map((t) => t.requiredReps)).toEqual([3, 1, 10]);
    for (const target of targets) {
      expect(target.targetWeight).toBe(80);
      expect(target.description).toContain(`${target.targetWeight} kg`);
    }
  });

  it('uses full bodyweight (1.0 multiplier) for male', () => {
    const targets = computeGraduationTargets(100, 'male', 2.5);

    expect(targets[0]?.targetWeight).toBe(100);
  });

  it('applies the 0.7 multiplier for female', () => {
    const targets = computeGraduationTargets(100, 'female', 2.5);

    expect(targets[0]?.targetWeight).toBe(70);
  });

  it('treats any non-female gender as the 1.0 multiplier', () => {
    const targets = computeGraduationTargets(90, 'other', 2.5);

    expect(targets[0]?.targetWeight).toBe(90);
  });

  it('rounds the target weight to the nearest rounding step', () => {
    // female: 60 * 0.7 = 42 -> nearest 2.5 is 42.5
    expect(computeGraduationTargets(60, 'female', 2.5)[0]?.targetWeight).toBe(42.5);
    // male: 83 -> nearest 5 is 85
    expect(computeGraduationTargets(83, 'male', 5)[0]?.targetWeight).toBe(85);
    // female: 82.6 * 0.7 = 57.82 -> nearest 1 is 58
    expect(computeGraduationTargets(82.6, 'female', 1)[0]?.targetWeight).toBe(58);
  });
});

describe('computeEpley1RM', () => {
  it('applies the Epley formula: weight * (1 + reps / 30)', () => {
    expect(computeEpley1RM(100, 5)).toBeCloseTo(116.6666667, 5);
    expect(computeEpley1RM(60, 1)).toBeCloseTo(62, 5);
    expect(computeEpley1RM(80, 10)).toBeCloseTo(106.6666667, 5);
  });

  it('returns 0 for non-positive weight or reps', () => {
    expect(computeEpley1RM(0, 5)).toBe(0);
    expect(computeEpley1RM(-10, 5)).toBe(0);
    expect(computeEpley1RM(100, 0)).toBe(0);
    expect(computeEpley1RM(100, -1)).toBe(0);
  });
});
