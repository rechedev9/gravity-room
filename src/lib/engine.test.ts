import { describe, it, expect } from 'bun:test';
import { computeProgram } from './engine';
import { DAYS, T1_STAGES, T2_STAGES, inc } from './program';
import type { StartWeights, Results } from '@/types';

const DEFAULT_WEIGHTS: StartWeights = {
  squat: 60,
  bench: 40,
  deadlift: 80,
  ohp: 25,
  latpulldown: 30,
  dbrow: 15,
};

function roundToNearestHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

describe('computeProgram', () => {
  describe('with no results (fresh program)', () => {
    it('should generate 90 workouts', () => {
      const rows = computeProgram(DEFAULT_WEIGHTS, {});
      expect(rows).toHaveLength(90);
    });

    it('should cycle through the 4-day rotation', () => {
      const rows = computeProgram(DEFAULT_WEIGHTS, {});
      expect(rows[0].dayName).toBe('Day 1');
      expect(rows[1].dayName).toBe('Day 2');
      expect(rows[2].dayName).toBe('Day 3');
      expect(rows[3].dayName).toBe('Day 4');
      expect(rows[4].dayName).toBe('Day 1');
    });

    it('should start T1 at stage 0 (5x3)', () => {
      const rows = computeProgram(DEFAULT_WEIGHTS, {});
      expect(rows[0].t1Stage).toBe(0);
      expect(rows[0].t1Sets).toBe(T1_STAGES[0].sets);
      expect(rows[0].t1Reps).toBe(T1_STAGES[0].reps);
    });

    it('should start T2 at stage 0 (3x10)', () => {
      const rows = computeProgram(DEFAULT_WEIGHTS, {});
      expect(rows[0].t2Stage).toBe(0);
      expect(rows[0].t2Sets).toBe(T2_STAGES[0].sets);
      expect(rows[0].t2Reps).toBe(T2_STAGES[0].reps);
    });

    it('should compute T2 starting weight as 65% of T1', () => {
      const rows = computeProgram(DEFAULT_WEIGHTS, {});
      // Day 1: T2 is bench, T1 bench start = 40, so T2 bench = round(40 * 0.65) = 26
      expect(rows[0].t2Weight).toBe(roundToNearestHalf(DEFAULT_WEIGHTS.bench * 0.65));
    });

    it('should use start weights for T3', () => {
      const rows = computeProgram(DEFAULT_WEIGHTS, {});
      // Day 1 T3 = latpulldown
      expect(rows[0].t3Weight).toBe(DEFAULT_WEIGHTS.latpulldown);
    });

    it('should linearly increase weight each time an exercise appears (no results = implicit pass)', () => {
      const rows = computeProgram(DEFAULT_WEIGHTS, {});
      // Squat is T1 on Day 1 (index 0) and Day 3's T2, but as T1 again on index 4 (Day 1)
      // After index 0 with implicit pass: squat T1 weight = 60 + 5 = 65
      expect(rows[4].t1Weight).toBe(DEFAULT_WEIGHTS.squat + inc('squat'));
    });
  });

  describe('T1 progression on success', () => {
    it('should increase T1 weight by the correct increment after a pass', () => {
      const results: Results = { 0: { t1: 'success' } };
      const rows = computeProgram(DEFAULT_WEIGHTS, results);
      // Squat T1 after pass at index 0 → next squat T1 at index 4 = 60 + 5
      expect(rows[4].t1Weight).toBe(65);
    });

    it('should use 2.5 increment for bench and ohp', () => {
      const results: Results = { 1: { t1: 'success' } };
      const rows = computeProgram(DEFAULT_WEIGHTS, results);
      // OHP is T1 on Day 2 (index 1), next OHP T1 at Day 4 (index 3)... no, Day 4 T1 is deadlift
      // OHP T1 appears at index 1, 5, 9, etc.
      expect(rows[5].t1Weight).toBe(DEFAULT_WEIGHTS.ohp + inc('ohp'));
    });
  });

  describe('T1 failure progression', () => {
    it('should advance T1 to stage 1 (6x2) on first failure', () => {
      const results: Results = { 0: { t1: 'fail' } };
      const rows = computeProgram(DEFAULT_WEIGHTS, results);
      // Next squat T1 at index 4 should be stage 1
      expect(rows[4].t1Stage).toBe(1);
      expect(rows[4].t1Sets).toBe(T1_STAGES[1].sets);
      expect(rows[4].t1Reps).toBe(T1_STAGES[1].reps);
    });

    it('should advance T1 to stage 2 (10x1) on second consecutive failure', () => {
      const results: Results = {
        0: { t1: 'fail' },
        4: { t1: 'fail' },
      };
      const rows = computeProgram(DEFAULT_WEIGHTS, results);
      // After two failures: squat should be at stage 2 at index 8
      expect(rows[8].t1Stage).toBe(2);
      expect(rows[8].t1Sets).toBe(T1_STAGES[2].sets);
      expect(rows[8].t1Reps).toBe(T1_STAGES[2].reps);
    });

    it('should reset T1 to stage 0 with 10% deload after failing at stage 2', () => {
      const results: Results = {
        0: { t1: 'fail' },
        4: { t1: 'fail' },
        8: { t1: 'fail' },
      };
      const rows = computeProgram(DEFAULT_WEIGHTS, results);
      // After 3 failures: reset to stage 0 with weight * 0.9
      expect(rows[12].t1Stage).toBe(0);
      expect(rows[12].t1Weight).toBe(roundToNearestHalf(DEFAULT_WEIGHTS.squat * 0.9));
    });
  });

  describe('T2 failure progression', () => {
    it('should advance T2 to stage 1 (3x8) on first failure', () => {
      const results: Results = { 0: { t2: 'fail' } };
      const rows = computeProgram(DEFAULT_WEIGHTS, results);
      // Bench T2 on Day 1 (index 0), next bench T2 is Day 3 (index 2)... no.
      // Day 1 T2=bench, Day 3 T2=squat. Bench T2 reappears at index 4 (Day 1 again)
      expect(rows[4].t2Stage).toBe(1);
      expect(rows[4].t2Sets).toBe(T2_STAGES[1].sets);
      expect(rows[4].t2Reps).toBe(T2_STAGES[1].reps);
    });

    it('should add 15 and reset T2 to stage 0 after failing at stage 2', () => {
      const results: Results = {
        0: { t2: 'fail' },
        4: { t2: 'fail' },
        8: { t2: 'fail' },
      };
      const rows = computeProgram(DEFAULT_WEIGHTS, results);
      const baseT2Weight = roundToNearestHalf(DEFAULT_WEIGHTS.bench * 0.65);
      // After 3 T2 failures: reset to stage 0, weight + 15
      expect(rows[12].t2Stage).toBe(0);
      expect(rows[12].t2Weight).toBe(baseT2Weight + 15);
    });
  });

  describe('T3 progression', () => {
    it('should increase T3 weight by 2.5 on success', () => {
      const results: Results = { 0: { t3: 'success' } };
      const rows = computeProgram(DEFAULT_WEIGHTS, results);
      // Day 1 T3=latpulldown. Next latpulldown is Day 3 (index 2)
      expect(rows[2].t3Weight).toBe(DEFAULT_WEIGHTS.latpulldown + 2.5);
    });

    it('should keep T3 weight unchanged on failure', () => {
      const results: Results = { 0: { t3: 'fail' } };
      const rows = computeProgram(DEFAULT_WEIGHTS, results);
      expect(rows[2].t3Weight).toBe(DEFAULT_WEIGHTS.latpulldown);
    });
  });

  describe('day rotation structure', () => {
    it('should assign correct T1/T2 exercises per day', () => {
      const rows = computeProgram(DEFAULT_WEIGHTS, {});
      for (let i = 0; i < 8; i++) {
        const day = DAYS[i % 4];
        expect(rows[i].t1Exercise).toBe(day.t1);
        expect(rows[i].t2Exercise).toBe(day.t2);
        expect(rows[i].t3Exercise).toBe(day.t3);
      }
    });
  });
});
