import type { SessionState } from './session';
import { getAccessToken, setAccessToken } from './session';
import { secureLocalDataOwnerStorage, type LocalDataOwnerStorage } from './secure-storage';
import { activateLocalDataOwner, clearLocalAppData, deactivateLocalDataOwner } from '../db/client';
import { clearQueuedMutations, flushQueuedMutations } from '../sync/mutation-sync-service';

interface PrepareLocalSessionDependencies {
  readonly ownerStorage: LocalDataOwnerStorage;
  readonly activateOwner: (userId: string) => Promise<void>;
  readonly clearLocalData: () => Promise<void>;
  readonly clearMutations: () => Promise<void>;
  readonly deactivateOwner: () => void;
}

interface PublishLocalSessionDependencies {
  readonly publishAccessToken: (accessToken: string | null) => void;
  readonly flushMutations: (accessToken: string) => Promise<unknown>;
}

interface ClearLocalSessionDependencies {
  readonly ownerStorage: LocalDataOwnerStorage;
  readonly clearLocalData: () => Promise<void>;
  readonly clearMutations: () => Promise<void>;
  readonly deactivateOwner: () => void;
  readonly publishAccessToken: (accessToken: string | null) => void;
}

interface FlushLocalSessionDependencies {
  readonly readAccessToken: () => string | null;
  readonly flushMutations: (accessToken: string) => Promise<unknown>;
}

export interface SessionTransition {
  readonly isCurrent: () => boolean;
  readonly runExclusive: <T>(operation: () => Promise<T>) => Promise<T>;
}

export interface SessionTransitionCoordinator {
  readonly begin: () => SessionTransition;
  readonly invalidate: () => void;
}

const prepareLocalSessionDefaults: PrepareLocalSessionDependencies = {
  ownerStorage: secureLocalDataOwnerStorage,
  activateOwner: activateLocalDataOwner,
  clearLocalData: clearLocalAppData,
  clearMutations: clearQueuedMutations,
  deactivateOwner: deactivateLocalDataOwner,
};

const publishLocalSessionDefaults: PublishLocalSessionDependencies = {
  publishAccessToken: setAccessToken,
  flushMutations: flushQueuedMutations,
};

const clearLocalSessionDefaults: ClearLocalSessionDependencies = {
  ownerStorage: secureLocalDataOwnerStorage,
  clearLocalData: clearLocalAppData,
  clearMutations: clearQueuedMutations,
  deactivateOwner: deactivateLocalDataOwner,
  publishAccessToken: setAccessToken,
};

const flushLocalSessionDefaults: FlushLocalSessionDependencies = {
  readAccessToken: getAccessToken,
  flushMutations: flushQueuedMutations,
};

const alwaysCurrentTransition: Pick<SessionTransition, 'isCurrent'> = {
  isCurrent: () => true,
};

/**
 * Serializes credential-changing work while making the most recently started
 * transition authoritative. A newer transition invalidates older work
 * immediately; its remote action then waits for the previous action to settle
 * so durable credentials cannot be written out of order.
 */
export function createSessionTransitionCoordinator(): SessionTransitionCoordinator {
  let latestTransitionId = 0;
  let transitionTail = Promise.resolve();

  return {
    begin() {
      const transitionId = ++latestTransitionId;

      return {
        isCurrent: () => transitionId === latestTransitionId,
        runExclusive: async <T>(operation: () => Promise<T>): Promise<T> => {
          const result = transitionTail.then(operation, operation);
          transitionTail = result.then(
            () => undefined,
            () => undefined
          );
          return result;
        },
      };
    },
    invalidate() {
      latestTransitionId += 1;
    },
  };
}

/**
 * Claims the offline store for a session before publishing its access token.
 * No owner-scoped repository or request can observe the new account until its
 * durable owner marker and SQLite schema are ready.
 */
export async function prepareLocalSession(
  userId: string,
  transition: Pick<SessionTransition, 'isCurrent'> = alwaysCurrentTransition,
  dependencies: PrepareLocalSessionDependencies = prepareLocalSessionDefaults
): Promise<boolean> {
  if (!transition.isCurrent()) {
    return false;
  }

  dependencies.deactivateOwner();

  const ownerId = await dependencies.ownerStorage.getOwnerId();
  if (!transition.isCurrent()) {
    return false;
  }

  if (ownerId !== userId) {
    // Unclaimed legacy rows are not safe to adopt: they may belong to a previous
    // account whose marker was lost. Clear every partition before reassignment.
    await dependencies.clearMutations();
    if (!transition.isCurrent()) {
      return false;
    }

    await dependencies.clearLocalData();
    if (!transition.isCurrent()) {
      return false;
    }

    await dependencies.ownerStorage.setOwnerId(userId);
    if (!transition.isCurrent()) {
      return false;
    }
  }

  await dependencies.activateOwner(userId);
  if (!transition.isCurrent()) {
    dependencies.deactivateOwner();
    return false;
  }

  return true;
}

/** Publishes a prepared session and starts a non-blocking outbox flush. */
export function publishLocalSession(
  session: SessionState,
  transition: Pick<SessionTransition, 'isCurrent'> = alwaysCurrentTransition,
  dependencies: PublishLocalSessionDependencies = publishLocalSessionDefaults
): boolean {
  if (!transition.isCurrent()) {
    return false;
  }

  dependencies.publishAccessToken(session.accessToken);

  void dependencies.flushMutations(session.accessToken).catch(() => {
    // The outbox remains durable and will retry on the next foreground event.
  });

  return true;
}

/**
 * Removes account-scoped local state after durable credentials were deleted.
 * Cleanup is best-effort, but the owner marker is retained if either store
 * fails so a subsequent account transition must retry isolation first.
 */
export async function clearLocalSession(
  dependencies: ClearLocalSessionDependencies = clearLocalSessionDefaults
): Promise<void> {
  dependencies.deactivateOwner();
  dependencies.publishAccessToken(null);

  let mutationsCleared = false;
  let localDataCleared = false;

  try {
    await dependencies.clearMutations();
    mutationsCleared = true;
  } catch {
    // Retain the owner marker so the next login must retry cleanup.
  }

  try {
    await dependencies.clearLocalData();
    localDataCleared = true;
  } catch {
    // Retain the owner marker so the next login must retry cleanup.
  }

  if (mutationsCleared && localDataCleared) {
    try {
      await dependencies.ownerStorage.clearOwnerId();
    } catch {
      // A stale marker is safe: the next account clears empty data before use.
    }
  }
}

/** Flushes the active account's outbox when an access token is available. */
export async function flushLocalSessionMutations(
  dependencies: FlushLocalSessionDependencies = flushLocalSessionDefaults
): Promise<void> {
  const accessToken = dependencies.readAccessToken();
  if (!accessToken) {
    return;
  }

  await dependencies.flushMutations(accessToken);
}
