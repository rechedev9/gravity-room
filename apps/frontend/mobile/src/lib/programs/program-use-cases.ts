import { canonicalProgramCreationIntent } from '@gzclp/domain/program-config';
import type { GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';
import * as Crypto from 'expo-crypto';

import {
  captureAuthorizedSession,
  ObsoleteAuthorizedSessionError,
  type AuthorizedSession,
} from '../auth/session';
import {
  cacheCreatedProgram,
  clearProgramCreateReconciliation,
  cacheManagedProgram,
  clearProgramDeleteReconciliation,
  clearProgramManageReconciliationIfMatches,
  deleteLocalProgramData,
  markProgramCreateReconciliationPending,
  persistProgramManageExpectation,
  programManageExpectationsMatch,
  readPendingDeleteReconciliations,
  readPendingCreateReconciliation,
  readPendingManageReconciliations,
  recordProgramReconciliation,
  reserveProgramCreateReconciliation,
  resolveProgramReconciliationWithRemoteDetail,
  type ProgramManageExpectation,
  type ProgramSummary,
} from './program-repository';
import {
  abandonProgramRefreshLease,
  advanceProgramMutationGenerations,
  captureProgramRefreshLease,
} from './program-refresh-generation';
import {
  createProgramInstance,
  deleteProgramInstance,
  fetchProgramInstance,
  fetchProgramInstanceIfExists,
  fetchProgramSummaries,
  RemoteMutationAcknowledgedError,
  RemoteMutationOutcomeUnknownError,
  RemoteMutationRejectedError,
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
  readonly fetchRemotePrograms: (session: AuthorizedSession) => Promise<ProgramSummary[]>;
  readonly cacheCreated: typeof cacheCreatedProgram;
  readonly reserveCreate?: typeof reserveProgramCreateReconciliation;
  readonly readPendingCreate?: typeof readPendingCreateReconciliation;
  readonly scheduleReconciliation: typeof recordProgramReconciliation;
  readonly captureSession?: typeof captureAuthorizedSession;
  readonly captureLibraryLease?: typeof captureProgramRefreshLease;
  readonly abandonLibraryLease?: typeof abandonProgramRefreshLease;
  readonly clearCreateReconciliation?: typeof clearProgramCreateReconciliation;
  readonly markCreatePending?: typeof markProgramCreateReconciliationPending;
}

interface ManageProgramDependencies {
  readonly updateRemote: typeof updateProgramInstance;
  readonly cacheManaged: typeof cacheManagedProgram;
  readonly readPending: typeof readPendingManageReconciliations;
  readonly readPendingDeletes?: typeof readPendingDeleteReconciliations;
  readonly scheduleReconciliation: typeof recordProgramReconciliation;
  readonly persistExpectation?: typeof persistProgramManageExpectation;
  readonly clearMatchingReconciliation?: typeof clearProgramManageReconciliationIfMatches;
  readonly captureSession?: typeof captureAuthorizedSession;
}

interface DeleteProgramDependencies {
  readonly deleteRemote: typeof deleteProgramInstance;
  readonly deleteLocal: typeof deleteLocalProgramData;
  readonly scheduleReconciliation: typeof recordProgramReconciliation;
  readonly readPending?: typeof readPendingDeleteReconciliations;
  readonly clearReconciliation?: typeof clearProgramDeleteReconciliation;
  readonly captureSession?: typeof captureAuthorizedSession;
}

interface VerifyPendingDeleteDependencies {
  readonly verifyRemote: (
    programInstanceId: string,
    session: AuthorizedSession
  ) => Promise<GenericProgramDetail | null>;
  readonly deleteLocal: typeof deleteLocalProgramData;
  readonly captureSession?: typeof captureAuthorizedSession;
}

interface ReconcileManageDependencies {
  readonly readPending: typeof readPendingManageReconciliations;
  readonly fetchRemote: typeof fetchProgramInstance;
  readonly resolveWithDetail: typeof resolveProgramReconciliationWithRemoteDetail;
  readonly captureSession?: typeof captureAuthorizedSession;
}

const CREATE_DEPENDENCIES: CreateProgramDependencies = {
  createRemote: createProgramInstance,
  fetchRemotePrograms: fetchProgramSummaries,
  cacheCreated: cacheCreatedProgram,
  reserveCreate: reserveProgramCreateReconciliation,
  scheduleReconciliation: recordProgramReconciliation,
  clearCreateReconciliation: clearProgramCreateReconciliation,
  markCreatePending: markProgramCreateReconciliationPending,
};

const MANAGE_DEPENDENCIES: ManageProgramDependencies = {
  updateRemote: updateProgramInstance,
  cacheManaged: cacheManagedProgram,
  readPending: readPendingManageReconciliations,
  readPendingDeletes: readPendingDeleteReconciliations,
  scheduleReconciliation: recordProgramReconciliation,
  persistExpectation: persistProgramManageExpectation,
  clearMatchingReconciliation: clearProgramManageReconciliationIfMatches,
};

const DELETE_DEPENDENCIES: DeleteProgramDependencies = {
  deleteRemote: deleteProgramInstance,
  deleteLocal: deleteLocalProgramData,
  scheduleReconciliation: recordProgramReconciliation,
  readPending: readPendingDeleteReconciliations,
  clearReconciliation: clearProgramDeleteReconciliation,
};

const VERIFY_PENDING_DELETE_DEPENDENCIES: VerifyPendingDeleteDependencies = {
  verifyRemote: fetchProgramInstanceIfExists,
  deleteLocal: deleteLocalProgramData,
};

const RECONCILE_MANAGE_DEPENDENCIES: ReconcileManageDependencies = {
  readPending: readPendingManageReconciliations,
  fetchRemote: fetchProgramInstance,
  resolveWithDetail: resolveProgramReconciliationWithRemoteDetail,
  captureSession: captureAuthorizedSession,
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
  const session = (dependencies.captureSession ?? captureAuthorizedSession)(input.ownerUserId);
  const normalizedName = input.name.trim();
  const serializedIntent = canonicalProgramCreationIntent(
    input.definition.id,
    normalizedName,
    input.config
  );
  const intentId = encodeURIComponent(serializedIntent);
  const reserved = await (dependencies.reserveCreate
    ? dependencies.reserveCreate(input.ownerUserId, intentId, Crypto.randomUUID())
    : (async () => {
        const pending = dependencies.readPendingCreate;
        if (pending === undefined) {
          const idempotencyKey = Crypto.randomUUID();
          const reconciliationId = `pending-create:${intentId}:${idempotencyKey}`;
          return scheduleReconciliation(
            input.ownerUserId,
            'create',
            reconciliationId,
            dependencies.scheduleReconciliation
          ).then((persisted) => {
            if (!persisted) throw new Error('Program creation intent could not be persisted');
            return { reconciliationId, idempotencyKey, intentId };
          });
        }
        return pending(input.ownerUserId).then((existing) => {
          const idempotencyKey =
            existing?.intentId === intentId && typeof existing.idempotencyKey === 'string'
              ? existing.idempotencyKey
              : Crypto.randomUUID();
          return {
            reconciliationId: `pending-create:${intentId}:${idempotencyKey}`,
            idempotencyKey,
            intentId,
          };
        });
      })());
  const idempotencyKey = reserved.idempotencyKey;
  const reconciliationId = reserved.reconciliationId;
  await advanceProgramMutationGenerations(
    input.ownerUserId,
    `pending-create:${input.definition.id}`
  );
  let detail: GenericProgramDetail;
  try {
    detail = await dependencies.createRemote({
      ownerUserId: input.ownerUserId,
      session,
      definition: input.definition,
      name: normalizedName,
      config: input.config,
      idempotencyKey,
    });
  } catch (error) {
    if (
      error instanceof RemoteMutationOutcomeUnknownError ||
      error instanceof RemoteMutationAcknowledgedError
    ) {
      const reconciliationScheduled = dependencies.markCreatePending
        ? await dependencies.markCreatePending(input.ownerUserId, reserved, error.entityId ?? null)
        : await scheduleReconciliation(
            input.ownerUserId,
            'create',
            error.entityId ?? reconciliationId,
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
  let libraryLease;
  try {
    libraryLease = await (dependencies.captureLibraryLease ?? captureProgramRefreshLease)(
      input.ownerUserId,
      'library',
      session
    );
  } catch (error) {
    return {
      status: 'reconciliation_required',
      remote: detail,
      remoteEntityId: detail.id,
      remoteState: 'acknowledged',
      reconciliationScheduled:
        error instanceof ObsoleteAuthorizedSessionError
          ? false
          : dependencies.markCreatePending
            ? await dependencies.markCreatePending(input.ownerUserId, reserved, detail.id)
            : await scheduleReconciliation(
                input.ownerUserId,
                'create',
                detail.id,
                dependencies.scheduleReconciliation
              ),
    };
  }
  let serverPrograms: readonly ProgramSummary[] | null = null;
  try {
    const refreshedPrograms = await dependencies.fetchRemotePrograms(session);
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
      session,
      libraryLease,
      detail,
      definition: input.definition,
      serverPrograms,
    });
    await dependencies.clearCreateReconciliation?.(input.ownerUserId, reserved);
    return { status: 'applied', remote: detail };
  } catch (error) {
    const reconciliationScheduled =
      error instanceof ObsoleteAuthorizedSessionError
        ? false
        : dependencies.markCreatePending
          ? await dependencies.markCreatePending(input.ownerUserId, reserved, detail.id)
          : await scheduleReconciliation(
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
  } finally {
    await (dependencies.abandonLibraryLease ?? abandonProgramRefreshLease)(libraryLease);
  }
}

const programMutationTails = new Map<string, Promise<void>>();

async function withProgramMutationLane<T>(
  ownerUserId: string,
  programInstanceId: string,
  task: () => Promise<T>
): Promise<T> {
  const key = `${ownerUserId}\u0000${programInstanceId}`;
  const previous = programMutationTails.get(key) ?? Promise.resolve();
  let release = (): void => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  programMutationTails.set(key, tail);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (programMutationTails.get(key) === tail) {
      programMutationTails.delete(key);
    }
  }
}

async function manageProgramSerialized(
  input: {
    readonly ownerUserId: string;
    readonly programInstanceId: string;
    readonly mutation: ProgramManagementMutation;
  },
  session: AuthorizedSession,
  dependencies: ManageProgramDependencies = MANAGE_DEPENDENCIES
): Promise<ProgramMutationResult<GenericProgramDetail>> {
  const pendingDeletes = await dependencies.readPendingDeletes?.(input.ownerUserId);
  if (pendingDeletes?.includes(input.programInstanceId)) {
    return {
      status: 'reconciliation_required',
      remote: null,
      remoteEntityId: input.programInstanceId,
      remoteState: 'outcome_unknown',
      reconciliationScheduled: true,
    };
  }
  const pending = (await dependencies.readPending(input.ownerUserId)).find(
    (reconciliation) => reconciliation.programInstanceId === input.programInstanceId
  );
  const markerExisted = pending?.expectation !== undefined;
  if (pending?.expectation === null) {
    return {
      status: 'reconciliation_required',
      remote: null,
      remoteEntityId: input.programInstanceId,
      remoteState: 'outcome_unknown',
      reconciliationScheduled: true,
    };
  }
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

  const persisted = dependencies.persistExpectation
    ? await dependencies.persistExpectation(
        input.ownerUserId,
        input.programInstanceId,
        input.mutation
      )
    : await dependencies
        .scheduleReconciliation(
          input.ownerUserId,
          'manage',
          input.programInstanceId,
          input.mutation
        )
        .then(() => true);
  if (!persisted) {
    throw new Error('Program management intent could not be persisted');
  }

  let detail: GenericProgramDetail;
  try {
    detail = await dependencies.updateRemote(input.programInstanceId, input.mutation, session);
  } catch (error) {
    if (
      error instanceof RemoteMutationOutcomeUnknownError ||
      error instanceof RemoteMutationAcknowledgedError
    ) {
      return {
        status: 'reconciliation_required',
        remote: null,
        remoteEntityId: input.programInstanceId,
        remoteState:
          error instanceof RemoteMutationAcknowledgedError ? 'acknowledged' : 'outcome_unknown',
        reconciliationScheduled: true,
      };
    }
    if (
      (error instanceof RemoteMutationRejectedError && !markerExisted) ||
      (error instanceof ObsoleteAuthorizedSessionError &&
        !error.requestDispatched &&
        !markerExisted)
    ) {
      await dependencies.clearMatchingReconciliation?.(
        input.ownerUserId,
        input.programInstanceId,
        input.mutation
      );
    }
    throw error;
  }
  try {
    await dependencies.cacheManaged(input.ownerUserId, detail, {
      session,
      activationRequested:
        input.mutation.type === 'set_status' && input.mutation.status === 'active',
      mutation: input.mutation,
    });
    return { status: 'applied', remote: detail };
  } catch {
    return {
      status: 'reconciliation_required',
      remote: detail,
      remoteEntityId: detail.id,
      remoteState: 'acknowledged',
      reconciliationScheduled: true,
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
  const session = (dependencies.captureSession ?? captureAuthorizedSession)(input.ownerUserId);
  await advanceProgramMutationGenerations(input.ownerUserId, input.programInstanceId);
  return withProgramMutationLane(input.ownerUserId, input.programInstanceId, () =>
    manageProgramSerialized(input, session, dependencies)
  );
}

export async function deleteProgram(
  input: {
    readonly ownerUserId: string;
    readonly programInstanceId: string;
  },
  dependencies: DeleteProgramDependencies = DELETE_DEPENDENCIES
): Promise<ProgramMutationResult<DeleteRemoteResult>> {
  const session = (dependencies.captureSession ?? captureAuthorizedSession)(input.ownerUserId);
  await advanceProgramMutationGenerations(input.ownerUserId, input.programInstanceId);
  return withProgramMutationLane(input.ownerUserId, input.programInstanceId, () =>
    deleteProgramSerialized(input, session, dependencies)
  );
}

export async function verifyPendingProgramDelete(
  input: {
    readonly ownerUserId: string;
    readonly programInstanceId: string;
  },
  dependencies: VerifyPendingDeleteDependencies = VERIFY_PENDING_DELETE_DEPENDENCIES
): Promise<'resolved_absent' | 'still_pending'> {
  const session = (dependencies.captureSession ?? captureAuthorizedSession)(input.ownerUserId);
  await advanceProgramMutationGenerations(input.ownerUserId, input.programInstanceId);
  return withProgramMutationLane(input.ownerUserId, input.programInstanceId, async () => {
    const remote = await dependencies.verifyRemote(input.programInstanceId, session);
    if (remote === null) {
      await dependencies.deleteLocal(input.ownerUserId, input.programInstanceId, session);
      return 'resolved_absent';
    }
    return 'still_pending';
  });
}

async function deleteProgramSerialized(
  input: {
    readonly ownerUserId: string;
    readonly programInstanceId: string;
  },
  session: AuthorizedSession,
  dependencies: DeleteProgramDependencies
): Promise<ProgramMutationResult<DeleteRemoteResult>> {
  const markerExisted =
    (await dependencies.readPending?.(input.ownerUserId))?.includes(input.programInstanceId) ??
    false;
  if (!markerExisted) {
    const persisted = await scheduleReconciliation(
      input.ownerUserId,
      'delete',
      input.programInstanceId,
      dependencies.scheduleReconciliation
    );
    if (!persisted) {
      throw new Error('Program deletion intent could not be persisted');
    }
  }

  let remote: DeleteRemoteResult;
  try {
    remote = await dependencies.deleteRemote(input.programInstanceId, session);
  } catch (error) {
    if (error instanceof RemoteMutationOutcomeUnknownError) {
      return {
        status: 'reconciliation_required',
        remote: null,
        remoteEntityId: input.programInstanceId,
        remoteState: 'outcome_unknown',
        reconciliationScheduled: true,
      };
    }
    if (
      (error instanceof RemoteMutationRejectedError && !markerExisted) ||
      (error instanceof ObsoleteAuthorizedSessionError &&
        !error.requestDispatched &&
        !markerExisted)
    ) {
      await dependencies.clearReconciliation?.(input.ownerUserId, input.programInstanceId);
    }
    throw error;
  }
  try {
    await dependencies.deleteLocal(input.ownerUserId, input.programInstanceId, session);
    return { status: 'applied', remote };
  } catch {
    return {
      status: 'reconciliation_required',
      remote,
      remoteEntityId: input.programInstanceId,
      remoteState: 'acknowledged',
      reconciliationScheduled: true,
    };
  }
}

export async function reconcilePendingProgramManagement(
  ownerUserId: string,
  remoteProgramInstanceIds: readonly string[],
  dependencies: ReconcileManageDependencies = RECONCILE_MANAGE_DEPENDENCIES
): Promise<void> {
  const session = (dependencies.captureSession ?? captureAuthorizedSession)(ownerUserId);
  const remoteIds = new Set(remoteProgramInstanceIds);
  const pending = await dependencies.readPending(ownerUserId);
  for (const reconciliation of pending) {
    if (reconciliation.expectation === null) {
      // Pre-expectation rows cannot be reconciled safely because their intended
      // mutation is unknown. ProgramsScreen keeps that program blocked and
      // offers deletion as the explicit resolution path.
      continue;
    }
    if (!remoteIds.has(reconciliation.programInstanceId)) {
      continue;
    }
    await withProgramMutationLane(ownerUserId, reconciliation.programInstanceId, async () => {
      const current = (await dependencies.readPending(ownerUserId)).find(
        (entry) => entry.programInstanceId === reconciliation.programInstanceId
      );
      if (current?.expectation === null || current?.expectation === undefined) {
        return;
      }
      try {
        const remote = await dependencies.fetchRemote(reconciliation.programInstanceId, session);
        await dependencies.resolveWithDetail(ownerUserId, remote, session);
      } catch {
        // Reconciliation is read-only. Any unavailable or still-old remote truth
        // leaves the durable marker intact for a later GET.
      }
    });
  }
}
