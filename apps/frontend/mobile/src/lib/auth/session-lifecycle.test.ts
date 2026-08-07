import type { SessionState } from './session';
import {
  clearLocalSession,
  createSessionTransitionCoordinator,
  flushLocalSessionMutations,
  prepareLocalSession,
  publishLocalSession,
} from './session-lifecycle';

const SESSION: SessionState = {
  accessToken: 'access-token',
  user: {
    id: 'user-123',
    email: 'athlete@example.com',
    name: 'Test Athlete',
    avatarUrl: null,
  },
};

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => {
    throw new Error('Deferred promise was not initialized');
  };
  let reject: (reason?: unknown) => void = () => {
    throw new Error('Deferred promise was not initialized');
  };
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

function createOwnerStorage(ownerId: string | null) {
  return {
    getOwnerId: jest.fn<Promise<string | null>, []>().mockResolvedValue(ownerId),
    setOwnerId: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
    clearOwnerId: jest.fn<Promise<void>, []>().mockResolvedValue(),
  };
}

function createPreparationDependencies(ownerId: string | null) {
  return {
    ownerStorage: createOwnerStorage(ownerId),
    activateOwner: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
    clearLocalData: jest.fn<Promise<void>, []>().mockResolvedValue(),
    clearMutations: jest.fn<Promise<void>, []>().mockResolvedValue(),
    deactivateOwner: jest.fn<void, []>(),
  };
}

describe('prepareLocalSession', () => {
  it.each([
    { currentOwner: 'user-123', clearsAccountData: false },
    { currentOwner: 'another-user', clearsAccountData: true },
    { currentOwner: null, clearsAccountData: true },
  ])(
    'prepares ownership when current owner is $currentOwner',
    async ({ currentOwner, clearsAccountData }) => {
      const dependencies = createPreparationDependencies(currentOwner);

      await prepareLocalSession(SESSION.user.id, undefined, dependencies);

      expect(dependencies.deactivateOwner).toHaveBeenCalledTimes(1);
      expect(dependencies.clearMutations).toHaveBeenCalledTimes(clearsAccountData ? 1 : 0);
      expect(dependencies.clearLocalData).toHaveBeenCalledTimes(clearsAccountData ? 1 : 0);
      expect(dependencies.ownerStorage.setOwnerId).toHaveBeenCalledTimes(clearsAccountData ? 1 : 0);
      expect(dependencies.activateOwner).toHaveBeenCalledWith('user-123');
    }
  );

  it('isolates account data before activating its owner', async () => {
    const dependencies = createPreparationDependencies('another-user');

    await prepareLocalSession(SESSION.user.id, undefined, dependencies);

    const mutationClearOrder = dependencies.clearMutations.mock.invocationCallOrder[0] ?? 0;
    const localClearOrder = dependencies.clearLocalData.mock.invocationCallOrder[0] ?? 0;
    const markerOrder = dependencies.ownerStorage.setOwnerId.mock.invocationCallOrder[0] ?? 0;
    const activationOrder = dependencies.activateOwner.mock.invocationCallOrder[0] ?? 0;

    expect(mutationClearOrder).toBeLessThan(localClearOrder);
    expect(localClearOrder).toBeLessThan(markerOrder);
    expect(markerOrder).toBeLessThan(activationOrder);
  });

  it.each([
    {
      name: 'owner marker read',
      fail: (dependencies: ReturnType<typeof createPreparationDependencies>) =>
        dependencies.ownerStorage.getOwnerId.mockRejectedValue(new Error('SecureStore failed')),
    },
    {
      name: 'mutation cleanup',
      fail: (dependencies: ReturnType<typeof createPreparationDependencies>) =>
        dependencies.clearMutations.mockRejectedValue(new Error('outbox failed')),
    },
    {
      name: 'local data cleanup',
      fail: (dependencies: ReturnType<typeof createPreparationDependencies>) =>
        dependencies.clearLocalData.mockRejectedValue(new Error('SQLite cleanup failed')),
    },
    {
      name: 'owner marker write',
      fail: (dependencies: ReturnType<typeof createPreparationDependencies>) =>
        dependencies.ownerStorage.setOwnerId.mockRejectedValue(new Error('SecureStore failed')),
    },
    {
      name: 'owner activation',
      fail: (dependencies: ReturnType<typeof createPreparationDependencies>) =>
        dependencies.activateOwner.mockRejectedValue(new Error('SQLite failed')),
    },
  ])('does not publish the session when $name fails', async ({ fail }) => {
    const dependencies = createPreparationDependencies('another-user');
    fail(dependencies);

    await expect(
      prepareLocalSession(SESSION.user.id, undefined, dependencies)
    ).rejects.toBeInstanceOf(Error);
  });

  it('deactivates an owner prepared by a transition superseded during activation', async () => {
    const coordinator = createSessionTransitionCoordinator();
    const transition = coordinator.begin();
    const activation = createDeferred<void>();
    const dependencies = createPreparationDependencies('user-123');
    dependencies.activateOwner.mockReturnValue(activation.promise);

    const preparation = prepareLocalSession(SESSION.user.id, transition, dependencies);
    await Promise.resolve();
    expect(dependencies.activateOwner).toHaveBeenCalledWith('user-123');

    coordinator.begin();
    activation.resolve();

    await expect(preparation).resolves.toBe(false);
    expect(dependencies.deactivateOwner).toHaveBeenCalledTimes(2);
  });
});

describe('publishLocalSession', () => {
  it('publishes the token before starting a non-blocking flush', () => {
    const publishAccessToken = jest.fn<void, [string | null]>();
    const flushMutations = jest.fn<Promise<unknown>, [string]>().mockResolvedValue(undefined);

    publishLocalSession(SESSION, undefined, { publishAccessToken, flushMutations });

    expect(publishAccessToken).toHaveBeenCalledWith('access-token');
    expect(flushMutations).toHaveBeenCalledWith('access-token');
    expect(publishAccessToken.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      flushMutations.mock.invocationCallOrder[0] ?? 0
    );
  });
});

describe('createSessionTransitionCoordinator', () => {
  it('serializes transitions while immediately superseding older work', async () => {
    const coordinator = createSessionTransitionCoordinator();
    const firstGate = createDeferred<void>();
    const executionOrder: string[] = [];
    const first = coordinator.begin();
    const firstRun = first.runExclusive(async () => {
      executionOrder.push('first:start');
      await firstGate.promise;
      executionOrder.push(first.isCurrent() ? 'first:current' : 'first:superseded');
    });

    await Promise.resolve();
    const second = coordinator.begin();
    const secondRun = second.runExclusive(async () => {
      executionOrder.push('second:start');
      executionOrder.push(second.isCurrent() ? 'second:current' : 'second:superseded');
    });

    expect(first.isCurrent()).toBe(false);
    expect(executionOrder).toEqual(['first:start']);

    firstGate.resolve();
    await Promise.all([firstRun, secondRun]);

    expect(executionOrder).toEqual([
      'first:start',
      'first:superseded',
      'second:start',
      'second:current',
    ]);
  });
});

describe('clearLocalSession', () => {
  it.each([
    { mutationCleanupFails: false, localCleanupFails: false, clearsOwnerMarker: true },
    { mutationCleanupFails: true, localCleanupFails: false, clearsOwnerMarker: false },
    { mutationCleanupFails: false, localCleanupFails: true, clearsOwnerMarker: false },
    { mutationCleanupFails: true, localCleanupFails: true, clearsOwnerMarker: false },
  ])(
    'retains safe ownership when cleanup failures are mutation=$mutationCleanupFails local=$localCleanupFails',
    async ({ mutationCleanupFails, localCleanupFails, clearsOwnerMarker }) => {
      const ownerStorage = createOwnerStorage('user-123');
      const clearMutations = jest.fn<Promise<void>, []>().mockResolvedValue();
      const clearLocalData = jest.fn<Promise<void>, []>().mockResolvedValue();
      if (mutationCleanupFails) {
        clearMutations.mockRejectedValue(new Error('outbox failed'));
      }
      if (localCleanupFails) {
        clearLocalData.mockRejectedValue(new Error('SQLite failed'));
      }
      const dependencies = {
        ownerStorage,
        clearLocalData,
        clearMutations,
        deactivateOwner: jest.fn<void, []>(),
        publishAccessToken: jest.fn<void, [string | null]>(),
      };

      await clearLocalSession(dependencies);

      expect(dependencies.deactivateOwner).toHaveBeenCalledTimes(1);
      expect(dependencies.publishAccessToken).toHaveBeenCalledWith(null);
      expect(clearMutations).toHaveBeenCalledTimes(1);
      expect(clearLocalData).toHaveBeenCalledTimes(1);
      expect(ownerStorage.clearOwnerId).toHaveBeenCalledTimes(clearsOwnerMarker ? 1 : 0);
    }
  );
});

describe('flushLocalSessionMutations', () => {
  it.each([
    { accessToken: null, expectedFlushes: 0 },
    { accessToken: 'access-token', expectedFlushes: 1 },
  ])('flushes only when an access token exists', async ({ accessToken, expectedFlushes }) => {
    const flushMutations = jest.fn<Promise<unknown>, [string]>().mockResolvedValue(undefined);

    await flushLocalSessionMutations({
      readAccessToken: () => accessToken,
      flushMutations,
    });

    expect(flushMutations).toHaveBeenCalledTimes(expectedFlushes);
    if (accessToken) {
      expect(flushMutations).toHaveBeenCalledWith(accessToken);
    }
  });
});
