import { AppState } from 'react-native';
import { SessionUnavailableError } from '../auth/session';
import { startForegroundSync } from './foreground-sync';
import { publishSyncAttempt } from './sync-events';
import { cancelQueuedMutationFlush, flushQueuedMutations } from './mutation-sync-service';

let mockOwner = 'owner-a';
let mockToken: string | null = 'token';
let mockStateListener: ((state: string) => void) | undefined;
const mockRemove = jest.fn();
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn((_event, listener) => {
      mockStateListener = listener;
      return { remove: mockRemove };
    }),
  },
}));
jest.mock('../auth/session', () => ({
  getAccessToken: () => mockToken,
  SessionUnavailableError: class SessionUnavailableError extends Error {
    readonly retryAt: number | undefined;
    constructor(value?: number) {
      super();
      this.retryAt = value;
    }
  },
}));
jest.mock('../db/client', () => ({ getActiveLocalDataOwner: () => mockOwner }));
jest.mock('./mutation-sync-service', () => ({
  flushQueuedMutations: jest.fn(async () => ({ processedCount: 0 })),
  cancelQueuedMutationFlush: jest.fn(),
}));

describe('foreground sync lifetime', () => {
  let stop: () => void;
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockOwner = 'owner-a';
    mockToken = 'token';
    AppState.currentState = 'active';
    stop = startForegroundSync(mockOwner);
    await jest.advanceTimersByTimeAsync(0);
  });
  afterEach(() => {
    stop();
    jest.useRealTimers();
  });

  it('retries at the requested deadline while the app remains active', async () => {
    publishSyncAttempt({
      ownerId: mockOwner,
      failed: true,
      retryable: true,
      retryAt: Date.now() + 60_000,
    });
    await jest.advanceTimersByTimeAsync(59_999);
    expect(flushQueuedMutations).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(flushQueuedMutations).toHaveBeenCalledTimes(2);
  });

  it('cancels timers and requests in background and checks the queue on resume', async () => {
    publishSyncAttempt({ ownerId: mockOwner, failed: true, retryable: true });
    mockStateListener?.('background');
    expect(jest.getTimerCount()).toBe(0);
    expect(cancelQueuedMutationFlush).toHaveBeenCalledWith(mockOwner);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(flushQueuedMutations).toHaveBeenCalledTimes(1);
    mockStateListener?.('active');
    expect(flushQueuedMutations).toHaveBeenCalledTimes(2);
  });

  it('does not retry permanent rejections or cross into a different owner', async () => {
    publishSyncAttempt({ ownerId: mockOwner, failed: true, retryable: false });
    expect(jest.getTimerCount()).toBe(0);
    publishSyncAttempt({ ownerId: mockOwner, failed: true, retryable: true });
    mockOwner = 'owner-b';
    await jest.advanceTimersByTimeAsync(60_000);
    expect(flushQueuedMutations).toHaveBeenCalledTimes(1);
  });

  it('bounds long timers and releases both subscriptions when stopped', async () => {
    publishSyncAttempt({
      ownerId: mockOwner,
      failed: true,
      retryable: true,
      retryAt: Date.now() + 1e10,
    });
    await jest.advanceTimersByTimeAsync(299_999);
    expect(flushQueuedMutations).toHaveBeenCalledTimes(1);
    stop();
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    publishSyncAttempt({ ownerId: mockOwner, failed: true, retryable: true });
    expect(jest.getTimerCount()).toBe(0);
    stop = () => undefined;
  });
  it('recovers a cached session on a bounded retry before delivering edits', async () => {
    stop();
    jest.mocked(flushQueuedMutations).mockClear();
    mockToken = null;
    const recover = jest.fn(async (): Promise<void> => {
      throw new SessionUnavailableError();
    });
    stop = startForegroundSync(mockOwner, recover);
    await jest.advanceTimersByTimeAsync(0);
    expect(flushQueuedMutations).not.toHaveBeenCalled();
    expect(recover).toHaveBeenCalledTimes(1);
    recover.mockImplementation(async () => {
      mockToken = 'restored-token';
    });
    await jest.advanceTimersByTimeAsync(5_000);
    expect(flushQueuedMutations).toHaveBeenCalledWith('restored-token');
  });

  it('does not deliver after a recovery outlives its owner subscription', async () => {
    stop();
    jest.mocked(flushQueuedMutations).mockClear();
    mockToken = null;
    let finish = (): void => undefined;
    const recover = jest.fn(
      (isCurrent: () => boolean) =>
        new Promise<void>((resolve) => {
          finish = () => {
            if (isCurrent()) mockToken = 'must-not-publish';
            resolve();
          };
        })
    );
    stop = startForegroundSync(mockOwner, recover);
    stop();
    finish();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockToken).toBeNull();
    expect(flushQueuedMutations).not.toHaveBeenCalled();
    stop = () => undefined;
  });
  it('consumes resume after an older cancelled drain finishes refreshing', async () => {
    stop();
    const flush = jest.mocked(flushQueuedMutations);
    flush.mockClear();
    let finish = (): void => undefined;
    flush.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          finish = () => {
            const error = new Error('Cancelled');
            error.name = 'AbortError';
            reject(error);
          };
        })
    );
    stop = startForegroundSync(mockOwner);
    mockStateListener?.('background');
    mockStateListener?.('active');
    expect(flush).toHaveBeenCalledTimes(1);
    finish();
    await jest.advanceTimersByTimeAsync(0);
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it('schedules session recovery at the server deadline', async () => {
    stop();
    mockToken = null;
    const retryAt = Date.now() + 60_000;
    const recover = jest.fn(async (): Promise<void> => {
      throw new SessionUnavailableError(retryAt);
    });
    stop = startForegroundSync(mockOwner, recover);
    await jest.advanceTimersByTimeAsync(59_999);
    expect(recover).toHaveBeenCalledTimes(1);
    recover.mockImplementation(async () => {
      mockToken = 'recovered';
    });
    await jest.advanceTimersByTimeAsync(1);
    expect(recover).toHaveBeenCalledTimes(2);
    expect(flushQueuedMutations).toHaveBeenCalledWith('recovered');
  });
});
