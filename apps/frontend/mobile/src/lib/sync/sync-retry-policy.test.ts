import {
  nextSyncAttempt,
  syncRetryDelay,
  syncRetryDeadline,
  syncRetryTimerDelay,
} from './sync-retry-policy';

describe('sync retry policy', () => {
  it('doubles the delay until five minutes and saturates the attempt count', () => {
    let attempt = 0;
    const delays = [];
    for (let index = 0; index < 10; index += 1) {
      attempt = nextSyncAttempt(attempt);
      delays.push(syncRetryDelay(attempt));
    }
    expect(attempt).toBe(7);
    expect(delays).toEqual([
      5000, 10000, 20000, 40000, 80000, 160000, 300000, 300000, 300000, 300000,
    ]);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects corrupt previous attempt %s',
    (attempt) => {
      expect(() => nextSyncAttempt(attempt)).toThrow('Invalid sync retry attempt');
    }
  );

  it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid delay attempt %s', (attempt) => {
    expect(() => syncRetryDelay(attempt)).toThrow('Invalid sync retry attempt');
  });

  it('bounds large valid counters before exponentiation', () => {
    expect(nextSyncAttempt(Number.MAX_SAFE_INTEGER)).toBe(7);
    expect(syncRetryDelay(Number.MAX_SAFE_INTEGER)).toBe(300000);
  });

  it('applies positive jitter after the base-delay cap', () => {
    expect(syncRetryDeadline(1, 1000, 0)).toBe(6000);
    expect(syncRetryDeadline(1, 1000, 0.5)).toBe(6500);
    expect(syncRetryDeadline(7, 1000, 0.5)).toBe(331000);
    expect(syncRetryDeadline(7, 1000, 0.999)).toBe(360940);
  });

  it('honors later server deadlines without shortening local backoff', () => {
    expect(syncRetryDeadline(1, 1000, 0, 5000)).toBe(6000);
    expect(syncRetryDeadline(1, 1000, 0, 9000)).toBe(9000);
  });

  it.each([-1, 1, NaN, Infinity])('rejects invalid random input %s', (random) => {
    expect(() => syncRetryDeadline(1, 1000, random)).toThrow('Invalid sync retry randomness');
  });

  it.each([
    [0, 1000, 1],
    [1000, 1000, 1],
    [1001, 1000, 1],
    [9000, 1000, 8000],
    [1e12, 1000, 300000],
  ])('bounds timer deadline %s at clock %s', (deadline, now, expected) => {
    expect(syncRetryTimerDelay(deadline, now)).toBe(expected);
  });
});
