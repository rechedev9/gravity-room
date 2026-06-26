import { describe, expect, it, vi } from 'vitest';
import { createSingleFlight } from './single-flight.js';

describe('createSingleFlight', () => {
  it('calls the underlying fn and returns its value', async () => {
    const fn = vi.fn(() => Promise.resolve(42));
    const wrapped = createSingleFlight(fn);
    const result = await wrapped();
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent calls — fn is only invoked once', async () => {
    let resolvePromise!: (v: number) => void;
    const promise = new Promise<number>((res) => {
      resolvePromise = res;
    });
    const fn = vi.fn(() => promise);
    const wrapped = createSingleFlight(fn);

    const p1 = wrapped();
    const p2 = wrapped();
    const p3 = wrapped();

    resolvePromise(99);

    const results = await Promise.all([p1, p2, p3]);
    expect(results).toEqual([99, 99, 99]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('allows a new call after the previous one settles', async () => {
    let callCount = 0;
    const fn = vi.fn(() => Promise.resolve(++callCount));
    const wrapped = createSingleFlight(fn);

    const first = await wrapped();
    const second = await wrapped();

    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('clears the in-flight slot even when fn rejects', async () => {
    const fn = vi.fn(() => Promise.reject(new Error('boom')));
    const wrapped = createSingleFlight(fn);

    await expect(wrapped()).rejects.toThrow('boom');
    // After rejection the slot should be cleared — a second call must invoke fn again
    await expect(wrapped()).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
