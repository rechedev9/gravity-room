import { createObserverSignal } from './observer-signal';
import {
  publishSyncAttempt,
  subscribeSyncAttempts,
  queueChanges,
  syncRequests,
} from './sync-events';

describe('observer publication lifetime', () => {
  it('delivers synchronously in registration order and preserves the payload', () => {
    const signal = createObserverSignal<object>();
    const payload = {};
    const calls: object[] = [];
    signal.subscribe((value) => calls.push(value));
    signal.subscribe((value) => calls.push(value));
    signal.publish(payload);
    expect(calls).toEqual([payload, payload]);
    expect(calls[0]).toBe(payload);
  });

  it('isolates an observer exception without skipping subsequent listeners', () => {
    const signal = createObserverSignal<string>();
    signal.subscribe(() => {
      throw new Error('observer failed');
    });
    const observer = jest.fn();
    signal.subscribe(observer);
    expect(() => signal.publish('owner')).not.toThrow();
    expect(observer).toHaveBeenCalledWith('owner');
  });

  it('defers subscriptions created during delivery until the next publication', () => {
    const signal = createObserverSignal<number>();
    const added = jest.fn();
    signal.subscribe(() => signal.subscribe(added));
    signal.publish(1);
    expect(added).not.toHaveBeenCalled();
    signal.publish(2);
    expect(added.mock.calls).toEqual([[2]]);
  });

  it('does not redeliver when a callback unsubscribes and resubscribes itself', () => {
    const signal = createObserverSignal<number>();
    let unsubscribe = () => {};
    const observer = jest.fn(() => {
      unsubscribe();
      unsubscribe = signal.subscribe(observer);
    });
    unsubscribe = signal.subscribe(observer);
    signal.publish(1);
    expect(observer).toHaveBeenCalledTimes(1);
    signal.publish(2);
    expect(observer).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('skips listeners removed before their turn', () => {
    const signal = createObserverSignal<number>();
    let remove = () => {};
    signal.subscribe(() => remove());
    const observer = jest.fn();
    remove = signal.subscribe(observer);
    signal.publish(1);
    expect(observer).not.toHaveBeenCalled();
  });

  it('defers a removed and recreated registration even with the same callback', () => {
    const signal = createObserverSignal<number>();
    const observer = jest.fn();
    let remove = () => {};
    const removeFirst = signal.subscribe(() => {
      remove();
      remove = signal.subscribe(observer);
    });
    remove = signal.subscribe(observer);
    signal.publish(1);
    expect(observer).not.toHaveBeenCalled();
    removeFirst();
    signal.publish(2);
    expect(observer.mock.calls).toEqual([[2]]);
  });

  it('does not let stale cleanup remove a newer registration', () => {
    const signal = createObserverSignal<number>();
    const observer = jest.fn();
    const staleRemove = signal.subscribe(observer);
    staleRemove();
    const remove = signal.subscribe(observer);
    staleRemove();
    signal.publish(1);
    expect(observer).toHaveBeenCalledTimes(1);
    remove();
    remove();
    signal.publish(2);
    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('retains callback deduplication for simultaneous subscriptions', () => {
    const signal = createObserverSignal<number>();
    const observer = jest.fn();
    const remove = signal.subscribe(observer);
    signal.subscribe(observer);
    signal.publish(1);
    expect(observer).toHaveBeenCalledTimes(1);
    remove();
    signal.publish(2);
    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('gives a nested publication its own snapshot and payload', () => {
    const signal = createObserverSignal<number>();
    const seen: number[] = [];
    signal.subscribe((value) => {
      if (value === 1) signal.publish(2);
    });
    signal.subscribe((value) => seen.push(value));
    signal.publish(1);
    expect(seen).toEqual([2, 1]);
  });
});

describe('sync event channels', () => {
  it('keeps queue changes, requests and outcomes separate', () => {
    const queue = jest.fn();
    const request = jest.fn();
    const attempt = jest.fn();
    const cleanup = [
      queueChanges.subscribe(queue),
      syncRequests.subscribe(request),
      subscribeSyncAttempts(attempt),
    ];
    try {
      queueChanges.publish('owner-a');
      expect(queue.mock.calls).toEqual([['owner-a']]);
      expect(request).not.toHaveBeenCalled();
      expect(attempt).not.toHaveBeenCalled();
      syncRequests.publish('owner-b');
      const result = { ownerId: 'owner-c', failed: true, retryable: true, retryAt: 123 };
      publishSyncAttempt(result);
      expect(request.mock.calls).toEqual([['owner-b']]);
      expect(attempt.mock.calls).toEqual([[result]]);
    } finally {
      cleanup.forEach((remove) => remove());
    }
  });
});
