import { describe, it, expect } from 'bun:test';
import { computeGenericProgram } from '@gzclp/shared/generic-engine';
import type { GenericResults } from '@gzclp/shared/types/program';
import { computeProfileData, compute1RMData, formatVolume } from './profile-stats';
import {
  GZCLP_DEFINITION_FIXTURE,
  DEFAULT_WEIGHTS,
  buildGenericSuccessResults,
} from '../../test/helpers/fixtures';

const DEF = GZCLP_DEFINITION_FIXTURE;
const CONFIG = DEFAULT_WEIGHTS as Record<string, number>;

/** Build generic results from an array of [workoutIndex, slotResults] tuples. */
function buildGenericResults(
  entries: Array<[number, Record<string, { result?: 'success' | 'fail'; amrapReps?: number }>]>
): GenericResults {
  const results: GenericResults = {};
  for (const [index, slots] of entries) {
    results[String(index)] = slots;
  }
  return results;
}

// ---------------------------------------------------------------------------
// computeProfileData — full integration through computeGenericProgram
// ---------------------------------------------------------------------------
describe('computeProfileData', () => {
  describe('with no results', () => {
    it('should return empty profile data', () => {
      const rows = computeGenericProgram(DEF, CONFIG, {});
      const profile = computeProfileData(rows, DEF, CONFIG);

      expect(profile.completion.workoutsCompleted).toBe(0);
      expect(profile.completion.totalWorkouts).toBe(90);
      expect(profile.completion.completionPct).toBe(0);
      expect(profile.completion.overallSuccessRate).toBe(0);
      expect(profile.completion.totalWeightGained).toBe(0);

      expect(profile.streak.current).toBe(0);
      expect(profile.streak.longest).toBe(0);

      expect(profile.volume.totalVolume).toBe(0);
      expect(profile.volume.totalSets).toBe(0);
      expect(profile.volume.totalReps).toBe(0);
    });

    it('should return start weights as PRs with workoutIndex -1', () => {
      const rows = computeGenericProgram(DEF, CONFIG, {});
      const profile = computeProfileData(rows, DEF, CONFIG);

      for (const pr of profile.personalRecords) {
        expect(pr.workoutIndex).toBe(-1);
        expect(pr.weight).toBe(CONFIG[pr.exercise] ?? 0);
      }
    });

    it('should include startWeight on every PR matching the starting weights', () => {
      const rows = computeGenericProgram(DEF, CONFIG, {});
      const profile = computeProfileData(rows, DEF, CONFIG);

      for (const pr of profile.personalRecords) {
        expect(pr.startWeight).toBe(CONFIG[pr.exercise] ?? 0);
      }
    });
  });

  describe('personal records', () => {
    it('should track highest successful weight for each primary exercise', () => {
      const results = buildGenericSuccessResults(8); // 2 full cycles
      const rows = computeGenericProgram(DEF, CONFIG, results);
      const profile = computeProfileData(rows, DEF, CONFIG);

      const squatPR = profile.personalRecords.find((pr) => pr.exercise === 'squat');
      // Squat: success at index 0 (60kg) and index 4 (65kg)
      expect(squatPR?.weight).toBe(65);
      expect(squatPR?.workoutIndex).toBe(4);
    });

    it('should include display names', () => {
      const results = buildGenericSuccessResults(4);
      const rows = computeGenericProgram(DEF, CONFIG, results);
      const profile = computeProfileData(rows, DEF, CONFIG);
      const squatPR = profile.personalRecords.find((pr) => pr.exercise === 'squat');
      expect(squatPR?.displayName).toBe('Sentadilla');
    });
  });

  describe('streaks', () => {
    it('should count consecutive fully-completed workouts', () => {
      const results = buildGenericSuccessResults(4);
      const rows = computeGenericProgram(DEF, CONFIG, results);
      const profile = computeProfileData(rows, DEF, CONFIG);

      expect(profile.streak.current).toBe(4);
      expect(profile.streak.longest).toBe(4);
    });

    it('should treat partial workouts as streak-neutral', () => {
      const results = buildGenericResults([
        [
          0,
          {
            'd1-t1': { result: 'success' },
            'd1-t2': { result: 'success' },
            'latpulldown-t3': { result: 'success' },
          },
        ],
        [1, { 'd2-t1': { result: 'success' } }], // partial — streak-neutral
        [
          2,
          {
            'd3-t1': { result: 'success' },
            'd3-t2': { result: 'success' },
            'latpulldown-t3': { result: 'success' },
          },
        ],
      ]);
      const rows = computeGenericProgram(DEF, CONFIG, results);
      const profile = computeProfileData(rows, DEF, CONFIG);

      // Partial workout does not break or reset the streak
      expect(profile.streak.longest).toBe(2);
      expect(profile.streak.current).toBe(2);
    });

    it('should continue streak through partial workouts', () => {
      // Partial workout (marks > 0 but not complete) should not break the streak.
      // Workouts 0-2 complete, workout 3 partial (1/3 slots), workout 4 complete.
      const results = buildGenericResults([
        [
          0,
          {
            'd1-t1': { result: 'success' },
            'd1-t2': { result: 'success' },
            'latpulldown-t3': { result: 'success' },
          },
        ],
        [
          1,
          {
            'd2-t1': { result: 'success' },
            'd2-t2': { result: 'success' },
            'dbrow-t3': { result: 'success' },
          },
        ],
        [
          2,
          {
            'd3-t1': { result: 'success' },
            'd3-t2': { result: 'success' },
            'latpulldown-t3': { result: 'success' },
          },
        ],
        [3, { 'd4-t1': { result: 'success' } }], // partial — streak-neutral
        [
          4,
          {
            'd1-t1': { result: 'success' },
            'd1-t2': { result: 'success' },
            'latpulldown-t3': { result: 'success' },
          },
        ],
      ]);
      const rows = computeGenericProgram(DEF, CONFIG, results);
      const profile = computeProfileData(rows, DEF, CONFIG);

      // Streak of 4 completed workouts (0, 1, 2, 4) — partial at 3 is skipped
      expect(profile.streak.longest).toBe(4);
      expect(profile.streak.current).toBe(4);
    });
  });

  describe('volume', () => {
    it('should calculate total volume from completed workouts', () => {
      const results = buildGenericResults([
        [
          0,
          {
            'd1-t1': { result: 'success' },
            'd1-t2': { result: 'success' },
            'latpulldown-t3': { result: 'success' },
          },
        ],
      ]);
      const rows = computeGenericProgram(DEF, CONFIG, results);
      const profile = computeProfileData(rows, DEF, CONFIG);

      expect(profile.volume.totalVolume).toBeGreaterThan(0);
      expect(profile.volume.totalSets).toBeGreaterThan(0);
      expect(profile.volume.totalReps).toBeGreaterThan(0);
    });

    it('should include AMRAP reps in volume calculation', () => {
      const withDefault = buildGenericResults([
        [
          0,
          {
            'd1-t1': { result: 'success' },
            'd1-t2': { result: 'success' },
            'latpulldown-t3': { result: 'success' },
          },
        ],
      ]);
      const withHighAmrap = buildGenericResults([
        [
          0,
          {
            'd1-t1': { result: 'success', amrapReps: 15 },
            'd1-t2': { result: 'success' },
            'latpulldown-t3': { result: 'success', amrapReps: 40 },
          },
        ],
      ]);

      const defaultRows = computeGenericProgram(DEF, CONFIG, withDefault);
      const amrapRows = computeGenericProgram(DEF, CONFIG, withHighAmrap);
      const defaultProfile = computeProfileData(defaultRows, DEF, CONFIG);
      const amrapProfile = computeProfileData(amrapRows, DEF, CONFIG);

      expect(amrapProfile.volume.totalVolume).toBeGreaterThan(defaultProfile.volume.totalVolume);
    });
  });

  describe('completion stats', () => {
    it('should calculate completion percentage', () => {
      const results = buildGenericSuccessResults(45);
      const rows = computeGenericProgram(DEF, CONFIG, results);
      const profile = computeProfileData(rows, DEF, CONFIG);

      expect(profile.completion.workoutsCompleted).toBe(45);
      expect(profile.completion.completionPct).toBe(50);
    });

    it('should calculate overall success rate across all slots', () => {
      const results = buildGenericResults([
        [
          0,
          {
            'd1-t1': { result: 'success' },
            'd1-t2': { result: 'success' },
            'latpulldown-t3': { result: 'fail' },
          },
        ],
        [
          1,
          {
            'd2-t1': { result: 'fail' },
            'd2-t2': { result: 'success' },
            'dbrow-t3': { result: 'success' },
          },
        ],
      ]);
      const rows = computeGenericProgram(DEF, CONFIG, results);
      const profile = computeProfileData(rows, DEF, CONFIG);

      // 4 successes out of 6 marks = 67%
      expect(profile.completion.overallSuccessRate).toBe(67);
    });

    it('should sum weight gained across all primary exercises', () => {
      const results = buildGenericSuccessResults(8);
      const rows = computeGenericProgram(DEF, CONFIG, results);
      const profile = computeProfileData(rows, DEF, CONFIG);

      expect(profile.completion.totalWeightGained).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// formatVolume — locale-aware formatting
// ---------------------------------------------------------------------------
describe('formatVolume', () => {
  it('should use dot as thousands separator (es-ES locale)', () => {
    expect(formatVolume(75264)).toBe('75.264');
  });

  it('should strip fractional digits', () => {
    expect(formatVolume(12345.6)).toBe('12.346');
  });

  it('should format zero', () => {
    expect(formatVolume(0)).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// compute1RMData — Epley 1RM estimation
// ---------------------------------------------------------------------------
describe('compute1RMData', () => {
  it('should return correct 1RM using Epley formula for a single T1 AMRAP exercise', () => {
    // Squat T1 at index 0 (Day 1), 60 kg * (1 + 5/30) = 70 kg
    const results = buildGenericResults([
      [
        0,
        {
          'd1-t1': { result: 'success', amrapReps: 5 },
          'd1-t2': { result: 'success' },
          'latpulldown-t3': { result: 'success' },
        },
      ],
    ]);
    const rows = computeGenericProgram(DEF, CONFIG, results);
    const estimates = compute1RMData(rows, DEF);

    const squat = estimates.find((e) => e.exercise === 'squat');

    // Epley: 60 * (1 + 5/30) = 60 * 1.1667 = 70.0 → rounded to nearest 0.5 = 70.0
    expect(squat).toBeDefined();
    expect(squat?.estimatedKg).toBe(70);
    expect(squat?.sourceWeight).toBe(60);
    expect(squat?.sourceAmrapReps).toBe(5);
  });

  it('should pick highest estimate across multiple workouts (not most recent)', () => {
    // Workout 0: squat 60 kg x 8 AMRAP => 60*(1+8/30) = 76.0
    // Workout 4: squat 65 kg x 3 AMRAP => 65*(1+3/30) = 71.5
    // Should pick workout 0 (higher estimate) even though workout 4 is more recent
    const results = buildGenericResults([
      [
        0,
        {
          'd1-t1': { result: 'success', amrapReps: 8 },
          'd1-t2': { result: 'success' },
          'latpulldown-t3': { result: 'success' },
        },
      ],
      [
        1,
        {
          'd2-t1': { result: 'success' },
          'd2-t2': { result: 'success' },
          'dbrow-t3': { result: 'success' },
        },
      ],
      [
        2,
        {
          'd3-t1': { result: 'success' },
          'd3-t2': { result: 'success' },
          'latpulldown-t3': { result: 'success' },
        },
      ],
      [
        3,
        {
          'd4-t1': { result: 'success' },
          'd4-t2': { result: 'success' },
          'dbrow-t3': { result: 'success' },
        },
      ],
      [
        4,
        {
          'd1-t1': { result: 'success', amrapReps: 3 },
          'd1-t2': { result: 'success' },
          'latpulldown-t3': { result: 'success' },
        },
      ],
    ]);
    const rows = computeGenericProgram(DEF, CONFIG, results);
    const estimates = compute1RMData(rows, DEF);

    const squat = estimates.find((e) => e.exercise === 'squat');

    // 60*(1+8/30)=76.0 > 65*(1+3/30)=71.5 → picks workout 0
    expect(squat).toBeDefined();
    expect(squat?.estimatedKg).toBe(76);
    expect(squat?.workoutIndex).toBe(0);
  });

  it('should return empty array when no qualifying AMRAP exercises exist', () => {
    // All results succeed but no amrapReps provided → no qualifying AMRAP
    const results = buildGenericSuccessResults(4);
    const rows = computeGenericProgram(DEF, CONFIG, results);
    const estimates = compute1RMData(rows, DEF);

    expect(estimates).toEqual([]);
  });

  it('should round to nearest 0.5 kg', () => {
    // OHP T1 at index 1 (Day 2), 25 kg * (1 + 7/30) = 25 * 1.2333 = 30.833...
    // Rounded to nearest 0.5 = 31.0
    const results = buildGenericResults([
      [
        1,
        {
          'd2-t1': { result: 'success', amrapReps: 7 },
          'd2-t2': { result: 'success' },
          'dbrow-t3': { result: 'success' },
        },
      ],
    ]);
    const rows = computeGenericProgram(DEF, CONFIG, results);
    const estimates = compute1RMData(rows, DEF);

    const ohp = estimates.find((e) => e.exercise === 'ohp');

    // 25 * (1 + 7/30) = 30.8333... → round(30.8333/0.5)*0.5 = round(61.6667)*0.5 = 62*0.5 = 31.0
    expect(ohp).toBeDefined();
    expect(ohp?.estimatedKg).toBe(31);
    // Verify it's a multiple of 0.5
    expect(ohp?.estimatedKg ? ohp.estimatedKg % 0.5 : -1).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeMonthlyReport — rolling 30-day window (via computeProfileData)
// ---------------------------------------------------------------------------
describe('computeMonthlyReport', () => {
  it('should use 30-day rolling window based on timestamps', () => {
    const now = new Date();
    const withinWindow = new Date(now);
    withinWindow.setDate(withinWindow.getDate() - 10);
    const outsideWindow = new Date(now);
    outsideWindow.setDate(outsideWindow.getDate() - 40);

    const results = buildGenericResults([
      [
        0,
        {
          'd1-t1': { result: 'success' },
          'd1-t2': { result: 'success' },
          'latpulldown-t3': { result: 'success' },
        },
      ],
      [
        1,
        {
          'd2-t1': { result: 'success' },
          'd2-t2': { result: 'success' },
          'dbrow-t3': { result: 'success' },
        },
      ],
    ]);

    const timestamps: Record<string, string> = {
      '0': outsideWindow.toISOString(), // 40 days ago — outside window
      '1': withinWindow.toISOString(), // 10 days ago — inside window
    };

    const rows = computeGenericProgram(DEF, CONFIG, results);
    const profile = computeProfileData(rows, DEF, CONFIG, timestamps);

    // Only workout 1 falls within the 30-day window
    expect(profile.monthlyReport).not.toBeNull();
    expect(profile.monthlyReport?.workoutsCompleted).toBe(1);
  });

  it('should have monthLabel "Últimos 30 días"', () => {
    const now = new Date();
    const recentDate = new Date(now);
    recentDate.setDate(recentDate.getDate() - 5);

    const results = buildGenericResults([
      [
        0,
        {
          'd1-t1': { result: 'success' },
          'd1-t2': { result: 'success' },
          'latpulldown-t3': { result: 'success' },
        },
      ],
    ]);

    const timestamps: Record<string, string> = {
      '0': recentDate.toISOString(),
    };

    const rows = computeGenericProgram(DEF, CONFIG, results);
    const profile = computeProfileData(rows, DEF, CONFIG, timestamps);

    expect(profile.monthlyReport?.monthLabel).toBe('Últimos 30 días');
  });
});
