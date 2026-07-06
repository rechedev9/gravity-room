/**
 * singleflight.ts unit tests — concurrent-call coalescing and key lifecycle.
 */
import { describe, it, expect, vi } from 'vitest';
import { SingleflightMap } from './singleflight';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SingleflightMap.run', () => {
  it('coalesces concurrent calls for the same key into one execution', async () => {
    // Arrange
    const flights = new SingleflightMap<number>();
    const deferred = createDeferred<number>();
    const first = vi.fn(() => deferred.promise);
    const second = vi.fn(() => Promise.resolve(-1));

    // Act — second call arrives while the first is still in flight
    const p1 = flights.run('key', first);
    const p2 = flights.run('key', second);

    // Assert — the exact same promise instance is shared; second fn never runs
    expect(p2).toBe(p1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    deferred.resolve(42);
    await expect(p1).resolves.toBe(42);
    await expect(p2).resolves.toBe(42);
  });

  it('runs different keys independently and concurrently', async () => {
    // Arrange
    const flights = new SingleflightMap<string>();
    const deferredA = createDeferred<string>();
    const fnA = vi.fn(() => deferredA.promise);
    const fnB = vi.fn(() => Promise.resolve('b'));

    // Act — key b executes even though key a is still in flight
    const pA = flights.run('a', fnA);
    const pB = flights.run('b', fnB);

    // Assert
    expect(fnA).toHaveBeenCalledTimes(1);
    expect(fnB).toHaveBeenCalledTimes(1);
    await expect(pB).resolves.toBe('b');

    deferredA.resolve('a');
    await expect(pA).resolves.toBe('a');
  });

  it('clears the key after resolution so the next call re-executes', async () => {
    // Arrange
    const flights = new SingleflightMap<number>();
    const fn = vi.fn(() => Promise.resolve(1));

    // Act — sequential calls, each after the previous settled
    const first = await flights.run('key', fn);
    const second = await flights.run('key', fn);

    // Assert
    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('shares a rejection with all concurrent callers', async () => {
    // Arrange
    const flights = new SingleflightMap<number>();
    const deferred = createDeferred<number>();
    const fn = vi.fn(() => deferred.promise);

    // Act
    const p1 = flights.run('key', fn);
    const p2 = flights.run('key', fn);
    deferred.reject(new Error('boom'));

    // Assert
    await expect(p1).rejects.toThrow('boom');
    await expect(p2).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('clears the key after rejection so the next call re-executes fresh', async () => {
    // Arrange
    const flights = new SingleflightMap<string>();
    const failing = vi.fn(() => Promise.reject(new Error('transient')));
    const succeeding = vi.fn(() => Promise.resolve('ok'));

    // Act / Assert — a failed flight must not poison subsequent calls
    await expect(flights.run('key', failing)).rejects.toThrow('transient');
    await expect(flights.run('key', succeeding)).resolves.toBe('ok');
    expect(failing).toHaveBeenCalledTimes(1);
    expect(succeeding).toHaveBeenCalledTimes(1);
  });
});
