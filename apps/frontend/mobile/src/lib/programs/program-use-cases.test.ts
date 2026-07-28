import type { GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';

import {
  captureAuthorizedSession,
  ObsoleteAuthorizedSessionError,
  type AuthorizedSession,
} from '../auth/session';
import {
  RemoteMutationAcknowledgedError,
  RemoteMutationOutcomeUnknownError,
  RemoteMutationRejectedError,
  type DeleteRemoteResult,
  type ProgramManagementMutation,
} from './program-service';
import type {
  ProgramManageExpectation,
  ProgramReconciliationOperation,
} from './program-repository';
import {
  deleteProgram,
  manageProgram,
  reconcilePendingProgramManagement,
  startPresetProgram,
  verifyPendingProgramDelete,
} from './program-use-cases';

jest.mock('../auth/session', () => {
  const actual = jest.requireActual<typeof import('../auth/session')>('../auth/session');
  return {
    ...actual,
    isAuthorizedSessionCurrent: jest.fn(() => true),
    captureAuthorizedSession: jest.fn((ownerUserId: string) => ({
      ownerUserId,
      accessToken: 'a',
      generation: 1,
    })),
  };
});

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
  beforeEach(() => {
    jest.mocked(captureAuthorizedSession).mockImplementation((ownerUserId) => ({
      ownerUserId,
      accessToken: 'a',
      generation: 1,
    }));
  });

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
    expect(createRemote).toHaveBeenCalledWith({
      ownerUserId: 'user-a',
      session: {
        ownerUserId: 'user-a',
        accessToken: 'a',
        generation: 1,
      },
      definition: DEFINITION,
      name: 'GZCLP',
      config: { squat: 20 },
    });
    expect(fetchRemotePrograms).toHaveBeenCalledWith({
      ownerUserId: 'user-a',
      accessToken: 'a',
      generation: 1,
    });
    expect(cacheCreated).toHaveBeenCalledWith({
      ownerUserId: 'user-a',
      libraryLease: expect.objectContaining({
        ownerUserId: 'user-a',
        resource: 'library',
      }),
      session: {
        ownerUserId: 'user-a',
        accessToken: 'a',
        generation: 1,
      },
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
      libraryLease: expect.objectContaining({
        ownerUserId: 'user-a',
        resource: 'library',
      }),
      session: {
        ownerUserId: 'user-a',
        accessToken: 'a',
        generation: 1,
      },
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
        {
          updateRemote,
          cacheManaged,
          readPending: jest.fn(async () => []),
          scheduleReconciliation,
        }
      )
    ).resolves.toEqual({
      status: 'reconciliation_required',
      remote: archivedDetail,
      remoteEntityId: archivedDetail.id,
      remoteState: 'acknowledged',
      reconciliationScheduled: true,
    });

    expect(updateRemote).toHaveBeenCalledTimes(1);
    expect(updateRemote).toHaveBeenCalledWith(
      DETAIL.id,
      { type: 'set_status', status: 'archived' },
      {
        ownerUserId: 'user-a',
        accessToken: 'a',
        generation: 1,
      }
    );
    expect(cacheManaged).toHaveBeenCalledWith('user-a', archivedDetail, {
      session: {
        ownerUserId: 'user-a',
        accessToken: 'a',
        generation: 1,
      },
      activationRequested: false,
      mutation: { type: 'set_status', status: 'archived' },
    });
    expect(scheduleReconciliation).toHaveBeenCalledWith('user-a', 'manage', DETAIL.id, {
      type: 'set_status',
      status: 'archived',
    });
  });

  it('persists the exact management intent before the remote PATCH is allowed to start', async () => {
    let persisted = false;
    const persistExpectation = jest.fn(async () => {
      persisted = true;
      return true;
    });
    const updateRemote = jest.fn(async () => {
      expect(persisted).toBe(true);
      throw new RemoteMutationOutcomeUnknownError(
        'manage',
        DETAIL.id,
        new Error('app stopped before a response')
      );
    });

    await expect(
      manageProgram(
        {
          ownerUserId: 'user-a',
          programInstanceId: DETAIL.id,
          mutation: { type: 'rename', name: 'Durable name' },
        },
        {
          updateRemote,
          cacheManaged: jest.fn(async () => undefined),
          readPending: jest.fn(async () => []),
          scheduleReconciliation: jest.fn(async () => undefined),
          persistExpectation,
        }
      )
    ).resolves.toMatchObject({
      status: 'reconciliation_required',
      reconciliationScheduled: true,
    });
    expect(persistExpectation.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER).toBeLessThan(
      updateRemote.mock.invocationCallOrder[0] ?? 0
    );
  });

  it('does not send PATCH when durable preflight persistence fails', async () => {
    const updateRemote = jest.fn(async () => DETAIL);

    await expect(
      manageProgram(
        {
          ownerUserId: 'user-a',
          programInstanceId: DETAIL.id,
          mutation: { type: 'rename', name: 'Never sent' },
        },
        {
          updateRemote,
          cacheManaged: jest.fn(async () => undefined),
          readPending: jest.fn(async () => []),
          scheduleReconciliation: jest.fn(async () => undefined),
          persistExpectation: jest.fn(async () => false),
        }
      )
    ).rejects.toThrow('could not be persisted');
    expect(updateRemote).not.toHaveBeenCalled();
  });

  it('clears only the matching preflight marker after a definite rejection', async () => {
    const expectation = { type: 'rename' as const, name: 'Rejected name' };
    const clearMatchingReconciliation = jest.fn(async () => true);

    await expect(
      manageProgram(
        {
          ownerUserId: 'user-a',
          programInstanceId: DETAIL.id,
          mutation: expectation,
        },
        {
          updateRemote: jest.fn(async () => {
            throw new RemoteMutationRejectedError('manage', DETAIL.id, 400);
          }),
          cacheManaged: jest.fn(async () => undefined),
          readPending: jest.fn(async () => []),
          scheduleReconciliation: jest.fn(async () => undefined),
          persistExpectation: jest.fn(async () => true),
          clearMatchingReconciliation,
        }
      )
    ).rejects.toThrow('status 400');
    expect(clearMatchingReconciliation).toHaveBeenCalledWith('user-a', DETAIL.id, expectation);
  });

  it('preserves a pre-existing exact marker when the retry is not sent', async () => {
    const expectation = { type: 'rename' as const, name: 'Retry name' };
    const clearMatchingReconciliation = jest.fn(async () => true);

    await expect(
      manageProgram(
        {
          ownerUserId: 'user-a',
          programInstanceId: DETAIL.id,
          mutation: expectation,
        },
        {
          updateRemote: jest.fn(async () => {
            throw new ObsoleteAuthorizedSessionError(false);
          }),
          cacheManaged: jest.fn(async () => undefined),
          readPending: jest.fn(async () => [{ programInstanceId: DETAIL.id, expectation }]),
          scheduleReconciliation: jest.fn(async () => undefined),
          persistExpectation: jest.fn(async () => true),
          clearMatchingReconciliation,
        }
      )
    ).rejects.toThrow('session changed');
    expect(clearMatchingReconciliation).not.toHaveBeenCalled();
  });

  it('clears a newly persisted manage marker when session preflight sends no PATCH', async () => {
    const expectation = { type: 'rename' as const, name: 'Never dispatched' };
    const clearMatchingReconciliation = jest.fn(async () => true);

    await expect(
      manageProgram(
        {
          ownerUserId: 'user-a',
          programInstanceId: DETAIL.id,
          mutation: expectation,
        },
        {
          updateRemote: jest.fn(async () => {
            throw new ObsoleteAuthorizedSessionError(false);
          }),
          cacheManaged: jest.fn(async () => undefined),
          readPending: jest.fn(async () => []),
          scheduleReconciliation: jest.fn(async () => undefined),
          persistExpectation: jest.fn(async () => true),
          clearMatchingReconciliation,
        }
      )
    ).rejects.toThrow('session changed');
    expect(clearMatchingReconciliation).toHaveBeenCalledWith('user-a', DETAIL.id, expectation);
  });

  it('preserves a pre-existing exact marker after a definite retry rejection', async () => {
    const expectation = { type: 'rename' as const, name: 'Rejected retry' };
    const clearMatchingReconciliation = jest.fn(async () => true);

    await expect(
      manageProgram(
        {
          ownerUserId: 'user-a',
          programInstanceId: DETAIL.id,
          mutation: expectation,
        },
        {
          updateRemote: jest.fn(async () => {
            throw new RemoteMutationRejectedError('manage', DETAIL.id, 400);
          }),
          cacheManaged: jest.fn(async () => undefined),
          readPending: jest.fn(async () => [{ programInstanceId: DETAIL.id, expectation }]),
          scheduleReconciliation: jest.fn(async () => undefined),
          persistExpectation: jest.fn(async () => true),
          clearMatchingReconciliation,
        }
      )
    ).rejects.toThrow('status 400');
    expect(clearMatchingReconciliation).not.toHaveBeenCalled();
  });

  it('preserves an exact marker for an unclassified failure', async () => {
    const expectation = { type: 'rename' as const, name: 'Ambiguous retry' };
    const clearMatchingReconciliation = jest.fn(async () => true);

    await expect(
      manageProgram(
        {
          ownerUserId: 'user-a',
          programInstanceId: DETAIL.id,
          mutation: expectation,
        },
        {
          updateRemote: jest.fn(async () => {
            throw new Error('unclassified failure');
          }),
          cacheManaged: jest.fn(async () => undefined),
          readPending: jest.fn(async () => [{ programInstanceId: DETAIL.id, expectation }]),
          scheduleReconciliation: jest.fn(async () => undefined),
          persistExpectation: jest.fn(async () => true),
          clearMatchingReconciliation,
        }
      )
    ).rejects.toThrow('unclassified failure');
    expect(clearMatchingReconciliation).not.toHaveBeenCalled();
  });

  it('marks only an explicit activation for the atomic Tracker handoff', async () => {
    const cacheManaged = jest.fn(async () => undefined);

    await manageProgram(
      {
        ownerUserId: 'user-a',
        programInstanceId: DETAIL.id,
        mutation: { type: 'set_status', status: 'active' },
      },
      {
        updateRemote: jest.fn(async () => DETAIL),
        cacheManaged,
        readPending: jest.fn(async () => []),
        scheduleReconciliation: jest.fn(async () => undefined),
      }
    );

    expect(cacheManaged).toHaveBeenCalledWith('user-a', DETAIL, {
      session: {
        ownerUserId: 'user-a',
        accessToken: 'a',
        generation: 1,
      },
      activationRequested: true,
      mutation: { type: 'set_status', status: 'active' },
    });
  });

  it('blocks a different management mutation while a verifiable outcome is pending', async () => {
    const updateRemote = jest.fn(async () => ({ ...DETAIL, status: 'archived' as const }));

    await expect(
      manageProgram(
        {
          ownerUserId: 'user-a',
          programInstanceId: DETAIL.id,
          mutation: { type: 'set_status', status: 'archived' },
        },
        {
          updateRemote,
          cacheManaged: jest.fn(async () => undefined),
          readPending: jest.fn(async () => [
            {
              programInstanceId: DETAIL.id,
              expectation: { type: 'rename' as const, name: 'Expected name' },
            },
          ]),
          scheduleReconciliation: jest.fn(async () => undefined),
        }
      )
    ).resolves.toEqual({
      status: 'reconciliation_required',
      remote: null,
      remoteEntityId: DETAIL.id,
      remoteState: 'outcome_unknown',
      reconciliationScheduled: true,
    });
    expect(updateRemote).not.toHaveBeenCalled();
  });

  it('serializes concurrent management and permits only an explicit retry of the same intent', async () => {
    let releaseFirst = (): void => undefined;
    let markFirstStarted = (): void => undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    let pendingExpectation: {
      readonly programInstanceId: string;
      readonly expectation: { readonly type: 'rename'; readonly name: string };
    } | null = null;
    const updateRemote = jest.fn<
      Promise<GenericProgramDetail>,
      [string, ProgramManagementMutation]
    >(async () => {
      markFirstStarted();
      await firstGate;
      throw new RemoteMutationOutcomeUnknownError('manage', DETAIL.id, new Error('timeout'));
    });
    const readPending = jest.fn(async () =>
      pendingExpectation === null ? [] : [pendingExpectation]
    );
    const scheduleReconciliation = jest.fn(
      async (
        _owner: string,
        _operation: ProgramReconciliationOperation,
        programInstanceId: string,
        intent: ProgramManageExpectation | null = null
      ) => {
        if (intent?.type === 'rename') {
          pendingExpectation = { programInstanceId, expectation: intent };
        }
      }
    );
    const dependencies = {
      updateRemote,
      cacheManaged: jest.fn(async () => undefined),
      readPending,
      scheduleReconciliation,
    };

    const first = manageProgram(
      {
        ownerUserId: 'user-a',
        programInstanceId: DETAIL.id,
        mutation: { type: 'rename', name: 'Expected name' },
      },
      dependencies
    );
    await firstStarted;
    const second = manageProgram(
      {
        ownerUserId: 'user-a',
        programInstanceId: DETAIL.id,
        mutation: { type: 'set_status', status: 'archived' },
      },
      dependencies
    );
    releaseFirst();

    await expect(first).resolves.toMatchObject({
      status: 'reconciliation_required',
      remoteState: 'outcome_unknown',
      reconciliationScheduled: true,
    });
    await expect(second).resolves.toMatchObject({
      status: 'reconciliation_required',
      remoteState: 'outcome_unknown',
      reconciliationScheduled: true,
    });
    expect(updateRemote).toHaveBeenCalledTimes(1);

    updateRemote.mockResolvedValueOnce({ ...DETAIL, name: 'Expected name' });
    await expect(
      manageProgram(
        {
          ownerUserId: 'user-a',
          programInstanceId: DETAIL.id,
          mutation: { type: 'rename', name: 'Expected name' },
        },
        dependencies
      )
    ).resolves.toEqual({
      status: 'applied',
      remote: { ...DETAIL, name: 'Expected name' },
    });
    expect(updateRemote).toHaveBeenCalledTimes(2);
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
    expect(deleteRemote).toHaveBeenCalledWith(DETAIL.id, {
      ownerUserId: 'user-a',
      accessToken: 'a',
      generation: 1,
    });
    expect(deleteLocal).toHaveBeenCalledWith('user-a', DETAIL.id, {
      ownerUserId: 'user-a',
      accessToken: 'a',
      generation: 1,
    });

    deleteRemote.mockRejectedValueOnce(new Error('server rejected'));
    await expect(
      deleteProgram(
        { ownerUserId: 'user-a', programInstanceId: DETAIL.id },
        { deleteRemote, deleteLocal, scheduleReconciliation }
      )
    ).rejects.toThrow('server rejected');
    expect(deleteLocal).toHaveBeenCalledTimes(1);
  });

  it('persists delete intent before dispatch and clears it after a definite rejection', async () => {
    const order: string[] = [];
    const scheduleReconciliation = jest.fn(async () => {
      order.push('local:intent');
    });
    const clearReconciliation = jest.fn(async () => {
      order.push('local:clear');
    });
    const deleteRemote = jest.fn(async () => {
      order.push('remote:delete');
      throw new RemoteMutationRejectedError('delete', DETAIL.id, 409);
    });

    await expect(
      deleteProgram(
        { ownerUserId: 'user-a', programInstanceId: DETAIL.id },
        {
          deleteRemote,
          deleteLocal: jest.fn(async () => undefined),
          scheduleReconciliation,
          readPending: jest.fn(async () => []),
          clearReconciliation,
        }
      )
    ).rejects.toThrow('status 409');
    expect(order).toEqual(['local:intent', 'remote:delete', 'local:clear']);
    expect(scheduleReconciliation).toHaveBeenCalledWith('user-a', 'delete', DETAIL.id);
    expect(clearReconciliation).toHaveBeenCalledWith('user-a', DETAIL.id);
  });

  it('preserves a pre-existing delete marker after a definite retry rejection', async () => {
    const clearReconciliation = jest.fn(async () => undefined);

    await expect(
      deleteProgram(
        { ownerUserId: 'user-a', programInstanceId: DETAIL.id },
        {
          deleteRemote: jest.fn(async () => {
            throw new RemoteMutationRejectedError('delete', DETAIL.id, 409);
          }),
          deleteLocal: jest.fn(async () => undefined),
          scheduleReconciliation: jest.fn(async () => undefined),
          readPending: jest.fn(async () => [DETAIL.id]),
          clearReconciliation,
        }
      )
    ).rejects.toThrow('status 409');

    expect(clearReconciliation).not.toHaveBeenCalled();
  });

  it('keeps delete recovery pending when a racing verification still sees the program', async () => {
    const deleteLocal = jest.fn(async () => undefined);

    await expect(
      verifyPendingProgramDelete(
        { ownerUserId: 'user-a', programInstanceId: DETAIL.id },
        {
          verifyRemote: jest.fn(async () => DETAIL),
          deleteLocal,
        }
      )
    ).resolves.toBe('still_pending');

    expect(deleteLocal).not.toHaveBeenCalled();
  });

  it('finalizes local deletion when recovery verification confirms the program is gone', async () => {
    const deleteLocal = jest.fn(async () => undefined);

    await expect(
      verifyPendingProgramDelete(
        { ownerUserId: 'user-a', programInstanceId: DETAIL.id },
        {
          verifyRemote: jest.fn(async () => null),
          deleteLocal,
        }
      )
    ).resolves.toBe('resolved_absent');

    expect(deleteLocal).toHaveBeenCalledWith(
      'user-a',
      DETAIL.id,
      expect.objectContaining({ ownerUserId: 'user-a' })
    );
  });

  it('retains delete recovery when authoritative verification is unavailable', async () => {
    const deleteLocal = jest.fn(async () => undefined);

    await expect(
      verifyPendingProgramDelete(
        { ownerUserId: 'user-a', programInstanceId: DETAIL.id },
        {
          verifyRemote: jest.fn(async () => {
            throw new Error('offline');
          }),
          deleteLocal,
        }
      )
    ).rejects.toThrow('offline');

    expect(deleteLocal).not.toHaveBeenCalled();
  });

  it('does not dispatch DELETE when its durable intent cannot be persisted', async () => {
    const deleteRemote = jest.fn(async () => 'deleted' as const);

    await expect(
      deleteProgram(
        { ownerUserId: 'user-a', programInstanceId: DETAIL.id },
        {
          deleteRemote,
          deleteLocal: jest.fn(async () => undefined),
          scheduleReconciliation: jest.fn(async () => {
            throw new Error('SQLite unavailable');
          }),
          readPending: jest.fn(async () => []),
        }
      )
    ).rejects.toThrow('could not be persisted');
    expect(deleteRemote).not.toHaveBeenCalled();
  });

  it('serializes delete behind an in-flight manage for the same owner and program', async () => {
    let markManageStarted = (): void => undefined;
    const manageStarted = new Promise<void>((resolve) => {
      markManageStarted = resolve;
    });
    let releaseManage: (detail: GenericProgramDetail) => void = () => undefined;
    const updateRemote = jest.fn(
      () =>
        new Promise<GenericProgramDetail>((resolve) => {
          releaseManage = resolve;
          markManageStarted();
        })
    );
    const deleteRemote = jest.fn(async () => 'deleted' as const);
    const deleteLocal = jest.fn(async () => undefined);
    const scheduleReconciliation = jest.fn(async () => undefined);
    const manageSession = {
      ownerUserId: 'user-a',
      accessToken: 'm',
      generation: 10,
    };
    const deleteSession = {
      ownerUserId: 'user-a',
      accessToken: 'd',
      generation: 11,
    };
    jest
      .mocked(captureAuthorizedSession)
      .mockReturnValueOnce(manageSession)
      .mockReturnValueOnce(deleteSession);
    const manage = manageProgram(
      {
        ownerUserId: 'user-a',
        programInstanceId: DETAIL.id,
        mutation: { type: 'rename', name: 'Managed first' },
      },
      {
        updateRemote,
        cacheManaged: jest.fn(async () => undefined),
        readPending: jest.fn(async () => []),
        scheduleReconciliation,
        persistExpectation: jest.fn(async () => true),
      }
    );
    await manageStarted;
    const deletion = deleteProgram(
      { ownerUserId: 'user-a', programInstanceId: DETAIL.id },
      { deleteRemote, deleteLocal, scheduleReconciliation }
    );
    await Promise.resolve();

    expect(deleteRemote).not.toHaveBeenCalled();
    releaseManage({ ...DETAIL, name: 'Managed first' });
    await expect(manage).resolves.toMatchObject({ status: 'applied' });
    await expect(deletion).resolves.toEqual({ status: 'applied', remote: 'deleted' });
    expect(deleteRemote).toHaveBeenCalledTimes(1);
    expect(deleteRemote).toHaveBeenCalledWith(DETAIL.id, deleteSession);
    expect(deleteLocal).toHaveBeenCalledTimes(1);
    expect(deleteLocal).toHaveBeenCalledWith('user-a', DETAIL.id, deleteSession);
  });

  it('blocks a queued manage after an outcome-unknown delete leaves a durable marker', async () => {
    let releaseDelete = (): void => undefined;
    let markDeleteStarted = (): void => undefined;
    const deleteStarted = new Promise<void>((resolve) => {
      markDeleteStarted = resolve;
    });
    const deleteReleased = new Promise<void>((resolve) => {
      releaseDelete = resolve;
    });
    const pendingDeleteIds: string[] = [];
    const scheduleReconciliation = jest.fn(
      async (_ownerUserId: string, operation: ProgramReconciliationOperation, entityId: string) => {
        if (operation === 'delete') pendingDeleteIds.push(entityId);
      }
    );
    const deletion = deleteProgram(
      { ownerUserId: 'user-a', programInstanceId: DETAIL.id },
      {
        deleteRemote: jest.fn(async () => {
          markDeleteStarted();
          await deleteReleased;
          throw new RemoteMutationOutcomeUnknownError(
            'delete',
            DETAIL.id,
            new Error('response lost')
          );
        }),
        deleteLocal: jest.fn(async () => undefined),
        scheduleReconciliation,
        readPending: jest.fn(async () => pendingDeleteIds),
      }
    );
    await deleteStarted;
    const updateRemote = jest.fn(async () => DETAIL);
    const management = manageProgram(
      {
        ownerUserId: 'user-a',
        programInstanceId: DETAIL.id,
        mutation: { type: 'rename', name: 'Must not be sent' },
      },
      {
        updateRemote,
        cacheManaged: jest.fn(async () => undefined),
        readPending: jest.fn(async () => []),
        readPendingDeletes: jest.fn(async () => pendingDeleteIds),
        scheduleReconciliation,
        persistExpectation: jest.fn(async () => true),
      }
    );
    await Promise.resolve();
    expect(updateRemote).not.toHaveBeenCalled();

    releaseDelete();

    await expect(deletion).resolves.toMatchObject({
      status: 'reconciliation_required',
      remoteState: 'outcome_unknown',
    });
    await expect(management).resolves.toMatchObject({
      status: 'reconciliation_required',
      remoteState: 'outcome_unknown',
    });
    expect(updateRemote).not.toHaveBeenCalled();
  });

  it('does not let startup reconciliation clear a preflight marker during PATCH', async () => {
    let markManageStarted = (): void => undefined;
    const manageStarted = new Promise<void>((resolve) => {
      markManageStarted = resolve;
    });
    let releaseManage: (detail: GenericProgramDetail) => void = () => undefined;
    const manage = manageProgram(
      {
        ownerUserId: 'user-a',
        programInstanceId: DETAIL.id,
        mutation: { type: 'rename', name: 'Expected name' },
      },
      {
        updateRemote: jest.fn(
          () =>
            new Promise<GenericProgramDetail>((resolve) => {
              releaseManage = resolve;
              markManageStarted();
            })
        ),
        cacheManaged: jest.fn(async () => undefined),
        readPending: jest.fn(async () => []),
        scheduleReconciliation: jest.fn(async () => undefined),
        persistExpectation: jest.fn(async () => true),
      }
    );
    await manageStarted;

    const fetchRemote = jest.fn(async () => ({ ...DETAIL, name: 'Expected name' }));
    const readPending = jest
      .fn()
      .mockResolvedValueOnce([
        {
          programInstanceId: DETAIL.id,
          expectation: { type: 'rename' as const, name: 'Expected name' },
        },
      ])
      .mockResolvedValueOnce([]);
    const reconciliation = reconcilePendingProgramManagement('user-a', [DETAIL.id], {
      readPending,
      fetchRemote,
      resolveWithDetail: jest.fn(async () => true),
    });
    await Promise.resolve();
    expect(fetchRemote).not.toHaveBeenCalled();

    releaseManage({ ...DETAIL, name: 'Expected name' });
    await expect(manage).resolves.toMatchObject({ status: 'applied' });
    await expect(reconciliation).resolves.toBeUndefined();
    expect(fetchRemote).not.toHaveBeenCalled();
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

  it('does not recreate owner data after an acknowledged create loses its session', async () => {
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
          createRemote: jest.fn(async () => DETAIL),
          fetchRemotePrograms: jest.fn(async () => [SUMMARY]),
          cacheCreated: jest.fn(async () => {
            throw new ObsoleteAuthorizedSessionError();
          }),
          scheduleReconciliation,
        }
      )
    ).resolves.toMatchObject({
      status: 'reconciliation_required',
      remote: DETAIL,
      reconciliationScheduled: false,
    });
    expect(scheduleReconciliation).not.toHaveBeenCalled();
  });

  it('does not write reconciliation after the session changes before create lease capture', async () => {
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
          createRemote: jest.fn(async () => DETAIL),
          fetchRemotePrograms: jest.fn(async () => [SUMMARY]),
          cacheCreated: jest.fn(async () => undefined),
          captureLibraryLease: jest.fn(async () => {
            throw new ObsoleteAuthorizedSessionError();
          }),
          scheduleReconciliation,
        }
      )
    ).resolves.toMatchObject({
      status: 'reconciliation_required',
      remote: DETAIL,
      reconciliationScheduled: false,
    });
    expect(scheduleReconciliation).not.toHaveBeenCalled();
  });

  it('reports the retained manage marker after a dispatched acknowledged session switch', async () => {
    let markerPersisted = false;
    const clearMatchingReconciliation = jest.fn(async () => {
      markerPersisted = false;
      return true;
    });
    await expect(
      manageProgram(
        {
          ownerUserId: 'user-a',
          programInstanceId: DETAIL.id,
          mutation: { type: 'rename', name: 'Acknowledged name' },
        },
        {
          updateRemote: jest.fn(async () => ({ ...DETAIL, name: 'Acknowledged name' })),
          cacheManaged: jest.fn(async () => {
            throw new ObsoleteAuthorizedSessionError(true);
          }),
          readPending: jest.fn(async () => []),
          scheduleReconciliation: jest.fn(async () => undefined),
          persistExpectation: jest.fn(async () => {
            markerPersisted = true;
            return true;
          }),
          clearMatchingReconciliation,
        }
      )
    ).resolves.toMatchObject({
      status: 'reconciliation_required',
      remoteState: 'acknowledged',
      reconciliationScheduled: true,
    });
    expect(markerPersisted).toBe(true);
    expect(clearMatchingReconciliation).not.toHaveBeenCalled();
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

  it('reconciles manage through GET truth without repeating PATCH', async () => {
    const fetchRemote = jest
      .fn<Promise<GenericProgramDetail>, [string]>()
      .mockResolvedValueOnce({ ...DETAIL, name: 'Old name' })
      .mockResolvedValueOnce({ ...DETAIL, name: 'Expected name' });
    const resolveWithDetail = jest
      .fn<Promise<boolean>, [string, GenericProgramDetail, AuthorizedSession]>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const readPending = jest.fn(async () => [
      {
        programInstanceId: DETAIL.id,
        expectation: { type: 'rename' as const, name: 'Expected name' },
      },
    ]);

    await reconcilePendingProgramManagement('user-a', [DETAIL.id], {
      readPending,
      fetchRemote,
      resolveWithDetail,
    });
    await reconcilePendingProgramManagement('user-a', [DETAIL.id], {
      readPending,
      fetchRemote,
      resolveWithDetail,
    });

    expect(fetchRemote).toHaveBeenCalledTimes(2);
    expect(resolveWithDetail).toHaveBeenNthCalledWith(
      1,
      'user-a',
      {
        ...DETAIL,
        name: 'Old name',
      },
      expect.objectContaining({ ownerUserId: 'user-a' })
    );
    expect(resolveWithDetail).toHaveBeenNthCalledWith(
      2,
      'user-a',
      {
        ...DETAIL,
        name: 'Expected name',
      },
      expect.objectContaining({ ownerUserId: 'user-a' })
    );
  });

  it('does not repeat GET for a marker whose instance is absent from full remote truth', async () => {
    const fetchRemote = jest.fn<Promise<GenericProgramDetail>, [string]>();
    const resolveWithDetail = jest.fn<
      Promise<boolean>,
      [string, GenericProgramDetail, AuthorizedSession]
    >();
    const readPending = jest.fn(async () => [
      {
        programInstanceId: DETAIL.id,
        expectation: { type: 'set_status' as const, status: 'archived' as const },
      },
    ]);

    await reconcilePendingProgramManagement('user-a', [], {
      readPending,
      fetchRemote,
      resolveWithDetail,
    });

    expect(fetchRemote).not.toHaveBeenCalled();
    expect(resolveWithDetail).not.toHaveBeenCalled();
  });
});
