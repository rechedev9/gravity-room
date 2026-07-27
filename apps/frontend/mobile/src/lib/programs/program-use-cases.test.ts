import type { GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';

import { deleteProgram, manageProgram, startPresetProgram } from './program-use-cases';

const DEFINITION = {
  id: 'gzclp',
  name: 'GZCLP',
  description: 'Linear progression',
  author: 'Gravity Room',
  version: 1,
  category: 'strength',
  source: 'preset',
  days: [
    {
      name: 'Day 1',
      slots: [
        {
          id: 'squat-t1',
          exerciseId: 'squat',
          tier: 'T1',
          stages: [{ sets: 5, reps: 3 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'squat',
        },
      ],
    },
  ],
  cycleLength: 1,
  totalWorkouts: 12,
  workoutsPerWeek: 3,
  exercises: { squat: { name: 'Squat' } },
  configFields: [{ key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 }],
  weightIncrements: { T1: 2.5 },
} satisfies ProgramDefinition;

const DETAIL = {
  id: '11111111-1111-4111-8111-111111111111',
  programId: 'gzclp',
  name: 'GZCLP',
  config: { squat: 20 },
  metadata: null,
  results: {},
  undoHistory: [],
  resultTimestamps: {},
  completedDates: {},
  definitionId: null,
  customDefinition: null,
  status: 'active',
  createdAt: '2026-07-27T10:00:00.000Z',
  updatedAt: '2026-07-27T10:00:00.000Z',
} satisfies GenericProgramDetail;

const SUMMARY = {
  id: DETAIL.id,
  programId: DETAIL.programId,
  title: DETAIL.name,
  status: 'active',
  createdAt: DETAIL.createdAt,
  updatedAt: DETAIL.updatedAt,
} as const;

describe('program use cases', () => {
  it('creates remotely, refreshes server truth and commits one local bundle', async () => {
    const calls: string[] = [];
    const createRemote = jest.fn(async () => {
      calls.push('remote:create');
      return DETAIL;
    });
    const fetchRemotePrograms = jest.fn(async () => {
      calls.push('remote:list');
      return [SUMMARY];
    });
    const cacheCreated = jest.fn(async () => {
      calls.push('local:bundle');
    });

    await expect(
      startPresetProgram(
        {
          ownerUserId: 'user-a',
          definition: DEFINITION,
          name: 'GZCLP',
          config: { squat: 20 },
        },
        { createRemote, fetchRemotePrograms, cacheCreated }
      )
    ).resolves.toEqual(DETAIL);

    expect(calls).toEqual(['remote:create', 'remote:list', 'local:bundle']);
    expect(cacheCreated).toHaveBeenCalledWith({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [SUMMARY],
    });
  });

  it('does not mutate local state when online creation fails', async () => {
    const cacheCreated = jest.fn(async () => undefined);

    await expect(
      startPresetProgram(
        {
          ownerUserId: 'user-a',
          definition: DEFINITION,
          name: 'GZCLP',
          config: { squat: 20 },
        },
        {
          createRemote: jest.fn(async () => {
            throw new Error('offline');
          }),
          fetchRemotePrograms: jest.fn(async () => [SUMMARY]),
          cacheCreated,
        }
      )
    ).rejects.toThrow('offline');

    expect(cacheCreated).not.toHaveBeenCalled();
  });

  it('does not repeat a successful non-idempotent POST when the list refresh fails', async () => {
    const createRemote = jest.fn(async () => DETAIL);
    const cacheCreated = jest.fn(async () => undefined);

    await expect(
      startPresetProgram(
        {
          ownerUserId: 'user-a',
          definition: DEFINITION,
          name: 'GZCLP',
          config: { squat: 20 },
        },
        {
          createRemote,
          fetchRemotePrograms: jest.fn(async () => {
            throw new Error('refresh failed after create');
          }),
          cacheCreated,
        }
      )
    ).resolves.toEqual(DETAIL);

    expect(createRemote).toHaveBeenCalledTimes(1);
    expect(cacheCreated).toHaveBeenCalledWith({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: null,
    });
  });

  it('keeps the previous coherent cache when a post-server local transaction rolls back', async () => {
    const updateRemote = jest.fn(async () => ({ ...DETAIL, status: 'archived' }));
    const cacheManaged = jest.fn(async () => {
      throw new Error('transaction rolled back');
    });

    await expect(
      manageProgram(
        {
          ownerUserId: 'user-a',
          programInstanceId: DETAIL.id,
          mutation: { type: 'set_status', status: 'archived' },
        },
        { updateRemote, cacheManaged }
      )
    ).rejects.toThrow('transaction rolled back');

    expect(updateRemote).toHaveBeenCalledTimes(1);
    expect(cacheManaged).toHaveBeenCalledTimes(1);
  });

  it('never cleans local program data before remote deletion succeeds', async () => {
    const order: string[] = [];
    const deleteRemote = jest.fn(async () => {
      order.push('remote');
    });
    const deleteLocal = jest.fn(async () => {
      order.push('local');
    });

    await deleteProgram(
      { ownerUserId: 'user-a', programInstanceId: DETAIL.id },
      { deleteRemote, deleteLocal }
    );
    expect(order).toEqual(['remote', 'local']);

    deleteRemote.mockRejectedValueOnce(new Error('server rejected'));
    await expect(
      deleteProgram(
        { ownerUserId: 'user-a', programInstanceId: DETAIL.id },
        { deleteRemote, deleteLocal }
      )
    ).rejects.toThrow('server rejected');
    expect(deleteLocal).toHaveBeenCalledTimes(1);
  });
});
