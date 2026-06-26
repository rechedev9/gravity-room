/**
 * wait-until unit tests — verify keepAlive()'s two execution paths.
 *
 * Strategy: mock @vercel/functions so we can observe whether `waitUntil` is
 * invoked and inject a throwing implementation to exercise the graceful
 * fallback. `process.env.VERCEL` is toggled per test to drive path selection
 * and restored afterwards so the suite leaves the environment untouched.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @vercel/functions — declared before importing the SUT
// ---------------------------------------------------------------------------

const waitUntilCalls: Promise<unknown>[] = [];
let waitUntilImpl: (p: Promise<unknown>) => void = (p) => {
  waitUntilCalls.push(p);
};

vi.mock('@vercel/functions', () => ({
  waitUntil: (p: Promise<unknown>): void => waitUntilImpl(p),
}));

// Must import AFTER mock.module
import { keepAlive } from './wait-until';

/** Yield to the microtask queue so background `.catch` handlers can run. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const ORIGINAL_VERCEL = process.env['VERCEL'];

beforeEach(() => {
  waitUntilCalls.length = 0;
  waitUntilImpl = (p) => {
    waitUntilCalls.push(p);
  };
  delete process.env['VERCEL'];
});

afterEach(() => {
  if (ORIGINAL_VERCEL === undefined) {
    delete process.env['VERCEL'];
  } else {
    process.env['VERCEL'] = ORIGINAL_VERCEL;
  }
});

// ---------------------------------------------------------------------------
// Off Vercel — long-lived runtime, no waitUntil needed
// ---------------------------------------------------------------------------

describe('keepAlive without VERCEL set', () => {
  it('lets a resolving promise settle without invoking waitUntil', async () => {
    let settled = false;
    const work = Promise.resolve().then(() => {
      settled = true;
    });

    keepAlive(work);
    await work;

    expect(settled).toBe(true);
    expect(waitUntilCalls).toHaveLength(0);
  });

  it('swallows rejections without an unhandled rejection or throwing', async () => {
    expect(() => keepAlive(Promise.reject(new Error('boom')))).not.toThrow();
    // Give the internal .catch a chance to run; absence of a crash is the assertion.
    await flush();
    expect(waitUntilCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// On Vercel — extend function lifetime via waitUntil
// ---------------------------------------------------------------------------

describe('keepAlive with VERCEL set', () => {
  it('hands the promise to waitUntil', async () => {
    process.env['VERCEL'] = '1';

    keepAlive(Promise.resolve('ok'));

    expect(waitUntilCalls).toHaveLength(1);
    // The promise passed to waitUntil must already be rejection-safe; on success
    // it passes the resolved value straight through.
    await expect(waitUntilCalls[0]).resolves.toBe('ok');
  });

  it('hands waitUntil a promise that never rejects even when the work fails', async () => {
    process.env['VERCEL'] = '1';

    keepAlive(Promise.reject(new Error('boom')));

    expect(waitUntilCalls).toHaveLength(1);
    await expect(waitUntilCalls[0]).resolves.toBeUndefined();
  });

  it('degrades to fire-and-forget when waitUntil throws (no request scope)', async () => {
    process.env['VERCEL'] = '1';
    waitUntilImpl = () => {
      throw new Error('no request scope');
    };

    let settled = false;
    const work = Promise.resolve().then(() => {
      settled = true;
    });

    expect(() => keepAlive(work)).not.toThrow();
    await work;
    expect(settled).toBe(true);
  });
});
