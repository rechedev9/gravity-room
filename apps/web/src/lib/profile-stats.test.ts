import { describe, it, expect } from 'bun:test';
import { computeGenericProgram } from '@gzclp/shared/generic-engine';
import type { GenericResults } from '@gzclp/shared/types/program';
import { computeProfileData, formatVolume } from './profile-stats';
import { GZCLP_DEFINITION_FIXTURE, DEFAULT_WEIGHTS } from '../../test/helpers/fixtures';

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

/** Map day index → slot IDs for GZCLP (4-day rotation). */
const DAY_SLOTS: Record<number, { t1: string; t2: string; t3: string }> = {
  0: { t1: 'd1-t1', t2: 'd1-t2', t3: 'latpulldown-t3' },
  1: { t1: 'd2-t1', t2: 'd2-t2', t3: 'dbrow-t3' },
  2: { t1: 'd3-t1', t2: 'd3-t2', t3: 'latpulldown-t3' },
  3: { t1: 'd4-t1', t2: 'd4-t2', t3: 'dbrow-t3' },
};

/** Build N consecutive all-success workouts in generic format. */
function buildAllSuccessResults(n: number): GenericResults {
  const results: GenericResults = {};
  for (let i = 0; i < n; i++) {
    const dayIdx = i % 4;
    const slots = DAY_SLOTS[dayIdx];
    results[String(i)] = {
      [slots.t1]: { result: 'success' },
      [slots.t2]: { result: 'success' },
      [slots.t3]: { result: 'success' },
    };
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
      const results = buildAllSuccessResults(8); // 2 full cycles
      const rows = computeGenericProgram(DEF, CONFIG, results);
      const profile = computeProfileData(rows, DEF, CONFIG);

      const squatPR = profile.personalRecords.find((pr) => pr.exercise === 'squat');
      // Squat: success at index 0 (60kg) and index 4 (65kg)
      expect(squatPR?.weight).toBe(65);
      expect(squatPR?.workoutIndex).toBe(4);
    });

    it('should include display names', () => {
      const results = buildAllSuccessResults(4);
      const rows = computeGenericProgram(DEF, CONFIG, results);
      const profile = computeProfileData(rows, DEF, CONFIG);
      const squatPR = profile.personalRecords.find((pr) => pr.exercise === 'squat');
      expect(squatPR?.displayName).toBe('Sentadilla');
    });
  });

  describe('streaks', () => {
    it('should count consecutive fully-completed workouts', () => {
      const results = buildAllSuccessResults(4);
      const rows = computeGenericProgram(DEF, CONFIG, results);
      const profile = computeProfileData(rows, DEF, CONFIG);

      expect(profile.streak.current).toBe(4);
      expect(profile.streak.longest).toBe(4);
    });

    it('should break streak on partial completion', () => {
      const results = buildGenericResults([
        [
          0,
          {
            'd1-t1': { result: 'success' },
            'd1-t2': { result: 'success' },
            'latpulldown-t3': { result: 'success' },
          },
        ],
        [1, { 'd2-t1': { result: 'success' } }], // partial
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

      expect(profile.streak.longest).toBe(1);
    });

    it('should track longest streak separately from current', () => {
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
        [3, { 'd4-t1': { result: 'success' } }], // breaks streak
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

      expect(profile.streak.longest).toBe(3);
      expect(profile.streak.current).toBe(1);
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
      const results = buildAllSuccessResults(45);
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
      const results = buildAllSuccessResults(8);
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
  it('should use comma as thousands separator regardless of locale', () => {
    expect(formatVolume(75264)).toBe('75,264');
  });

  it('should strip fractional digits', () => {
    expect(formatVolume(12345.6)).toBe('12,346');
  });

  it('should format zero', () => {
    expect(formatVolume(0)).toBe('0');
  });
});
