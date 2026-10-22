process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect } from 'vitest';
import { drainKeepAlive, keepAlive } from './wait-until';

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

  it('lets shutdown wait for work still in flight', async () => {
    let settled = false;
    keepAlive(
      new Promise<void>((resolve) =>
        setTimeout(() => {
          settled = true;
          resolve();
        }, 20)
      )
    );

    await drainKeepAlive(1000);

    expect(settled).toBe(true);
  });

  it('stops waiting after the timeout', async () => {
    let release = (): void => undefined;
    keepAlive(new Promise<void>((resolve) => (release = resolve)));
    const started = Date.now();

    await drainKeepAlive(30);
    release();

    expect(Date.now() - started).toBeLessThan(500);
  });
});
