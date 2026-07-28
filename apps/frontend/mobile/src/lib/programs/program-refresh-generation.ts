import {
  isAuthorizedSessionCurrent,
  ObsoleteAuthorizedSessionError,
  type AuthorizedSession,
} from '../auth/session';

export type ProgramRefreshResource =
  | 'catalog'
  | 'library'
  | `definition:${string}`
  | `detail:${string}`;

export interface ProgramRefreshLease {
  readonly ownerUserId: string;
  readonly resource: ProgramRefreshResource;
  readonly generation: number;
  readonly session: AuthorizedSession;
  readonly libraryGeneration?: number;
}

const generations = new Map<string, number>();
const nextGenerations = new Map<string, number>();
const commitBarrierTails = new Map<string, Promise<void>>();
const leaseStates = new Map<
  string,
  Map<
    number,
    {
      status: 'pending' | 'committed' | 'abandoned';
      readonly settled: Promise<void>;
      readonly resolve: () => void;
    }
  >
>();

function generationKey(ownerUserId: string, resource: ProgramRefreshResource): string {
  return `${ownerUserId}\u0000${resource}`;
}

function readGeneration(ownerUserId: string, resource: ProgramRefreshResource): number {
  return generations.get(generationKey(ownerUserId, resource)) ?? 0;
}

function reserveGeneration(ownerUserId: string, resource: ProgramRefreshResource): number {
  const key = generationKey(ownerUserId, resource);
  const generation =
    Math.max(nextGenerations.get(key) ?? 0, readGeneration(ownerUserId, resource)) + 1;
  nextGenerations.set(key, generation);
  return generation;
}

function createLeaseState(
  ownerUserId: string,
  resource: ProgramRefreshResource,
  generation: number
): void {
  const key = generationKey(ownerUserId, resource);
  const states = leaseStates.get(key) ?? new Map();
  let resolve = (): void => undefined;
  const settled = new Promise<void>((settle) => {
    resolve = settle;
  });
  states.set(generation, { status: 'pending', settled, resolve });
  leaseStates.set(key, states);
}

function readPendingLeaseState(lease: ProgramRefreshLease) {
  return leaseStates.get(generationKey(lease.ownerUserId, lease.resource))?.get(lease.generation);
}

function settlePendingLeasesThrough(
  ownerUserId: string,
  resource: ProgramRefreshResource,
  generation: number
): void {
  const key = generationKey(ownerUserId, resource);
  const states = leaseStates.get(key);
  if (!states) return;
  for (const [leaseGeneration, state] of states) {
    if (leaseGeneration <= generation && state.status === 'pending') {
      state.status = 'abandoned';
      state.resolve();
      states.delete(leaseGeneration);
    }
  }
  if (states.size === 0) leaseStates.delete(key);
}

export async function withProgramRefreshCommitBarrier<T>(
  ownerUserId: string,
  resource: ProgramRefreshResource,
  task: () => Promise<T>
): Promise<T> {
  const key = generationKey(ownerUserId, resource);
  const previous = commitBarrierTails.get(key) ?? Promise.resolve();
  let release = (): void => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  commitBarrierTails.set(key, tail);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (commitBarrierTails.get(key) === tail) {
      commitBarrierTails.delete(key);
    }
  }
}

export async function captureProgramRefreshLease(
  ownerUserId: string,
  resource: ProgramRefreshResource,
  session: AuthorizedSession
): Promise<ProgramRefreshLease> {
  if (session.ownerUserId !== ownerUserId || !isAuthorizedSessionCurrent(session)) {
    throw new ObsoleteAuthorizedSessionError();
  }
  const capture = () =>
    withProgramRefreshCommitBarrier(ownerUserId, resource, async () => {
      if (session.ownerUserId !== ownerUserId || !isAuthorizedSessionCurrent(session)) {
        throw new ObsoleteAuthorizedSessionError();
      }
      const generation = reserveGeneration(ownerUserId, resource);
      createLeaseState(ownerUserId, resource, generation);
      return {
        ownerUserId,
        resource,
        generation,
        session,
        ...(resource.startsWith('detail:')
          ? { libraryGeneration: readGeneration(ownerUserId, 'library') }
          : {}),
      };
    });
  return resource.startsWith('detail:')
    ? withProgramRefreshCommitBarrier(ownerUserId, 'library', capture)
    : capture();
}

function isProgramRefreshLeaseParentCurrent(lease: ProgramRefreshLease): boolean {
  return (
    !lease.resource.startsWith('detail:') ||
    (lease.libraryGeneration !== undefined &&
      lease.libraryGeneration === readGeneration(lease.ownerUserId, 'library'))
  );
}

function isLatestReservedProgramRefreshLease(lease: ProgramRefreshLease): boolean {
  return (
    lease.generation ===
    (nextGenerations.get(generationKey(lease.ownerUserId, lease.resource)) ??
      readGeneration(lease.ownerUserId, lease.resource))
  );
}

export function isProgramRefreshLeaseCurrent(lease: ProgramRefreshLease): boolean {
  if (
    !isAuthorizedSessionCurrent(lease.session) ||
    !isProgramRefreshLeaseParentCurrent(lease) ||
    !isLatestReservedProgramRefreshLease(lease) ||
    getNewerProgramRefreshLeaseSettlement(lease) !== null
  ) {
    return false;
  }
  const committedGeneration = readGeneration(lease.ownerUserId, lease.resource);
  if (committedGeneration === lease.generation) {
    return true;
  }
  return (
    lease.generation > committedGeneration && readPendingLeaseState(lease)?.status === 'pending'
  );
}

export function canProgramRefreshLeaseCommit(lease: ProgramRefreshLease): boolean {
  return (
    isAuthorizedSessionCurrent(lease.session) &&
    isProgramRefreshLeaseParentCurrent(lease) &&
    isLatestReservedProgramRefreshLease(lease) &&
    lease.generation > readGeneration(lease.ownerUserId, lease.resource) &&
    readPendingLeaseState(lease)?.status === 'pending'
  );
}

export class ObsoleteProgramRefreshLeaseError extends Error {
  constructor() {
    super('Program refresh lease became obsolete');
    this.name = 'ObsoleteProgramRefreshLeaseError';
  }
}

export function assertProgramRefreshLeaseCanCommit(lease: ProgramRefreshLease): void {
  if (!canProgramRefreshLeaseCommit(lease)) {
    throw new ObsoleteProgramRefreshLeaseError();
  }
}

export function markProgramRefreshLeaseCommitted(lease: ProgramRefreshLease): void {
  const pendingState = readPendingLeaseState(lease);
  if (
    !isProgramRefreshLeaseParentCurrent(lease) ||
    !isLatestReservedProgramRefreshLease(lease) ||
    lease.generation <= readGeneration(lease.ownerUserId, lease.resource) ||
    pendingState?.status !== 'pending'
  ) {
    throw new ObsoleteProgramRefreshLeaseError();
  }
  generations.set(generationKey(lease.ownerUserId, lease.resource), lease.generation);
  const key = generationKey(lease.ownerUserId, lease.resource);
  const states = leaseStates.get(key);
  if (pendingState.status === 'pending') {
    pendingState.status = 'committed';
    pendingState.resolve();
    states?.delete(lease.generation);
    if (states?.size === 0) leaseStates.delete(key);
  }
}

export async function abandonProgramRefreshLease(lease: ProgramRefreshLease): Promise<void> {
  await withProgramRefreshCommitBarrier(lease.ownerUserId, lease.resource, async () => {
    const key = generationKey(lease.ownerUserId, lease.resource);
    const states = leaseStates.get(key);
    const state = states?.get(lease.generation);
    if (state?.status === 'pending') {
      state.status = 'abandoned';
      state.resolve();
      states?.delete(lease.generation);
      if (states?.size === 0) leaseStates.delete(key);
    }
  });
}

export function getNewerProgramRefreshLeaseSettlement(
  lease: ProgramRefreshLease
): Promise<void> | null {
  const latestGeneration =
    nextGenerations.get(generationKey(lease.ownerUserId, lease.resource)) ??
    readGeneration(lease.ownerUserId, lease.resource);
  if (latestGeneration <= lease.generation) return null;

  const states = leaseStates.get(generationKey(lease.ownerUserId, lease.resource));
  const latestState = states?.get(latestGeneration);
  return latestState?.status === 'pending' ? latestState.settled : null;
}

export async function advanceProgramRefreshGeneration(
  ownerUserId: string,
  resource: ProgramRefreshResource
): Promise<void> {
  await withProgramRefreshMutationBarrier(ownerUserId, resource, async () => undefined);
}

export async function withProgramRefreshMutationBarrier<T>(
  ownerUserId: string,
  resource: ProgramRefreshResource,
  task: () => Promise<T>
): Promise<T> {
  return withProgramRefreshCommitBarrier(ownerUserId, resource, async () => {
    const generation = reserveGeneration(ownerUserId, resource);
    const key = generationKey(ownerUserId, resource);
    generations.set(key, generation);
    settlePendingLeasesThrough(ownerUserId, resource, generation);
    return task();
  });
}

export async function withProgramRefreshMutationBarriers<T>(
  ownerUserId: string,
  resources: readonly ProgramRefreshResource[],
  task: () => Promise<T>
): Promise<T> {
  const uniqueResources = [...new Set(resources)].sort((left, right) => {
    if (left === 'library') return right === 'library' ? 0 : -1;
    if (right === 'library') return 1;
    return left.localeCompare(right);
  });

  async function runWithBarrier(index: number): Promise<T> {
    const resource = uniqueResources[index];
    if (resource === undefined) {
      return task();
    }
    return withProgramRefreshMutationBarrier(ownerUserId, resource, () =>
      runWithBarrier(index + 1)
    );
  }

  return runWithBarrier(0);
}

export async function advanceProgramMutationGenerations(
  ownerUserId: string,
  programInstanceId: string
): Promise<void> {
  await withProgramMutationGenerationBarriers(
    ownerUserId,
    programInstanceId,
    async () => undefined
  );
}

export async function withProgramMutationGenerationBarriers<T>(
  ownerUserId: string,
  programInstanceId: string,
  task: () => Promise<T>,
  additionalResources: readonly ProgramRefreshResource[] = []
): Promise<T> {
  return withProgramRefreshMutationBarriers(
    ownerUserId,
    ['library', `detail:${programInstanceId}`, ...additionalResources],
    task
  );
}
