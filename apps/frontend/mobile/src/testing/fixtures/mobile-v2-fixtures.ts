import type { GenericProgramDetail, GenericResults, ProgramDefinition } from '@gzclp/domain';

import type { QueuedMutation } from '../../lib/sync/mutation-queue-repository';

export interface MobileDatabaseFixture {
  readonly userVersion: number;
  readonly tables: readonly string[];
}

const V1_TABLES = [
  'program_summaries',
  'queued_mutations',
  'program_details',
  'program_definitions',
] as const;

export const EMPTY_DATABASE_FIXTURE = {
  userVersion: 0,
  tables: [],
} satisfies MobileDatabaseFixture;

export const LEGACY_UNVERSIONED_DATABASE_FIXTURE = {
  userVersion: 0,
  tables: V1_TABLES,
} satisfies MobileDatabaseFixture;

export const V1_DATABASE_FIXTURE = {
  userVersion: 1,
  tables: V1_TABLES,
} satisfies MobileDatabaseFixture;

export const CANONICAL_PROGRAM_DEFINITION = {
  id: 'mobile-v2-baseline',
  name: 'Mobile v2 baseline',
  description: 'Small deterministic program used by mobile contract tests.',
  author: 'Gravity Room',
  version: 1,
  category: 'strength',
  source: 'preset',
  days: [
    {
      name: 'Day A',
      slots: [
        {
          id: 'squat-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [{ sets: 3, reps: 5, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'squat',
        },
      ],
    },
  ],
  cycleLength: 1,
  totalWorkouts: 12,
  workoutsPerWeek: 3,
  exercises: {
    squat: { name: 'Back squat' },
  },
  configFields: [
    {
      key: 'squat',
      label: 'Back squat',
      type: 'weight',
      min: 20,
      step: 2.5,
    },
  ],
  weightIncrements: {
    squat: 5,
  },
} satisfies ProgramDefinition;

export const CANONICAL_WORKOUT_RESULTS = {
  '0': {
    'squat-t1': {
      result: 'success',
      amrapReps: 7,
      rpe: 8,
      setLogs: [
        { reps: 5, weight: 60 },
        { reps: 5, weight: 60 },
        { reps: 7, weight: 60, rpe: 8 },
      ],
    },
  },
} satisfies GenericResults;

export const CANONICAL_PROGRAM_DETAIL = {
  id: 'mobile-instance-1',
  programId: CANONICAL_PROGRAM_DEFINITION.id,
  name: 'Mobile v2 baseline',
  config: {
    squat: 60,
  },
  metadata: null,
  results: CANONICAL_WORKOUT_RESULTS,
  undoHistory: [],
  resultTimestamps: {
    '0:squat-t1': '2026-07-27T08:15:00.000Z',
  },
  completedDates: {
    '0': '2026-07-27T08:15:00.000Z',
  },
  definitionId: CANONICAL_PROGRAM_DEFINITION.id,
  customDefinition: null,
  status: 'active',
  createdAt: '2026-07-27T08:00:00.000Z',
  updatedAt: '2026-07-27T08:15:00.000Z',
} satisfies GenericProgramDetail;

export const CANONICAL_QUEUED_MUTATION = {
  id: 1,
  entityType: 'program-instance',
  entityId: CANONICAL_PROGRAM_DETAIL.id,
  operation: 'record-result',
  payload: {
    workoutIndex: 0,
    slotId: 'squat-t1',
    result: 'success',
    amrapReps: 7,
    rpe: 8,
    setLogs: CANONICAL_WORKOUT_RESULTS['0']['squat-t1'].setLogs,
  },
  createdAt: '2026-07-27T08:15:00.000Z',
} satisfies QueuedMutation;
