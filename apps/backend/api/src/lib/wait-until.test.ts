process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect } from 'vitest';
import { keepAlive } from './wait-until';

/** Yield to the macrotask queue so background `.catch` handlers can run. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('keepAlive', () => {
  it('lets a resolving promise settle', async () => {
    let settled = false;
    const work = Promise.resolve().then(() => {
      settled = true;
    });

    keepAlive(work);
    await work;

    expect(settled).toBe(true);
  });

  it('swallows rejections without an unhandled rejection or throwing', async () => {
    expect(() => keepAlive(Promise.reject(new Error('boom')))).not.toThrow();
    // Absence of an unhandled rejection is the assertion.
    await flush();
  });
});
