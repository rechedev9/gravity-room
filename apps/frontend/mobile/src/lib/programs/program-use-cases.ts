import type { GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';

import {
  cacheCreatedProgram,
  cacheManagedProgram,
  deleteLocalProgramData,
  type ProgramSummary,
} from './program-repository';
import {
  createProgramInstance,
  deleteProgramInstance,
  fetchProgramSummaries,
  updateProgramInstance,
  type ProgramManagementMutation,
} from './program-service';

interface CreateProgramDependencies {
  readonly createRemote: typeof createProgramInstance;
  readonly fetchRemotePrograms: () => Promise<ProgramSummary[]>;
  readonly cacheCreated: typeof cacheCreatedProgram;
}

interface ManageProgramDependencies {
  readonly updateRemote: typeof updateProgramInstance;
  readonly cacheManaged: typeof cacheManagedProgram;
}

interface DeleteProgramDependencies {
  readonly deleteRemote: typeof deleteProgramInstance;
  readonly deleteLocal: typeof deleteLocalProgramData;
}

const CREATE_DEPENDENCIES: CreateProgramDependencies = {
  createRemote: createProgramInstance,
  fetchRemotePrograms: fetchProgramSummaries,
  cacheCreated: cacheCreatedProgram,
};

const MANAGE_DEPENDENCIES: ManageProgramDependencies = {
  updateRemote: updateProgramInstance,
  cacheManaged: cacheManagedProgram,
};

const DELETE_DEPENDENCIES: DeleteProgramDependencies = {
  deleteRemote: deleteProgramInstance,
  deleteLocal: deleteLocalProgramData,
};

export async function startPresetProgram(
  input: {
    readonly ownerUserId: string;
    readonly definition: ProgramDefinition;
    readonly name: string;
    readonly config: unknown;
  },
  dependencies: CreateProgramDependencies = CREATE_DEPENDENCIES
): Promise<GenericProgramDetail> {
  const detail = await dependencies.createRemote({
    definition: input.definition,
    name: input.name,
    config: input.config,
  });
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
  await dependencies.cacheCreated({
    ownerUserId: input.ownerUserId,
    detail,
    definition: input.definition,
    serverPrograms,
  });
  return detail;
}

export async function manageProgram(
  input: {
    readonly ownerUserId: string;
    readonly programInstanceId: string;
    readonly mutation: ProgramManagementMutation;
  },
  dependencies: ManageProgramDependencies = MANAGE_DEPENDENCIES
): Promise<GenericProgramDetail> {
  const detail = await dependencies.updateRemote(input.programInstanceId, input.mutation);
  await dependencies.cacheManaged(input.ownerUserId, detail);
  return detail;
}

export async function deleteProgram(
  input: {
    readonly ownerUserId: string;
    readonly programInstanceId: string;
  },
  dependencies: DeleteProgramDependencies = DELETE_DEPENDENCIES
): Promise<void> {
  await dependencies.deleteRemote(input.programInstanceId);
  await dependencies.deleteLocal(input.ownerUserId, input.programInstanceId);
}
