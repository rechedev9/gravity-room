import { describe, expect, it } from 'vitest';
import { computeRecommendationPerExercise } from './pipelines/recommendation';
import { computeSummaryPerExercise } from './pipelines/summary';
import { seriesKeyResolver, type WorkoutRecord } from './record';

function record(overrides: Partial<WorkoutRecord> & Pick<WorkoutRecord, 'tier' | 'weight'>) {
  const base: WorkoutRecord = {
    userId: 'u1',
    instanceId: 'i1',
    programId: 'gzclp',
    workoutIndex: 0,
    exerciseId: 'squat',
    definitionVersion: 1,
    tier: 't1',
    seriesKey: 'squat',
    weight: 0,
    result: 'success',
    rpe: null,
    amrapReps: 5,
    recordedAt: null,
  };
  return { ...base, ...overrides };
}

/** Squat T1 at 100 kg and T2 at 60 kg, alternating, with the T2 set logged last. */
function mixedTiers(): WorkoutRecord[] {
  const records: WorkoutRecord[] = [];
  for (let i = 0; i < 4; i++) {
    const day = `2026-01-0${i + 1}T10:00:00Z`;
    records.push(
      record({
        workoutIndex: i * 2,
        tier: 't1',
        seriesKey: 'squat:t1',
        weight: 100,
        recordedAt: day,
      })
    );
    records.push(
      record({
        workoutIndex: i * 2 + 1,
        tier: 't2',
        seriesKey: 'squat:t2',
        weight: 60,
        recordedAt: `${day.slice(0, 10)}T11:00:00Z`,
      })
    );
  }
  return records;
}

describe('seriesKeyResolver', () => {
  it('keeps the bare exercise id when the lift only ever used one tier', () => {
    const history = [
      { exerciseId: 'squat', tier: 't1' },
      { exerciseId: 'squat', tier: 't1' },
    ];
    expect(history.map(seriesKeyResolver(history))).toEqual(['squat', 'squat']);
  });

  it('adds the tier to every series of a lift trained in several tiers', () => {
    const history = mixedTiers();
    expect(new Set(history.map(seriesKeyResolver(history)))).toEqual(
      new Set(['squat:t1', 'squat:t2'])
    );
  });

  it('keeps the tier of a lift whose other tier is no longer among the insight points', () => {
    const history = [
      { exerciseId: 'squat', tier: 't2' },
      { exerciseId: 'squat', tier: 't1' },
    ];
    const window = [{ exerciseId: 'squat', tier: 't1' }];
    expect(window.map(seriesKeyResolver(history))).toEqual(['squat:t1']);
  });
});

describe('per-tier series', () => {
  it('recommends from each tier current load, not from whichever was logged last', () => {
    const recommendations = computeRecommendationPerExercise(mixedTiers());

    expect(recommendations.get('squat:t1')?.currentWeight).toBe(100);
    expect(recommendations.get('squat:t2')?.currentWeight).toBe(60);
    expect(recommendations.has('squat')).toBe(false);
  });

  it('does not average the two loads into one summary', () => {
    const summaries = computeSummaryPerExercise(mixedTiers());

    expect(summaries.size).toBe(2);
    expect(summaries.get('squat:t1')).toMatchObject({ totalSets: 4, successSets: 4 });
  });
});
