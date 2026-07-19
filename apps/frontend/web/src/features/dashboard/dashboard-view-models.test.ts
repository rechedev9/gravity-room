import { describe, it, expect } from 'vitest';
import { computeGenericProgram } from '@gzclp/domain/generic-engine';
import type { ProgramDefinition, GenericResults } from '@gzclp/domain/types/program';
import { computePrRoad } from './use-pr-road';
import {
  buildHeroExtras,
  buildRecentSessions,
  buildLiftHistory,
  buildWorkoutDates,
  findFirstPendingIndex,
} from './dashboard-view-models';

// Two-day program: Squat (T1) on Day A, Bench (T1) on Day B. T1 slots resolve to
// the "primary" role via the engine's tier→role map, which the dashboard keys off.
const DEFINITION: ProgramDefinition = {
  id: 'test-prog',
  name: 'Test Program',
  description: 'Fixture for dashboard view-model tests.',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 2,
  totalWorkouts: 4,
  workoutsPerWeek: 2,
  exercises: {
    squat: { name: 'Squat' },
    bench: { name: 'Bench' },
  },
  configFields: [
    { key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 },
    { key: 'bench', label: 'Bench', type: 'weight', min: 20, step: 2.5 },
  ],
  weightIncrements: { squat: 5, bench: 2.5 },
  days: [
    {
      name: 'Day A',
      slots: [
        {
          id: 'squat-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [{ sets: 3, reps: 5, amrap: false }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'squat',
        },
      ],
    },
    {
      name: 'Day B',
      slots: [
        {
          id: 'bench-t1',
          exerciseId: 'bench',
          tier: 't1',
          stages: [{ sets: 3, reps: 5, amrap: false }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'bench',
        },
      ],
    },
  ],
};

const CONFIG = { squat: 100, bench: 60 };

// Workouts 0 (squat) and 1 (bench) logged as successes; 2 and 3 pending.
const RESULTS: GenericResults = {
  0: { 'squat-t1': { result: 'success' } },
  1: { 'bench-t1': { result: 'success' } },
};

const rows = computeGenericProgram(DEFINITION, CONFIG, RESULTS);

describe('findFirstPendingIndex', () => {
  it('returns the first workout with an unmarked slot', () => {
    expect(findFirstPendingIndex(rows)).toBe(2);
  });

  it('returns -1 when everything is empty', () => {
    expect(findFirstPendingIndex([])).toBe(-1);
  });
});

describe('buildHeroExtras', () => {
  it('returns empty extras when nothing has been logged (pristine state)', () => {
    const pristine = computeGenericProgram(DEFINITION, CONFIG, {});
    expect(buildHeroExtras(pristine, DEFINITION.totalWorkouts)).toEqual({});
  });

  it('surfaces the next pending primary set and workout metadata', () => {
    const hero = buildHeroExtras(rows, DEFINITION.totalWorkouts);
    expect(hero.results && Object.keys(hero.results).length).toBeGreaterThan(0);
    expect(hero.nextSet).toEqual({ weight: 105, reps: 5, label: 'Squat' });
    expect(hero.nextWorkout).toMatchObject({
      dayIndex: 2,
      totalDays: 4,
      weekLabel: 'Day A',
      focusLifts: 'Squat',
    });
  });

  it('reports the most recent successful set with gain since start', () => {
    const hero = buildHeroExtras(rows, DEFINITION.totalWorkouts);
    // Most recent success is bench @ 60kg, its program-start weight - zero gain.
    expect(hero.lastSet).toEqual({ weight: 60, reps: 5, deltaFromStart: 0 });
  });
});

describe('buildRecentSessions', () => {
  it('lists completed workouts most-recent-first', () => {
    const sessions = buildRecentSessions(rows, {});
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({ dayIndex: 2, summary: 'Day B · 1/1' });
    expect(sessions[1]).toMatchObject({ dayIndex: 1, summary: 'Day A · 1/1' });
  });

  it('is empty when no workout is fully completed', () => {
    expect(buildRecentSessions(computeGenericProgram(DEFINITION, CONFIG, {}), {})).toHaveLength(0);
  });
});

describe('buildWorkoutDates', () => {
  it('returns the timestamp of each completed workout, in program order', () => {
    const ts = { '0': '2026-06-24T09:00:00Z', '1': '2026-06-25T09:00:00Z' };
    expect(buildWorkoutDates(rows, ts)).toEqual(['2026-06-24T09:00:00Z', '2026-06-25T09:00:00Z']);
  });

  it('skips completed workouts that have no recorded timestamp', () => {
    expect(buildWorkoutDates(rows, { '0': '2026-06-24T09:00:00Z' })).toEqual([
      '2026-06-24T09:00:00Z',
    ]);
  });

  it('is empty when no workout is fully completed', () => {
    expect(buildWorkoutDates(computeGenericProgram(DEFINITION, CONFIG, {}), {})).toHaveLength(0);
  });
});

describe('buildLiftHistory + computePrRoad', () => {
  it('pairs each primary lift best with its next scheduled attempt', () => {
    const history = buildLiftHistory(rows);
    expect(history).toContainEqual({ lift: 'Squat', weight: 100, prTarget: 105, isPr: false });
    expect(history).toContainEqual({ lift: 'Bench', weight: 60, prTarget: 62.5, isPr: false });
  });

  it('surfaces the lift closest to a new PR', () => {
    const road = computePrRoad(buildLiftHistory(rows));
    expect(road?.lift).toBe('Bench');
    expect(road?.deltaToPr).toBe(2.5);
  });
});
