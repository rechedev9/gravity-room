import { readSyncBackoff, recordSyncBackoff } from './sync-backoff-repository';
import {
  type QueuedMutation,
  acknowledgeQueuedMutations,
  clearQueuedMutations as clearQueuedMutationsFromRepository,
  listQueuedMutations,
  markQueuedMutationFailure,
} from './mutation-queue-repository';
import {
  cancelQueuedMutationFlush,
  clearQueuedMutations,
  flushQueuedMutations,
} from './mutation-sync-service';

jest.mock('./sync-backoff-repository', () => ({
  readSyncBackoff: jest.fn(async () => 0),
  recordSyncBackoff: jest.fn(async () => Date.now() + 5000),
  clearSyncBackoff: jest.fn(async () => undefined),
}));

jest.mock('./mutation-queue-repository', () => ({
  MUTATION_BATCH_SIZE: 50,
  acknowledgeQueuedMutations: jest.fn(),
  clearQueuedMutations: jest.fn(),
  listQueuedMutations: jest.fn(),
  markQueuedMutationFailure: jest.fn(),
}));

let mockActiveOwnerId = 'user-123';

jest.mock('../db/client', () => ({
  requireActiveLocalDataOwner: jest.fn(() => mockActiveOwnerId),
}));

const mockedListQueuedMutations = jest.mocked(listQueuedMutations);
const mockedAcknowledgeQueuedMutations = jest.mocked(acknowledgeQueuedMutations);
const mockedClearQueuedMutationsFromRepository = jest.mocked(clearQueuedMutationsFromRepository);

function createDeferred<T>() {
  let resolvePromise: ((value: T | PromiseLike<T>) => void) | null = null;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve(value: T) {
      if (resolvePromise === null) {
        throw new Error('Expected deferred promise resolver to be initialized');
      }

      resolvePromise(value);
    },
  };
}

function expectAuthorizationHeader(
  init: RequestInit | undefined,
  token: string,
  contentType = 'application/json'
): void {
  const headers = init?.headers;
  if (!(headers instanceof Headers)) {
    throw new Error('Expected request headers to be a Headers instance');
  }

  expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
  expect(headers.get('Content-Type')).toBe(contentType);
}

describe('flushQueuedMutations', () => {
  const originalFetch = globalThis.fetch;
  const originalExpoPublicApiUrl = process.env.EXPO_PUBLIC_API_URL;

  afterEach(async () => {
    await clearQueuedMutations();
    globalThis.fetch = originalFetch;
    if (originalExpoPublicApiUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = originalExpoPublicApiUrl;
    }
    mockedListQueuedMutations.mockReset();
    jest.mocked(readSyncBackoff).mockReset().mockResolvedValue(0);
    jest.mocked(recordSyncBackoff).mockClear();
    jest.mocked(markQueuedMutationFailure).mockReset();
    mockedAcknowledgeQueuedMutations.mockReset();
    mockedClearQueuedMutationsFromRepository.mockReset();
    mockActiveOwnerId = 'user-123';
  });

  it('honors a persisted pause before inspecting or sending any newer edit', async () => {
    jest.mocked(readSyncBackoff).mockResolvedValueOnce(Date.now() + 60000);
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    await expect(flushQueuedMutations('mobile-access-token')).rejects.toThrow('waiting to retry');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockedListQueuedMutations).not.toHaveBeenCalled();
  });

  it('persists Retry-After for the whole owner when the server rate limits a mutation', async () => {
    mockedListQueuedMutations.mockResolvedValueOnce([
      {
        id: 1,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'record-result',
        payload: { workoutIndex: 0, slotId: 'squat', result: 'success' },
        createdAt: '2026-09-05',
      },
    ]);
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '60' } }));
    const before = Date.now();
    await expect(flushQueuedMutations('mobile-access-token')).rejects.toThrow('status 429');
    const retryAt = jest.mocked(recordSyncBackoff).mock.calls[0]?.[1];
    expect(retryAt).toBeGreaterThanOrEqual(before + 60000);
    expect(retryAt).toBeLessThanOrEqual(Date.now() + 60000);
    expect(mockedAcknowledgeQueuedMutations).not.toHaveBeenCalled();
  });

  it('keeps Retry-After in memory when persisting it fails, including for new callers', async () => {
    mockedListQueuedMutations.mockResolvedValueOnce([
      {
        id: 1,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'record-result',
        payload: { workoutIndex: 0, slotId: 'squat', result: 'success' },
        createdAt: '2026-09-05',
      },
    ]);
    jest.mocked(recordSyncBackoff).mockRejectedValueOnce(new Error('database is locked'));
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', {
        status: 429,
        headers: { 'Retry-After': '60' },
      })
    );
    await expect(flushQueuedMutations('mobile-access-token')).rejects.toThrow('database is locked');
    await expect(flushQueuedMutations('mobile-access-token')).rejects.toThrow('waiting to retry');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(mockedAcknowledgeQueuedMutations).not.toHaveBeenCalled();
  });

  it('clears all queued mutations through the repository', async () => {
    mockedClearQueuedMutationsFromRepository.mockResolvedValue();

    await expect(clearQueuedMutations()).resolves.toBeUndefined();

    expect(mockedClearQueuedMutationsFromRepository).toHaveBeenCalledTimes(1);
  });

  it('aborts an active flush when queued mutations are cleared', async () => {
    mockedListQueuedMutations.mockResolvedValue([
      {
        id: 1,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'record-result',
        payload: {
          workoutIndex: 0,
          slotId: 'squat-t1',
          result: 'success',
        },
        createdAt: '2026-04-20T10:00:00.000Z',
      },
    ]);
    mockedClearQueuedMutationsFromRepository.mockResolvedValue();

    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy.mockImplementation((_input, init) => {
      const signal = init?.signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          const error = new Error('Queued mutation flush aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });

    const flushPromise = flushQueuedMutations('mobile-access-token');
    await Promise.resolve();
    await Promise.resolve();

    await clearQueuedMutations();

    await expect(flushPromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockedClearQueuedMutationsFromRepository).toHaveBeenCalledTimes(1);
  });

  it('replays queued mutations to the matching snapshot endpoints and acknowledges them', async () => {
    mockedListQueuedMutations.mockResolvedValue([
      {
        id: 11,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'record-result',
        payload: {
          workoutIndex: 0,
          slotId: 'squat-t1',
          result: 'success',
        },
        createdAt: '2026-04-20T10:00:00.000Z',
      },
      {
        id: 12,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'update-metadata',
        payload: {
          metadata: {
            graduationDismissed: true,
          },
        },
        createdAt: '2026-04-20T10:01:00.000Z',
      },
      {
        id: 13,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'delete-result',
        payload: {
          workoutIndex: 2,
          slotId: 'bench-t2',
        },
        createdAt: '2026-04-20T10:02:00.000Z',
      },
    ]);

    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(flushQueuedMutations('mobile-access-token')).resolves.toEqual({
      processedCount: 3,
    });

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3001/api/programs/instance-1/results',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          workoutIndex: 0,
          slotId: 'squat-t1',
          result: 'success',
        }),
      })
    );
    expectAuthorizationHeader(fetchSpy.mock.calls[0]?.[1], 'mobile-access-token');
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3001/api/programs/instance-1/metadata',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          metadata: {
            graduationDismissed: true,
          },
        }),
      })
    );
    expectAuthorizationHeader(fetchSpy.mock.calls[1]?.[1], 'mobile-access-token');
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3001/api/programs/instance-1/results/2/bench-t2',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
    expectAuthorizationHeader(fetchSpy.mock.calls[2]?.[1], 'mobile-access-token');
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledWith([11, 12, 13], 'user-123');
  });

  it('stops at the first failed mutation and only acknowledges earlier successes', async () => {
    mockedListQueuedMutations.mockResolvedValue([
      {
        id: 21,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'record-result',
        payload: {
          workoutIndex: 0,
          slotId: 'squat-t1',
          result: 'success',
        },
        createdAt: '2026-04-20T10:00:00.000Z',
      },
      {
        id: 22,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'delete-result',
        payload: {
          workoutIndex: 2,
          slotId: 'bench-t2',
        },
        createdAt: '2026-04-20T10:01:00.000Z',
      },
      {
        id: 23,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'update-metadata',
        payload: {
          metadata: {
            graduationDismissed: true,
          },
        },
        createdAt: '2026-04-20T10:02:00.000Z',
      },
    ]);

    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
      .mockResolvedValueOnce(new Response('nope', { status: 500 }));

    await expect(flushQueuedMutations('mobile-access-token')).rejects.toThrow(
      'Queued mutation sync failed with status 500'
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledWith([21], 'user-123');
  });

  it('retains corrupt outbox rows and continues with an unrelated plan', async () => {
    mockedListQueuedMutations.mockResolvedValue([
      {
        id: 24,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'record-result',
        payload: {},
        payloadValid: false,
        createdAt: '2026-04-20T10:00:00.000Z',
      },
      {
        id: 25,
        entityType: 'program-instance',
        entityId: 'instance-2',
        operation: 'record-result',
        payload: {
          workoutIndex: 1,
          slotId: 'bench-t1',
          result: 'success',
        },
        createdAt: '2026-04-20T10:01:00.000Z',
      },
    ]);
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 201 }));

    await expect(flushQueuedMutations('mobile-access-token')).rejects.toThrow(
      'Invalid queued mutation envelope'
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledWith([25], 'user-123');
  });

  it('retains a rejected plan in order while delivering another plan', async () => {
    const first: QueuedMutation = {
      id: 1,
      entityId: 'rejected-plan',
      entityType: 'program-instance',
      operation: 'record-result',
      payload: { workoutIndex: 0, slotId: 'squat', result: 'success' },
      createdAt: '2026-09-05',
    };
    mockedListQueuedMutations.mockResolvedValueOnce([
      first,
      { ...first, id: 2, operation: 'delete-result' },
      { ...first, id: 3, entityId: 'other-plan' },
    ]);
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 403 }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }));
    await expect(flushQueuedMutations('mobile-access-token')).rejects.toThrow('status 403');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(markQueuedMutationFailure).toHaveBeenCalledWith(1, 'HTTP_403', 'user-123');
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledWith([3], 'user-123');
  });

  it('advances past a full retained page so an unrelated plan is not starved', async () => {
    const first: QueuedMutation = {
      id: 1,
      entityId: 'rejected-plan',
      entityType: 'program-instance',
      operation: 'record-result',
      payload: {},
      payloadValid: false,
      createdAt: '2026-09-05',
    };
    mockedListQueuedMutations
      .mockResolvedValueOnce(
        Array.from({ length: 50 }, (_, index) => ({ ...first, id: index + 1 }))
      )
      .mockResolvedValueOnce([
        {
          ...first,
          id: 51,
          entityId: 'other-plan',
          payloadValid: true,
          payload: { workoutIndex: 0, slotId: 'squat', result: 'success' },
        },
      ]);
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 201 }));
    await expect(flushQueuedMutations('mobile-access-token')).rejects.toThrow(
      'Invalid queued mutation envelope'
    );
    expect(mockedListQueuedMutations).toHaveBeenNthCalledWith(2, 'user-123', 50);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledWith([51], 'user-123');
  });

  it('replays record-result mutations with optional amrapReps and rpe fields', async () => {
    mockedListQueuedMutations.mockResolvedValue([
      {
        id: 31,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'record-result',
        payload: {
          workoutIndex: 0,
          slotId: 'squat-t1',
          result: 'success',
          amrapReps: 8,
          rpe: 9,
        },
        createdAt: '2026-04-20T10:00:00.000Z',
      },
    ]);

    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 201 }));

    await expect(flushQueuedMutations('mobile-access-token')).resolves.toEqual({
      processedCount: 1,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/api/programs/instance-1/results',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          workoutIndex: 0,
          slotId: 'squat-t1',
          result: 'success',
          amrapReps: 8,
          rpe: 9,
        }),
      })
    );
  });

  it('replays record-result mutations with setLogs in the request body', async () => {
    mockedListQueuedMutations.mockResolvedValue([
      {
        id: 32,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'record-result',
        payload: {
          workoutIndex: 0,
          slotId: 'squat-t1',
          result: 'success',
          setLogs: [
            {
              reps: 5,
              weight: 100,
              rpe: 8,
            },
            {
              reps: 5,
              weight: 100,
            },
          ],
        },
        createdAt: '2026-04-20T10:00:00.000Z',
      },
    ]);

    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 201 }));

    await expect(flushQueuedMutations('mobile-access-token')).resolves.toEqual({
      processedCount: 1,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/api/programs/instance-1/results',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          workoutIndex: 0,
          slotId: 'squat-t1',
          result: 'success',
          setLogs: [
            {
              reps: 5,
              weight: 100,
              rpe: 8,
            },
            {
              reps: 5,
              weight: 100,
            },
          ],
        }),
      })
    );
  });

  it('encodes entityId path segments when replaying queued mutations', async () => {
    mockedListQueuedMutations.mockResolvedValue([
      {
        id: 33,
        entityType: 'program-instance',
        entityId: 'instance/1 value',
        operation: 'record-result',
        payload: {
          workoutIndex: 0,
          slotId: 'squat-t1',
          result: 'success',
        },
        createdAt: '2026-04-20T10:00:00.000Z',
      },
    ]);

    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 201 }));

    await expect(flushQueuedMutations('mobile-access-token')).resolves.toEqual({
      processedCount: 1,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/api/programs/instance%2F1%20value/results',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('replays delete-result mutations to the delete endpoint and acknowledges them', async () => {
    mockedListQueuedMutations.mockResolvedValue([
      {
        id: 41,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'delete-result',
        payload: {
          workoutIndex: 2,
          slotId: 'bench/t2 heavy',
        },
        createdAt: '2026-04-20T10:00:00.000Z',
      },
    ]);

    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(flushQueuedMutations('mobile-access-token')).resolves.toEqual({
      processedCount: 1,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/api/programs/instance-1/results/2/bench%2Ft2%20heavy',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
    expectAuthorizationHeader(fetchSpy.mock.calls[0]?.[1], 'mobile-access-token');
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledWith([41], 'user-123');
  });

  it('treats replayed delete-result 404 responses as already applied and acknowledges them', async () => {
    mockedListQueuedMutations.mockResolvedValue([
      {
        id: 42,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'delete-result',
        payload: {
          workoutIndex: 2,
          slotId: 'bench-t2',
        },
        createdAt: '2026-04-20T10:00:00.000Z',
      },
    ]);

    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response('missing', { status: 404 }));

    await expect(flushQueuedMutations('mobile-access-token')).resolves.toEqual({
      processedCount: 1,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/api/programs/instance-1/results/2/bench-t2',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledWith([42], 'user-123');
  });

  it('preserves an EXPO_PUBLIC_API_URL path prefix when replaying queued mutations', async () => {
    mockedListQueuedMutations.mockResolvedValue([
      {
        id: 51,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'record-result',
        payload: {
          workoutIndex: 0,
          slotId: 'squat-t1',
          result: 'success',
        },
        createdAt: '2026-04-20T10:00:00.000Z',
      },
    ]);
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/mobile-api';

    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 201 }));

    await flushQueuedMutations('mobile-access-token');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/mobile-api/programs/instance-1/results',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('drains an edit queued during upload before joined refresh callers resume', async () => {
    const upload = createDeferred<Response>();
    const first: QueuedMutation = {
      id: 71,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'record-result',
      payload: { workoutIndex: 0, slotId: 'squat-t1', result: 'success' },
      createdAt: '2026-09-05',
    };
    const later: QueuedMutation = { ...first, id: 72, operation: 'delete-result' };
    mockedListQueuedMutations.mockResolvedValueOnce([first]).mockResolvedValueOnce([later]);
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(upload.promise)
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const running = flushQueuedMutations('mobile-access-token');
    await Promise.resolve();
    await Promise.resolve();
    const joined = flushQueuedMutations('mobile-access-token');
    upload.resolve(new Response('{}', { status: 201 }));
    await expect(running).resolves.toEqual({ processedCount: 2 });
    await expect(joined).resolves.toEqual({ processedCount: 2 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenLastCalledWith([72], 'user-123');
  });

  it('preserves a drain request arriving while SQLite is reading a partial batch', async () => {
    const read = createDeferred<QueuedMutation[]>();
    mockedListQueuedMutations.mockReturnValueOnce(read.promise).mockResolvedValueOnce([]);
    const running = flushQueuedMutations('mobile-access-token');
    await Promise.resolve();
    const joined = flushQueuedMutations('mobile-access-token');
    read.resolve([]);
    await expect(running).resolves.toEqual({ processedCount: 0 });
    await expect(joined).resolves.toEqual({ processedCount: 0 });
    expect(mockedListQueuedMutations).toHaveBeenCalledTimes(2);
  });

  it('drains a second page without needing another caller when the first page is full', async () => {
    const rows: QueuedMutation[] = Array.from({ length: 50 }, (_, id) => ({
      id,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'delete-result',
      payload: { workoutIndex: id, slotId: 'slot' },
      createdAt: '2026-09-05',
    }));
    mockedListQueuedMutations.mockResolvedValueOnce(rows).mockResolvedValueOnce([
      {
        id: 51,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'delete-result',
        payload: { workoutIndex: 50, slotId: 'slot' },
        createdAt: '2026-09-05',
      },
    ]);
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(null, { status: 204 }));
    await expect(flushQueuedMutations('mobile-access-token')).resolves.toEqual({
      processedCount: 51,
    });
    expect(mockedListQueuedMutations).toHaveBeenCalledTimes(2);
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenLastCalledWith([51], 'user-123');
  });

  it('reuses the active flush while an earlier replay is still in flight', async () => {
    const firstFetch = createDeferred<Response>();
    mockedListQueuedMutations.mockResolvedValue([]).mockResolvedValueOnce([
      {
        id: 61,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'record-result',
        payload: {
          workoutIndex: 0,
          slotId: 'squat-t1',
          result: 'success',
        },
        createdAt: '2026-04-20T10:00:00.000Z',
      },
    ]);

    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy.mockImplementation(() => firstFetch.promise);

    const firstFlush = flushQueuedMutations('mobile-access-token');
    await Promise.resolve();
    await Promise.resolve();
    const secondFlush = flushQueuedMutations('mobile-access-token');

    expect(mockedListQueuedMutations).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    firstFetch.resolve(new Response('{}', { status: 201 }));

    await expect(firstFlush).resolves.toEqual({ processedCount: 1 });
    await expect(secondFlush).resolves.toEqual({ processedCount: 1 });
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledTimes(1);
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledWith([61], 'user-123');
  });

  it('aborts an old-owner flush instead of reusing it for a new owner', async () => {
    mockedListQueuedMutations.mockResolvedValue([
      {
        id: 70,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'record-result',
        payload: {
          workoutIndex: 0,
          slotId: 'squat-t1',
          result: 'success',
        },
        createdAt: '2026-04-20T10:00:00.000Z',
      },
    ]);

    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy
      .mockImplementationOnce((_input, init) => {
        const signal = init?.signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            const error = new Error('Old-owner flush aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      })
      .mockResolvedValueOnce(new Response('{}', { status: 201 }));

    const oldOwnerFlush = flushQueuedMutations('shared-test-token');
    await Promise.resolve();
    await Promise.resolve();
    mockActiveOwnerId = 'user-456';
    const newOwnerFlush = flushQueuedMutations('shared-test-token');

    await expect(oldOwnerFlush).rejects.toMatchObject({ name: 'AbortError' });
    await expect(newOwnerFlush).resolves.toEqual({ processedCount: 1 });
    expect(mockedListQueuedMutations).toHaveBeenNthCalledWith(1, 'user-123', 0);
    expect(mockedListQueuedMutations).toHaveBeenNthCalledWith(2, 'user-456', 0);
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledWith([70], 'user-456');
  });

  it('starts a new flush when the access token changes', async () => {
    mockedListQueuedMutations.mockResolvedValue([
      {
        id: 71,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'record-result',
        payload: {
          workoutIndex: 0,
          slotId: 'squat-t1',
          result: 'success',
        },
        createdAt: '2026-04-20T10:00:00.000Z',
      },
    ]);

    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy
      .mockImplementationOnce((_input, init) => {
        const signal = init?.signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            const error = new Error('Queued mutation flush aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      })
      .mockResolvedValueOnce(new Response('{}', { status: 201 }));

    const firstFlush = flushQueuedMutations('mobile-access-token');
    await Promise.resolve();
    await Promise.resolve();

    const secondFlush = flushQueuedMutations('rotated-access-token');

    await expect(firstFlush).rejects.toMatchObject({ name: 'AbortError' });
    await expect(secondFlush).resolves.toEqual({ processedCount: 1 });

    expect(mockedListQueuedMutations).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3001/api/programs/instance-1/results',
      expect.objectContaining({})
    );
    expectAuthorizationHeader(fetchSpy.mock.calls[0]?.[1], 'mobile-access-token');
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3001/api/programs/instance-1/results',
      expect.objectContaining({})
    );
    expectAuthorizationHeader(fetchSpy.mock.calls[1]?.[1], 'rotated-access-token');
  });

  it('skips ack work when there is nothing queued', async () => {
    mockedListQueuedMutations.mockResolvedValue([]);
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(flushQueuedMutations('mobile-access-token')).resolves.toEqual({
      processedCount: 0,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockedAcknowledgeQueuedMutations).not.toHaveBeenCalled();
  });
  it('rebases memory and durable pauses together after a backward clock correction', async () => {
    let now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('Network unavailable'));
    mockedListQueuedMutations.mockResolvedValueOnce([
      {
        id: 90,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'record-result',
        payload: { workoutIndex: 0, slotId: 'squat', result: 'success' },
        createdAt: '2026-09-05',
      },
    ]);
    try {
      await expect(flushQueuedMutations('token')).rejects.toThrow();
      now -= 3_600_000;
      jest.mocked(readSyncBackoff).mockResolvedValueOnce(now + 5000);
      const reads = jest.mocked(readSyncBackoff).mock.calls.length;
      await expect(flushQueuedMutations('token')).rejects.toThrow('waiting to retry');
      expect(readSyncBackoff).toHaveBeenCalledTimes(reads + 1);
      now += 5001;
      mockedListQueuedMutations.mockResolvedValue([]);
      await expect(flushQueuedMutations('token')).resolves.toEqual({ processedCount: 0 });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      clock.mockRestore();
    }
  });
  it('starts a fresh drain instead of joining a same-owner cancelled request', async () => {
    mockedListQueuedMutations.mockResolvedValue([
      {
        id: 91,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'record-result',
        payload: { workoutIndex: 0, slotId: 'squat', result: 'success' },
        createdAt: '2026-09-05',
      },
    ]);
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              const error = new Error('Cancelled');
              error.name = 'AbortError';
              reject(error);
            });
          })
      )
      .mockResolvedValueOnce(new Response('{}', { status: 201 }));
    const previous = flushQueuedMutations('same-token');
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    cancelQueuedMutationFlush('user-123');
    const resumed = flushQueuedMutations('same-token');
    await expect(previous).rejects.toMatchObject({ name: 'AbortError' });
    await expect(resumed).resolves.toEqual({ processedCount: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledWith([91], 'user-123');
  });
});
