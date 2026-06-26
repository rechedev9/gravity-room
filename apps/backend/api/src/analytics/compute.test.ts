/**
 * Orchestrator wiring tests for compute.ts.
 *
 * Mocks only the data-access layer (so no real DB is touched) and drives the
 * REAL pipelines with a crafted record set that triggers all seven insight
 * types. Asserts that computeUser maps each pipeline output to the correct
 * insight_type string and the correct null-vs-exercise_id target, matching
 * compute.py's upsert calls.
 *
 * NOTE: this file deliberately does NOT mock the pipeline modules. Bun's
 * `mock.module` registry is process-global and would leak into the sibling
 * pipelines.parity.test.ts; mocking only `./queries` keeps the pipelines real
 * for both files. The returned records are driven by a mutable variable so the
 * single `mock.module` call covers every scenario.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { WorkoutRecord } from './record';

interface UpsertCall {
  userId: string;
  insightType: string;
  exerciseId: string | null;
  payload: unknown;
}

const upsertCalls: UpsertCall[] = [];
let recordsToReturn: WorkoutRecord[] = [];

const MS_PER_DAY = 86_400_000;

/** Eight recent ISO weeks (all inside plateau's 8-week cutoff), two successful
 * sets each, on a rising trend so every pipeline emits. */
function craftedRecords(): WorkoutRecord[] {
  const records: WorkoutRecord[] = [];
  for (let week = 0; week < 8; week++) {
    for (let rep = 0; rep < 2; rep++) {
      const daysAgo = week * 7 + rep;
      records.push({
        userId: 'u1',
        instanceId: 'i1',
        programId: 'p1',
        workoutIndex: week * 2 + rep,
        slotId: 'squat',
        weight: 80 + 2.5 * (7 - week),
        result: 'success',
        rpe: null,
        amrapReps: 5,
        recordedAt: new Date(Date.now() - daysAgo * MS_PER_DAY).toISOString(),
      });
    }
  }
  return records;
}

mock.module('./queries', () => ({
  fetchAllUsers: async () => [{ userId: 'u1' }],
  fetchWorkoutRecords: async () => recordsToReturn,
  upsertInsight: async (
    userId: string,
    insightType: string,
    exerciseId: string | null,
    payload: unknown
  ) => {
    upsertCalls.push({ userId, insightType, exerciseId, payload });
  },
}));

const { computeUser, runAll } = await import('./compute');

describe('computeUser', () => {
  beforeEach(() => {
    upsertCalls.length = 0;
    recordsToReturn = craftedRecords();
  });

  it('upserts all seven insight types with the correct null-vs-exercise target', async () => {
    await computeUser('u1');

    const byType = new Map(upsertCalls.map((c) => [c.insightType, c]));
    const aggregate = ['volume_trend', 'frequency'];
    const perExercise = [
      'e1rm_progression',
      'exercise_summary',
      'plateau_detection',
      'e1rm_forecast',
      'load_recommendation',
    ];

    for (const type of [...aggregate, ...perExercise]) {
      expect(byType.has(type)).toBe(true);
    }
    for (const type of aggregate) {
      expect(byType.get(type)?.exerciseId).toBeNull();
    }
    for (const type of perExercise) {
      expect(byType.get(type)?.exerciseId).toBe('squat');
    }
    expect(upsertCalls.every((c) => c.userId === 'u1')).toBe(true);
  });

  it('emits volume_trend and frequency before any per-exercise insight', async () => {
    await computeUser('u1');
    expect(upsertCalls[0]?.insightType).toBe('volume_trend');
    expect(upsertCalls[1]?.insightType).toBe('frequency');
  });

  it('does nothing for a user with no records', async () => {
    recordsToReturn = [];
    await computeUser('u1');
    expect(upsertCalls).toHaveLength(0);
  });
});

describe('runAll', () => {
  beforeEach(() => {
    upsertCalls.length = 0;
    recordsToReturn = craftedRecords();
  });

  it('processes each user and returns a processed/errors summary', async () => {
    const summary = await runAll();
    expect(summary).toEqual({ processed: 1, errors: 0 });
    expect(upsertCalls.length).toBeGreaterThanOrEqual(7);
  });
});
