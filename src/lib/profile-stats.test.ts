import { describe, it, expect } from 'bun:test';
import { computeProfileData, formatVolume } from './profile-stats';
import { DEFAULT_WEIGHTS, buildResults, buildSuccessfulResults } from '../../test/helpers/fixtures';

// ---------------------------------------------------------------------------
// computeProfileData — full integration through computeProgram
// ---------------------------------------------------------------------------
describe('computeProfileData', () => {
  describe('with no results', () => {
    it('should return empty profile data', () => {
      const profile = computeProfileData(DEFAULT_WEIGHTS, {});

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
      const profile = computeProfileData(DEFAULT_WEIGHTS, {});

      for (const pr of profile.personalRecords) {
        expect(pr.workoutIndex).toBe(-1);
        expect(pr.weight).toBe(DEFAULT_WEIGHTS[pr.exercise as keyof typeof DEFAULT_WEIGHTS]);
      }
    });
  });

  describe('personal records', () => {
    it('should track highest successful weight for each T1 exercise', () => {
      const results = buildSuccessfulResults(8); // 2 full cycles
      const profile = computeProfileData(DEFAULT_WEIGHTS, results);

      const squatPR = profile.personalRecords.find((pr) => pr.exercise === 'squat');
      // Squat: success at index 0 (60kg) and index 4 (65kg)
      expect(squatPR?.weight).toBe(65);
      expect(squatPR?.workoutIndex).toBe(4);
    });

    it('should include display names', () => {
      const profile = computeProfileData(DEFAULT_WEIGHTS, buildSuccessfulResults(4));
      const squatPR = profile.personalRecords.find((pr) => pr.exercise === 'squat');
      expect(squatPR?.displayName).toBe('Squat');
    });
  });

  describe('streaks', () => {
    it('should count consecutive fully-completed workouts', () => {
      // First 4 workouts fully completed
      const results = buildResults([
        [0, { t1: 'success', t2: 'success', t3: 'success' }],
        [1, { t1: 'success', t2: 'success', t3: 'success' }],
        [2, { t1: 'success', t2: 'success', t3: 'success' }],
        [3, { t1: 'success', t2: 'success', t3: 'success' }],
      ]);
      const profile = computeProfileData(DEFAULT_WEIGHTS, results);

      expect(profile.streak.current).toBe(4);
      expect(profile.streak.longest).toBe(4);
    });

    it('should break streak on partial completion', () => {
      const results = buildResults([
        [0, { t1: 'success', t2: 'success', t3: 'success' }],
        [1, { t1: 'success' }], // partial — only T1 marked
        [2, { t1: 'success', t2: 'success', t3: 'success' }],
      ]);
      const profile = computeProfileData(DEFAULT_WEIGHTS, results);

      // Streak broke at index 1 (partial), resumed at index 2
      expect(profile.streak.longest).toBe(1);
    });

    it('should track longest streak separately from current', () => {
      const results = buildResults([
        [0, { t1: 'success', t2: 'success', t3: 'success' }],
        [1, { t1: 'success', t2: 'success', t3: 'success' }],
        [2, { t1: 'success', t2: 'success', t3: 'success' }],
        [3, { t1: 'success' }], // breaks streak
        [4, { t1: 'success', t2: 'success', t3: 'success' }],
      ]);
      const profile = computeProfileData(DEFAULT_WEIGHTS, results);

      expect(profile.streak.longest).toBe(3);
      expect(profile.streak.current).toBe(1);
    });
  });

  describe('volume', () => {
    it('should calculate total volume from completed workouts', () => {
      const results = buildResults([[0, { t1: 'success', t2: 'success', t3: 'success' }]]);
      const profile = computeProfileData(DEFAULT_WEIGHTS, results);

      // Volume > 0 when workouts are completed
      expect(profile.volume.totalVolume).toBeGreaterThan(0);
      expect(profile.volume.totalSets).toBeGreaterThan(0);
      expect(profile.volume.totalReps).toBeGreaterThan(0);
    });

    it('should include AMRAP reps in volume calculation', () => {
      const withDefault = buildResults([[0, { t1: 'success', t2: 'success', t3: 'success' }]]);
      const withHighAmrap = buildResults([
        [0, { t1: 'success', t1Reps: 15, t2: 'success', t3: 'success', t3Reps: 40 }],
      ]);

      const defaultProfile = computeProfileData(DEFAULT_WEIGHTS, withDefault);
      const amrapProfile = computeProfileData(DEFAULT_WEIGHTS, withHighAmrap);

      // Higher AMRAP reps should produce more volume
      expect(amrapProfile.volume.totalVolume).toBeGreaterThan(defaultProfile.volume.totalVolume);
    });
  });

  describe('completion stats', () => {
    it('should calculate completion percentage', () => {
      const results = buildSuccessfulResults(45); // Half the program
      const profile = computeProfileData(DEFAULT_WEIGHTS, results);

      expect(profile.completion.workoutsCompleted).toBe(45);
      expect(profile.completion.completionPct).toBe(50);
    });

    it('should calculate overall success rate across all tiers', () => {
      const results = buildResults([
        [0, { t1: 'success', t2: 'success', t3: 'fail' }], // 2/3 success
        [1, { t1: 'fail', t2: 'success', t3: 'success' }], // 2/3 success
      ]);
      const profile = computeProfileData(DEFAULT_WEIGHTS, results);

      // 4 successes out of 6 marks = 67%
      expect(profile.completion.overallSuccessRate).toBe(67);
    });

    it('should sum weight gained across all T1 exercises', () => {
      const results = buildSuccessfulResults(8); // 2 cycles
      const profile = computeProfileData(DEFAULT_WEIGHTS, results);

      // Each T1 exercise had 2 successes, gaining their increment amount each time
      // squat: +5, bench: +2.5, ohp: +2.5, deadlift: +5 (only 1 success for dl in 8 workouts)
      expect(profile.completion.totalWeightGained).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// formatVolume — locale-aware formatting
// ---------------------------------------------------------------------------
describe('formatVolume', () => {
  it('should strip fractional digits', () => {
    // formatVolume uses toLocaleString with maximumFractionDigits: 0
    // The exact output is locale-dependent (e.g. "12,346" or "12.346")
    // but the digits "12346" (rounded from 12345.6) should be present
    const formatted = formatVolume(12345.6);
    const digitsOnly = formatted.replace(/\D/g, '');
    expect(digitsOnly).toBe('12346');
  });

  it('should format zero', () => {
    expect(formatVolume(0)).toBe('0');
  });
});
