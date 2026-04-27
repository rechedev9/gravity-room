import {
  acknowledgeQueuedMutations,
  clearQueuedMutations as clearQueuedMutationsFromRepository,
  listQueuedMutations,
} from './mutation-queue-repository';
import { clearQueuedMutations, flushQueuedMutations } from './mutation-sync-service';

jest.mock('./mutation-queue-repository', () => ({
  acknowledgeQueuedMutations: jest.fn(),
  clearQueuedMutations: jest.fn(),
  listQueuedMutations: jest.fn(),
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

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalExpoPublicApiUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = originalExpoPublicApiUrl;
    }
    mockedListQueuedMutations.mockReset();
    mockedAcknowledgeQueuedMutations.mockReset();
    mockedClearQueuedMutationsFromRepository.mockReset();
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
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledWith([11, 12, 13]);
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
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledWith([21]);
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
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledWith([41]);
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
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledWith([42]);
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

  it('reuses the active flush while an earlier replay is still in flight', async () => {
    const firstFetch = createDeferred<Response>();
    mockedListQueuedMutations.mockResolvedValue([
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
    const secondFlush = flushQueuedMutations('mobile-access-token');

    expect(mockedListQueuedMutations).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    firstFetch.resolve(new Response('{}', { status: 201 }));

    await expect(firstFlush).resolves.toEqual({ processedCount: 1 });
    await expect(secondFlush).resolves.toEqual({ processedCount: 1 });
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledTimes(1);
    expect(mockedAcknowledgeQueuedMutations).toHaveBeenCalledWith([61]);
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
});
