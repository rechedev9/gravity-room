import type { GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';

import {
  cacheCreatedProgram,
  cacheManagedProgram,
  deleteLocalProgramData,
  programManageExpectationsMatch,
  readPendingManageReconciliations,
  recordProgramReconciliation,
  resolveProgramReconciliationWithRemoteDetail,
  type ProgramManageExpectation,
  type ProgramSummary,
} from './program-repository';
import {
  createProgramInstance,
  deleteProgramInstance,
  fetchProgramInstance,
  fetchProgramSummaries,
  RemoteMutationAcknowledgedError,
  RemoteMutationOutcomeUnknownError,
  updateProgramInstance,
  type DeleteRemoteResult,
  type ProgramManagementMutation,
} from './program-service';

export type ProgramMutationResult<T> =
  | { readonly status: 'applied'; readonly remote: T }
  | {
      readonly status: 'reconciliation_required';
      readonly remote: T | null;
      readonly remoteEntityId: string | null;
      readonly remoteState: 'acknowledged' | 'outcome_unknown';
      readonly reconciliationScheduled: boolean;
    };

interface CreateProgramDependencies {
  readonly createRemote: typeof createProgramInstance;
  readonly fetchRemotePrograms: () => Promise<ProgramSummary[]>;
  readonly cacheCreated: typeof cacheCreatedProgram;
  readonly scheduleReconciliation: typeof recordProgramReconciliation;
}

interface ManageProgramDependencies {
  readonly updateRemote: typeof updateProgramInstance;
  readonly cacheManaged: typeof cacheManagedProgram;
  readonly readPending: typeof readPendingManageReconciliations;
  readonly scheduleReconciliation: typeof recordProgramReconciliation;
}

interface DeleteProgramDependencies {
  readonly deleteRemote: typeof deleteProgramInstance;
  readonly deleteLocal: typeof deleteLocalProgramData;
  readonly scheduleReconciliation: typeof recordProgramReconciliation;
}

interface ReconcileManageDependencies {
  readonly readPending: typeof readPendingManageReconciliations;
  readonly fetchRemote: typeof fetchProgramInstance;
  readonly resolveWithDetail: typeof resolveProgramReconciliationWithRemoteDetail;
}

const CREATE_DEPENDENCIES: CreateProgramDependencies = {
  createRemote: createProgramInstance,
  fetchRemotePrograms: fetchProgramSummaries,
  cacheCreated: cacheCreatedProgram,
  scheduleReconciliation: recordProgramReconciliation,
};

const MANAGE_DEPENDENCIES: ManageProgramDependencies = {
  updateRemote: updateProgramInstance,
  cacheManaged: cacheManagedProgram,
  readPending: readPendingManageReconciliations,
  scheduleReconciliation: recordProgramReconciliation,
};

const DELETE_DEPENDENCIES: DeleteProgramDependencies = {
  deleteRemote: deleteProgramInstance,
  deleteLocal: deleteLocalProgramData,
  scheduleReconciliation: recordProgramReconciliation,
};

const RECONCILE_MANAGE_DEPENDENCIES: ReconcileManageDependencies = {
  readPending: readPendingManageReconciliations,
  fetchRemote: fetchProgramInstance,
  resolveWithDetail: resolveProgramReconciliationWithRemoteDetail,
};

async function scheduleReconciliation(
  ownerUserId: string,
  operation: 'create' | 'manage' | 'delete',
  entityId: string,
  schedule: typeof recordProgramReconciliation,
  expectation: ProgramManageExpectation | null = null
): Promise<boolean> {
  try {
    if (operation === 'manage' && expectation !== null) {
      await schedule(ownerUserId, operation, entityId, expectation);
    } else {
      await schedule(ownerUserId, operation, entityId);
    }
    return true;
  } catch {
    return false;
  }
}

export async function startPresetProgram(
  input: {
    readonly ownerUserId: string;
    readonly definition: ProgramDefinition;
    readonly name: string;
    readonly config: unknown;
  },
  dependencies: CreateProgramDependencies = CREATE_DEPENDENCIES
): Promise<ProgramMutationResult<GenericProgramDetail>> {
  let detail: GenericProgramDetail;
  try {
    detail = await dependencies.createRemote({
      definition: input.definition,
      name: input.name,
      config: input.config,
    });
  } catch (error) {
    if (
      error instanceof RemoteMutationOutcomeUnknownError ||
      error instanceof RemoteMutationAcknowledgedError
    ) {
      const reconciliationScheduled = await scheduleReconciliation(
        input.ownerUserId,
        'create',
        error.entityId ?? `unknown:${input.definition.id}`,
        dependencies.scheduleReconciliation
      );
      return {
        status: 'reconciliation_required',
        remote: null,
        remoteEntityId: error.entityId,
        remoteState:
          error instanceof RemoteMutationAcknowledgedError ? 'acknowledged' : 'outcome_unknown',
        reconciliationScheduled,
      };
    }
    throw error;
  }
  let serverPrograms: readonly ProgramSummary[] | null = null;
  try {
    const refreshedPrograms = await dependencies.fetchRemotePrograms();
    serverPrograms = refreshedPrograms.some(
      (program) => program.id === detail.id && program.status === detail.status
    )
      ? refreshedPrograms
      : null;
  } catch {
    // The POST has already succeeded and is not idempotent. Cache its returned
    // server truth without replacing the older snapshot; the next library sync
    // will converge the complete list.
  }
  try {
    await dependencies.cacheCreated({
      ownerUserId: input.ownerUserId,
      detail,
      definition: input.definition,
      serverPrograms,
    });
    return { status: 'applied', remote: detail };
  } catch {
    const reconciliationScheduled = await scheduleReconciliation(
      input.ownerUserId,
      'create',
      detail.id,
      dependencies.scheduleReconciliation
    );
    return {
      status: 'reconciliation_required',
      remote: detail,
      remoteEntityId: detail.id,
      remoteState: 'acknowledged',
      reconciliationScheduled,
    };
  }
}

const manageProgramTails = new Map<string, Promise<void>>();

async function manageProgramSerialized(
  input: {
    readonly ownerUserId: string;
    readonly programInstanceId: string;
    readonly mutation: ProgramManagementMutation;
  },
  dependencies: ManageProgramDependencies = MANAGE_DEPENDENCIES
): Promise<ProgramMutationResult<GenericProgramDetail>> {
  const pending = (await dependencies.readPending(input.ownerUserId)).find(
    (reconciliation) => reconciliation.programInstanceId === input.programInstanceId
  );
  if (
    pending?.expectation !== null &&
    pending?.expectation !== undefined &&
    !programManageExpectationsMatch(pending.expectation, input.mutation)
  ) {
    return {
      status: 'reconciliation_required',
      remote: null,
      remoteEntityId: input.programInstanceId,
      remoteState: 'outcome_unknown',
      reconciliationScheduled: true,
    };
  }

  let detail: GenericProgramDetail;
  try {
    detail = await dependencies.updateRemote(input.programInstanceId, input.mutation);
  } catch (error) {
    if (
      error instanceof RemoteMutationOutcomeUnknownError ||
      error instanceof RemoteMutationAcknowledgedError
    ) {
      const reconciliationScheduled = await scheduleReconciliation(
        input.ownerUserId,
        'manage',
        input.programInstanceId,
        dependencies.scheduleReconciliation,
        input.mutation
      );
      return {
        status: 'reconciliation_required',
        remote: null,
        remoteEntityId: input.programInstanceId,
        remoteState:
          error instanceof RemoteMutationAcknowledgedError ? 'acknowledged' : 'outcome_unknown',
        reconciliationScheduled,
      };
    }
    throw error;
  }
  try {
    await dependencies.cacheManaged(input.ownerUserId, detail, {
      activationRequested:
        input.mutation.type === 'set_status' && input.mutation.status === 'active',
      mutation: input.mutation,
    });
    return { status: 'applied', remote: detail };
  } catch {
    const reconciliationScheduled = await scheduleReconciliation(
      input.ownerUserId,
      'manage',
      input.programInstanceId,
      dependencies.scheduleReconciliation,
      input.mutation
    );
    return {
      status: 'reconciliation_required',
      remote: detail,
      remoteEntityId: detail.id,
      remoteState: 'acknowledged',
      reconciliationScheduled,
    };
  }
}

export async function manageProgram(
  input: {
    readonly ownerUserId: string;
    readonly programInstanceId: string;
    readonly mutation: ProgramManagementMutation;
  },
  dependencies: ManageProgramDependencies = MANAGE_DEPENDENCIES
): Promise<ProgramMutationResult<GenericProgramDetail>> {
  const key = `${input.ownerUserId}\u0000${input.programInstanceId}`;
  const previous = manageProgramTails.get(key) ?? Promise.resolve();
  let release = (): void => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  manageProgramTails.set(key, tail);
  await previous;
  try {
    return await manageProgramSerialized(input, dependencies);
  } finally {
    release();
    if (manageProgramTails.get(key) === tail) {
      manageProgramTails.delete(key);
    }
  }
}

export async function deleteProgram(
  input: {
    readonly ownerUserId: string;
    readonly programInstanceId: string;
  },
  dependencies: DeleteProgramDependencies = DELETE_DEPENDENCIES
): Promise<ProgramMutationResult<DeleteRemoteResult>> {
  let remote: DeleteRemoteResult;
  try {
    remote = await dependencies.deleteRemote(input.programInstanceId);
  } catch (error) {
    if (error instanceof RemoteMutationOutcomeUnknownError) {
      const reconciliationScheduled = await scheduleReconciliation(
        input.ownerUserId,
        'delete',
        input.programInstanceId,
        dependencies.scheduleReconciliation
      );
      return {
        status: 'reconciliation_required',
        remote: null,
        remoteEntityId: input.programInstanceId,
        remoteState: 'outcome_unknown',
        reconciliationScheduled,
      };
    }
    throw error;
  }
  try {
    await dependencies.deleteLocal(input.ownerUserId, input.programInstanceId);
    return { status: 'applied', remote };
  } catch {
    const reconciliationScheduled = await scheduleReconciliation(
      input.ownerUserId,
      'delete',
      input.programInstanceId,
      dependencies.scheduleReconciliation
    );
    return {
      status: 'reconciliation_required',
      remote,
      remoteEntityId: input.programInstanceId,
      remoteState: 'acknowledged',
      reconciliationScheduled,
    };
  }
}

export async function reconcilePendingProgramManagement(
  ownerUserId: string,
  remoteProgramInstanceIds: readonly string[],
  dependencies: ReconcileManageDependencies = RECONCILE_MANAGE_DEPENDENCIES
): Promise<void> {
  const remoteIds = new Set(remoteProgramInstanceIds);
  const pending = await dependencies.readPending(ownerUserId);
  for (const reconciliation of pending) {
    if (reconciliation.expectation === null || !remoteIds.has(reconciliation.programInstanceId)) {
      continue;
    }
    try {
      const remote = await dependencies.fetchRemote(reconciliation.programInstanceId);
      await dependencies.resolveWithDetail(ownerUserId, remote);
    } catch {
      // Reconciliation is read-only. Any unavailable or still-old remote truth
      // leaves the durable marker intact for a later GET.
    }
  }
}
