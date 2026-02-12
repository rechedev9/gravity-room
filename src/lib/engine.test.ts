import { describe, it, expect } from 'bun:test';
import { computeProgram } from './engine';
import { DAYS, T1_STAGES, T2_STAGES, TOTAL_WORKOUTS } from './program';
import { DEFAULT_WEIGHTS, buildResults, buildSuccessfulResults } from '../../test/helpers/fixtures';
import type { StartWeights, Results } from '@/types';

// ---------------------------------------------------------------------------
// Helper: round to nearest 0.5 (mirrors engine internals for expected values)
// ---------------------------------------------------------------------------
function round(v: number): number {
  return Math.round(v * 2) / 2;
}

// ---------------------------------------------------------------------------
// Structural invariants — these hold for ANY inputs
// ---------------------------------------------------------------------------
describe('computeProgram: structural invariants', () => {
  it('should always produce exactly 90 rows', () => {
    const rows = computeProgram(DEFAULT_WEIGHTS, {});
    expect(rows).toHaveLength(TOTAL_WORKOUTS);
  });

  it('should produce 90 rows regardless of how many results are provided', () => {
    const results = buildSuccessfulResults(45);
    const rows = computeProgram(DEFAULT_WEIGHTS, results);
    expect(rows).toHaveLength(TOTAL_WORKOUTS);
  });

  it('should cycle through the 4-day rotation for all 90 workouts', () => {
    const rows = computeProgram(DEFAULT_WEIGHTS, {});
    for (let i = 0; i < TOTAL_WORKOUTS; i++) {
      expect(rows[i].dayName).toBe(DAYS[i % 4].name);
      expect(rows[i].t1Exercise).toBe(DAYS[i % 4].t1);
      expect(rows[i].t2Exercise).toBe(DAYS[i % 4].t2);
      expect(rows[i].t3Exercise).toBe(DAYS[i % 4].t3);
    }
  });

  it('should never produce negative weights', () => {
    // Even with many failures, weights should floor at 0
    const results: Results = {};
    for (let i = 0; i < 90; i++) {
      results[i] = { t1: 'fail', t2: 'fail', t3: 'fail' };
    }
    const rows = computeProgram(DEFAULT_WEIGHTS, results);
    for (const row of rows) {
      expect(row.t1Weight).toBeGreaterThanOrEqual(0);
      expect(row.t2Weight).toBeGreaterThanOrEqual(0);
      expect(row.t3Weight).toBeGreaterThanOrEqual(0);
    }
  });

  it('should keep T1 stage between 0 and 2 inclusive', () => {
    const results: Results = {};
    for (let i = 0; i < 90; i++) {
      results[i] = { t1: 'fail' };
    }
    const rows = computeProgram(DEFAULT_WEIGHTS, results);
    for (const row of rows) {
      expect(row.t1Stage).toBeGreaterThanOrEqual(0);
      expect(row.t1Stage).toBeLessThanOrEqual(2);
    }
  });

  it('should keep T2 stage between 0 and 2 inclusive', () => {
    const results: Results = {};
    for (let i = 0; i < 90; i++) {
      results[i] = { t2: 'fail' };
    }
    const rows = computeProgram(DEFAULT_WEIGHTS, results);
    for (const row of rows) {
      expect(row.t2Stage).toBeGreaterThanOrEqual(0);
      expect(row.t2Stage).toBeLessThanOrEqual(2);
    }
  });

  it('should always map sets/reps consistently with stage', () => {
    const results: Results = {};
    for (let i = 0; i < 90; i++) {
      results[i] = { t1: i % 3 === 0 ? 'fail' : 'success', t2: i % 5 === 0 ? 'fail' : 'success' };
    }
    const rows = computeProgram(DEFAULT_WEIGHTS, results);
    for (const row of rows) {
      expect(row.t1Sets).toBe(T1_STAGES[row.t1Stage].sets);
      expect(row.t1Reps).toBe(T1_STAGES[row.t1Stage].reps);
      expect(row.t2Sets).toBe(T2_STAGES[row.t2Stage].sets);
      expect(row.t2Reps).toBe(T2_STAGES[row.t2Stage].reps);
    }
  });
});

// ---------------------------------------------------------------------------
// Snapshot: fresh program (no results) — full output comparison
// ---------------------------------------------------------------------------
describe('computeProgram: fresh program snapshot', () => {
  it('should match expected output for first 8 workouts with no results', () => {
    const rows = computeProgram(DEFAULT_WEIGHTS, {});
    const first8 = rows.slice(0, 8).map((r) => ({
      i: r.index,
      day: r.dayName,
      t1: `${r.t1Exercise}@${r.t1Weight}kg s${r.t1Stage}`,
      t2: `${r.t2Exercise}@${r.t2Weight}kg s${r.t2Stage}`,
      t3: `${r.t3Exercise}@${r.t3Weight}kg`,
    }));

    // No results = implicit pass = weight increases each appearance
    expect(first8).toEqual([
      { i: 0, day: 'Day 1', t1: 'squat@60kg s0', t2: 'bench@26kg s0', t3: 'latpulldown@30kg' },
      { i: 1, day: 'Day 2', t1: 'ohp@25kg s0', t2: 'deadlift@52kg s0', t3: 'dbrow@15kg' },
      { i: 2, day: 'Day 3', t1: 'bench@40kg s0', t2: 'squat@39kg s0', t3: 'latpulldown@30kg' },
      { i: 3, day: 'Day 4', t1: 'deadlift@80kg s0', t2: 'ohp@16.5kg s0', t3: 'dbrow@15kg' },
      // Cycle 2: each exercise has had one implicit pass
      { i: 4, day: 'Day 1', t1: 'squat@65kg s0', t2: 'bench@28.5kg s0', t3: 'latpulldown@30kg' },
      { i: 5, day: 'Day 2', t1: 'ohp@27.5kg s0', t2: 'deadlift@57kg s0', t3: 'dbrow@15kg' },
      { i: 6, day: 'Day 3', t1: 'bench@42.5kg s0', t2: 'squat@44kg s0', t3: 'latpulldown@30kg' },
      { i: 7, day: 'Day 4', t1: 'deadlift@85kg s0', t2: 'ohp@19kg s0', t3: 'dbrow@15kg' },
    ]);
  });

  it('should compute correct T2 start weights as 65% rounded to 0.5', () => {
    const rows = computeProgram(DEFAULT_WEIGHTS, {});
    // Day 1 T2=bench: 40*0.65=26
    expect(rows[0].t2Weight).toBe(round(DEFAULT_WEIGHTS.bench * 0.65));
    // Day 2 T2=deadlift: 80*0.65=52
    expect(rows[1].t2Weight).toBe(round(DEFAULT_WEIGHTS.deadlift * 0.65));
    // Day 3 T2=squat: 60*0.65=39
    expect(rows[2].t2Weight).toBe(round(DEFAULT_WEIGHTS.squat * 0.65));
    // Day 4 T2=ohp: 25*0.65=16.25→16.5
    expect(rows[3].t2Weight).toBe(round(DEFAULT_WEIGHTS.ohp * 0.65));
  });
});

// ---------------------------------------------------------------------------
// T1 progression: full cycle through all 3 stages + deload
// ---------------------------------------------------------------------------
describe('computeProgram: T1 progression lifecycle', () => {
  it('should advance through stages on failure and deload after stage 2', () => {
    // Squat T1 appears at indexes: 0, 4, 8, 12, 16, ...
    const results = buildResults([
      [0, { t1: 'fail' }], // stage 0 → advance to stage 1
      [4, { t1: 'fail' }], // stage 1 → advance to stage 2
      [8, { t1: 'fail' }], // stage 2 → deload 10%, reset to stage 0
    ]);
    const rows = computeProgram(DEFAULT_WEIGHTS, results);

    // After first fail: stage 1, same weight
    expect(rows[4].t1Stage).toBe(1);
    expect(rows[4].t1Weight).toBe(60);
    expect(rows[4].t1Sets).toBe(6);
    expect(rows[4].t1Reps).toBe(2);

    // After second fail: stage 2, same weight
    expect(rows[8].t1Stage).toBe(2);
    expect(rows[8].t1Weight).toBe(60);
    expect(rows[8].t1Sets).toBe(10);
    expect(rows[8].t1Reps).toBe(1);

    // After third fail (stage 2): reset to stage 0, weight * 0.9
    expect(rows[12].t1Stage).toBe(0);
    expect(rows[12].t1Weight).toBe(round(60 * 0.9)); // 54
    expect(rows[12].t1Sets).toBe(5);
    expect(rows[12].t1Reps).toBe(3);
  });

  it('should increase weight on success regardless of stage', () => {
    const results = buildResults([
      [0, { t1: 'fail' }], // advance to stage 1
      [4, { t1: 'success' }], // success at stage 1 → weight += 5, stays stage 1
    ]);
    const rows = computeProgram(DEFAULT_WEIGHTS, results);

    // After success at stage 1: weight increases, stage stays
    expect(rows[8].t1Weight).toBe(65);
  });

  it('should use 2.5kg increment for bench and ohp T1', () => {
    const results = buildResults([
      [1, { t1: 'success' }], // OHP at index 1
      [2, { t1: 'success' }], // Bench at index 2
    ]);
    const rows = computeProgram(DEFAULT_WEIGHTS, results);

    // OHP T1 next at index 5: 25 + 2.5 = 27.5
    expect(rows[5].t1Weight).toBe(27.5);
    // Bench T1 next at index 6: 40 + 2.5 = 42.5
    expect(rows[6].t1Weight).toBe(42.5);
  });

  it('should use 5kg increment for squat and deadlift T1', () => {
    const results = buildResults([
      [0, { t1: 'success' }], // Squat at index 0
      [3, { t1: 'success' }], // Deadlift at index 3
    ]);
    const rows = computeProgram(DEFAULT_WEIGHTS, results);

    expect(rows[4].t1Weight).toBe(65); // squat: 60 + 5
    expect(rows[7].t1Weight).toBe(85); // deadlift: 80 + 5
  });
});

// ---------------------------------------------------------------------------
// T2 progression: stages + reset with +15kg
// ---------------------------------------------------------------------------
describe('computeProgram: T2 progression lifecycle', () => {
  it('should advance through stages on failure and add 15 + reset after stage 2', () => {
    // Bench T2 appears at indexes: 0, 4, 8, 12, ...
    const baseT2 = round(DEFAULT_WEIGHTS.bench * 0.65); // 26
    const results = buildResults([
      [0, { t2: 'fail' }],
      [4, { t2: 'fail' }],
      [8, { t2: 'fail' }],
    ]);
    const rows = computeProgram(DEFAULT_WEIGHTS, results);

    expect(rows[4].t2Stage).toBe(1);
    expect(rows[4].t2Weight).toBe(baseT2);

    expect(rows[8].t2Stage).toBe(2);
    expect(rows[8].t2Weight).toBe(baseT2);

    // After stage 2 fail: +15, reset to stage 0
    expect(rows[12].t2Stage).toBe(0);
    expect(rows[12].t2Weight).toBe(baseT2 + 15);
  });
});

// ---------------------------------------------------------------------------
// T3 progression: success only
// ---------------------------------------------------------------------------
describe('computeProgram: T3 progression', () => {
  it('should increase T3 by 2.5 on success, no change on fail', () => {
    // Latpulldown T3 at indexes: 0, 2, 4, 6, ...
    const results = buildResults([
      [0, { t3: 'success' }],
      [2, { t3: 'fail' }],
      [4, { t3: 'success' }],
    ]);
    const rows = computeProgram(DEFAULT_WEIGHTS, results);

    expect(rows[0].t3Weight).toBe(30); // initial
    expect(rows[2].t3Weight).toBe(32.5); // after success at 0
    expect(rows[4].t3Weight).toBe(32.5); // no change after fail at 2
    expect(rows[6].t3Weight).toBe(35); // after success at 4
  });
});

// ---------------------------------------------------------------------------
// Full program snapshot: all 90 successes
// ---------------------------------------------------------------------------
describe('computeProgram: full 90 workouts all success', () => {
  it('should produce strictly increasing T1 weights for each exercise', () => {
    const results = buildSuccessfulResults(90);
    const rows = computeProgram(DEFAULT_WEIGHTS, results);

    // Group by exercise and verify monotonic increase
    for (const exercise of ['squat', 'bench', 'deadlift', 'ohp']) {
      const exerciseRows = rows.filter((r) => r.t1Exercise === exercise);
      for (let i = 1; i < exerciseRows.length; i++) {
        expect(exerciseRows[i].t1Weight).toBeGreaterThan(exerciseRows[i - 1].t1Weight);
      }
    }
  });

  it('should produce strictly increasing T2 weights for each exercise', () => {
    const results = buildSuccessfulResults(90);
    const rows = computeProgram(DEFAULT_WEIGHTS, results);

    for (const exercise of ['squat', 'bench', 'deadlift', 'ohp']) {
      const exerciseRows = rows.filter((r) => r.t2Exercise === exercise);
      for (let i = 1; i < exerciseRows.length; i++) {
        expect(exerciseRows[i].t2Weight).toBeGreaterThan(exerciseRows[i - 1].t2Weight);
      }
    }
  });

  it('should produce correct final T1 weights after 90 all-success workouts', () => {
    const results = buildSuccessfulResults(90);
    const rows = computeProgram(DEFAULT_WEIGHTS, results);

    // Each T1 exercise appears every 4 workouts, but each exercise appears once per cycle as T1
    // Squat T1: Day 1 (0,4,8,...) → appears at indexes 0,4,8,...,88 → ceil(90/4) appearances
    // Actually: squat T1 on Day 1 only, so indexes 0,4,8,12,...,88 → 23 appearances
    // After 23 successes starting at 60kg with +5 each: 60 + 22*5 = 170
    // Wait — index 0 is the first appearance at 60, then after success it goes to 65 at index 4
    // So at index 88 (23rd appearance): weight = 60 + 22*5 = 170
    const lastSquatT1 = rows.filter((r) => r.t1Exercise === 'squat').pop();
    expect(lastSquatT1?.t1Weight).toBe(60 + 22 * 5); // 170
  });

  it('should keep all stages at 0 when there are no failures', () => {
    const results = buildSuccessfulResults(90);
    const rows = computeProgram(DEFAULT_WEIGHTS, results);
    for (const row of rows) {
      expect(row.t1Stage).toBe(0);
      expect(row.t2Stage).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Mixed scenario: alternating success/fail
// ---------------------------------------------------------------------------
describe('computeProgram: mixed success/fail patterns', () => {
  it('should handle alternating success and fail on T1', () => {
    // Squat T1 at indexes 0, 4, 8, 12, ...
    // success → +5, fail → advance stage, success → +5, fail → advance stage
    const results = buildResults([
      [0, { t1: 'success' }], // 60→65
      [4, { t1: 'fail' }], // 65, advance to stage 1
      [8, { t1: 'success' }], // 65→70
      [12, { t1: 'fail' }], // 70, advance to stage 2
    ]);
    const rows = computeProgram(DEFAULT_WEIGHTS, results);

    expect(rows[4].t1Weight).toBe(65);
    expect(rows[4].t1Stage).toBe(0);

    expect(rows[8].t1Weight).toBe(65);
    expect(rows[8].t1Stage).toBe(1);

    expect(rows[12].t1Weight).toBe(70);
    expect(rows[12].t1Stage).toBe(1); // success resets?

    // After fail at 12 (stage 1): advance to stage 2
    expect(rows[16].t1Stage).toBe(2);
    expect(rows[16].t1Weight).toBe(70);
  });

  it('should handle multiple deload cycles', () => {
    // Fail all squat T1s: stage 0→1→2→deload, repeat
    const results: Results = {};
    for (let i = 0; i < 90; i += 4) {
      results[i] = { t1: 'fail' }; // All squat T1 fail
    }
    const rows = computeProgram(DEFAULT_WEIGHTS, results);

    const squatT1 = rows.filter((r) => r.t1Exercise === 'squat');

    // First cycle: 60 → fail s0, fail s1, fail s2 → deload to round(60*0.9) = 54
    expect(squatT1[0].t1Weight).toBe(60);
    expect(squatT1[0].t1Stage).toBe(0);
    expect(squatT1[3].t1Stage).toBe(0); // After stage 2 fail: reset
    expect(squatT1[3].t1Weight).toBe(round(60 * 0.9)); // 54

    // Second deload: round(54*0.9) = round(48.6) = 48.5
    expect(squatT1[6].t1Weight).toBe(round(round(60 * 0.9) * 0.9));
  });

  it('should preserve AMRAP reps in result passthrough', () => {
    const results = buildResults([[0, { t1: 'success', t1Reps: 8, t3: 'success', t3Reps: 30 }]]);
    const rows = computeProgram(DEFAULT_WEIGHTS, results);

    expect(rows[0].result.t1Reps).toBe(8);
    expect(rows[0].result.t3Reps).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// isChanged flag
// ---------------------------------------------------------------------------
describe('computeProgram: isChanged tracking', () => {
  it('should mark isChanged=true after a T1 failure changes state', () => {
    const results = buildResults([[0, { t1: 'fail' }]]);
    const rows = computeProgram(DEFAULT_WEIGHTS, results);

    // Squat T1 failed at index 0, so next squat appearance should be marked
    expect(rows[0].isChanged).toBe(false); // Before fail, not yet changed
    expect(rows[4].isChanged).toBe(true); // After fail, squat is changed
  });

  it('should not mark isChanged for exercises unaffected by failures', () => {
    const results = buildResults([[0, { t1: 'fail' }]]); // Only squat fails
    const rows = computeProgram(DEFAULT_WEIGHTS, results);

    // OHP on Day 2 should not be affected
    expect(rows[1].isChanged).toBe(false);
    // Bench on Day 3 should not be affected
    expect(rows[2].isChanged).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Edge case: minimum weights
// ---------------------------------------------------------------------------
describe('computeProgram: edge cases', () => {
  it('should handle minimum start weights (2.5 for all)', () => {
    const minWeights: StartWeights = {
      squat: 2.5,
      bench: 2.5,
      deadlift: 2.5,
      ohp: 2.5,
      latpulldown: 2.5,
      dbrow: 2.5,
    };
    const rows = computeProgram(minWeights, {});
    expect(rows).toHaveLength(90);
    expect(rows[0].t1Weight).toBe(2.5);
    // T2 weight: round(2.5 * 0.65) = round(1.625) = 1.5
    expect(rows[0].t2Weight).toBe(round(2.5 * 0.65));
  });

  it('should handle empty results object', () => {
    const rows = computeProgram(DEFAULT_WEIGHTS, {});
    expect(rows).toHaveLength(90);
  });

  it('should handle results beyond workout range gracefully', () => {
    const results: Results = { 99: { t1: 'success' } };
    // Index 99 is beyond TOTAL_WORKOUTS, should be ignored
    const rows = computeProgram(DEFAULT_WEIGHTS, results);
    expect(rows).toHaveLength(90);
  });
});
