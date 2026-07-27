import type { GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';

import {
  RemoteMutationAcknowledgedError,
  RemoteMutationOutcomeUnknownError,
  type DeleteRemoteResult,
} from './program-service';
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
    const scheduleReconciliation = jest.fn(async () => undefined);

    await expect(
      startPresetProgram(
        {
          ownerUserId: 'user-a',
          definition: DEFINITION,
          name: 'GZCLP',
          config: { squat: 20 },
        },
        { createRemote, fetchRemotePrograms, cacheCreated, scheduleReconciliation }
      )
    ).resolves.toEqual({ status: 'applied', remote: DETAIL });

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
    const scheduleReconciliation = jest.fn(async () => undefined);

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
          scheduleReconciliation,
        }
      )
    ).rejects.toThrow('offline');

    expect(cacheCreated).not.toHaveBeenCalled();
  });

  it('does not repeat a successful non-idempotent POST when the list refresh fails', async () => {
    const createRemote = jest.fn(async () => DETAIL);
    const cacheCreated = jest.fn(async () => undefined);
    const scheduleReconciliation = jest.fn(async () => undefined);

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
          scheduleReconciliation,
        }
      )
    ).resolves.toEqual({ status: 'applied', remote: DETAIL });

    expect(createRemote).toHaveBeenCalledTimes(1);
    expect(cacheCreated).toHaveBeenCalledWith({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: null,
    });
  });

  it('returns the remote manage ACK and schedules reconciliation after local rollback', async () => {
    const archivedDetail: GenericProgramDetail = { ...DETAIL, status: 'archived' };
    const updateRemote = jest.fn(async () => archivedDetail);
    const cacheManaged = jest.fn(async () => {
      throw new Error('transaction rolled back');
    });
    const scheduleReconciliation = jest.fn(async () => undefined);

    await expect(
      manageProgram(
        {
          ownerUserId: 'user-a',
          programInstanceId: DETAIL.id,
          mutation: { type: 'set_status', status: 'archived' },
        },
        { updateRemote, cacheManaged, scheduleReconciliation }
      )
    ).resolves.toEqual({
      status: 'reconciliation_required',
      remote: archivedDetail,
      remoteEntityId: archivedDetail.id,
      remoteState: 'acknowledged',
      reconciliationScheduled: true,
    });

    expect(updateRemote).toHaveBeenCalledTimes(1);
    expect(cacheManaged).toHaveBeenCalledTimes(1);
    expect(scheduleReconciliation).toHaveBeenCalledWith('user-a', 'manage', DETAIL.id);
  });

  it('never cleans local program data before remote deletion succeeds', async () => {
    const order: string[] = [];
    const deleteRemote = jest.fn<Promise<DeleteRemoteResult>, []>(async () => {
      order.push('remote');
      return 'deleted';
    });
    const deleteLocal = jest.fn(async () => {
      order.push('local');
    });

    const scheduleReconciliation = jest.fn(async () => undefined);

    await deleteProgram(
      { ownerUserId: 'user-a', programInstanceId: DETAIL.id },
      { deleteRemote, deleteLocal, scheduleReconciliation }
    );
    expect(order).toEqual(['remote', 'local']);

    deleteRemote.mockRejectedValueOnce(new Error('server rejected'));
    await expect(
      deleteProgram(
        { ownerUserId: 'user-a', programInstanceId: DETAIL.id },
        { deleteRemote, deleteLocal, scheduleReconciliation }
      )
    ).rejects.toThrow('server rejected');
    expect(deleteLocal).toHaveBeenCalledTimes(1);
  });

  it('preserves the create ACK and never repeats POST after local cache failure', async () => {
    const createRemote = jest.fn(async () => DETAIL);
    const scheduleReconciliation = jest.fn(async () => undefined);

    const result = await startPresetProgram(
      {
        ownerUserId: 'user-a',
        definition: DEFINITION,
        name: 'GZCLP',
        config: { squat: 20 },
      },
      {
        createRemote,
        fetchRemotePrograms: jest.fn(async () => [SUMMARY]),
        cacheCreated: jest.fn(async () => {
          throw new Error('disk full after ACK');
        }),
        scheduleReconciliation,
      }
    );

    expect(result).toEqual({
      status: 'reconciliation_required',
      remote: DETAIL,
      remoteEntityId: DETAIL.id,
      remoteState: 'acknowledged',
      reconciliationScheduled: true,
    });
    expect(createRemote).toHaveBeenCalledTimes(1);
    expect(scheduleReconciliation).toHaveBeenCalledWith('user-a', 'create', DETAIL.id);
  });

  it('does not claim create failed when transport loses the response outcome', async () => {
    const scheduleReconciliation = jest.fn(async () => undefined);

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
            throw new RemoteMutationOutcomeUnknownError('create', null, new Error('timeout'));
          }),
          fetchRemotePrograms: jest.fn(async () => [SUMMARY]),
          cacheCreated: jest.fn(async () => undefined),
          scheduleReconciliation,
        }
      )
    ).resolves.toEqual({
      status: 'reconciliation_required',
      remote: null,
      remoteEntityId: null,
      remoteState: 'outcome_unknown',
      reconciliationScheduled: true,
    });
  });

  it('exposes a recoverable create ID when an acknowledged response body is corrupt', async () => {
    const scheduleReconciliation = jest.fn(async () => undefined);

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
            throw new RemoteMutationAcknowledgedError(
              'create',
              DETAIL.id,
              new Error('invalid detail')
            );
          }),
          fetchRemotePrograms: jest.fn(async () => [SUMMARY]),
          cacheCreated: jest.fn(async () => undefined),
          scheduleReconciliation,
        }
      )
    ).resolves.toEqual({
      status: 'reconciliation_required',
      remote: null,
      remoteEntityId: DETAIL.id,
      remoteState: 'acknowledged',
      reconciliationScheduled: true,
    });
    expect(scheduleReconciliation).toHaveBeenCalledWith('user-a', 'create', DETAIL.id);
  });

  it('returns delete ACK and schedules safe cleanup after a local post-ACK failure', async () => {
    const scheduleReconciliation = jest.fn(async () => undefined);

    await expect(
      deleteProgram(
        { ownerUserId: 'user-a', programInstanceId: DETAIL.id },
        {
          deleteRemote: jest.fn(async () => 'already_absent'),
          deleteLocal: jest.fn(async () => {
            throw new Error('local transaction failed');
          }),
          scheduleReconciliation,
        }
      )
    ).resolves.toEqual({
      status: 'reconciliation_required',
      remote: 'already_absent',
      remoteEntityId: DETAIL.id,
      remoteState: 'acknowledged',
      reconciliationScheduled: true,
    });
    expect(scheduleReconciliation).toHaveBeenCalledWith('user-a', 'delete', DETAIL.id);
  });
});
