import type { GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';

import {
  cacheCreatedProgram,
  cacheManagedProgram,
  deleteLocalProgramData,
  recordProgramReconciliation,
  type ProgramSummary,
} from './program-repository';
import {
  createProgramInstance,
  deleteProgramInstance,
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
  readonly scheduleReconciliation: typeof recordProgramReconciliation;
}

interface DeleteProgramDependencies {
  readonly deleteRemote: typeof deleteProgramInstance;
  readonly deleteLocal: typeof deleteLocalProgramData;
  readonly scheduleReconciliation: typeof recordProgramReconciliation;
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
  scheduleReconciliation: recordProgramReconciliation,
};

const DELETE_DEPENDENCIES: DeleteProgramDependencies = {
  deleteRemote: deleteProgramInstance,
  deleteLocal: deleteLocalProgramData,
  scheduleReconciliation: recordProgramReconciliation,
};

async function scheduleReconciliation(
  ownerUserId: string,
  operation: 'create' | 'manage' | 'delete',
  entityId: string,
  schedule: typeof recordProgramReconciliation
): Promise<boolean> {
  try {
    await schedule(ownerUserId, operation, entityId);
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

export async function manageProgram(
  input: {
    readonly ownerUserId: string;
    readonly programInstanceId: string;
    readonly mutation: ProgramManagementMutation;
  },
  dependencies: ManageProgramDependencies = MANAGE_DEPENDENCIES
): Promise<ProgramMutationResult<GenericProgramDetail>> {
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
        dependencies.scheduleReconciliation
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
    });
    return { status: 'applied', remote: detail };
  } catch {
    const reconciliationScheduled = await scheduleReconciliation(
      input.ownerUserId,
      'manage',
      input.programInstanceId,
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
