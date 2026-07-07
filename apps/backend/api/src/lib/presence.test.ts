/**
 * presence.ts unit tests — heartbeat debouncing and online-user counting.
 *
 * trackPresence debounces per user via a module-global Map, so each test
 * re-imports a fresh copy of the module (vi.resetModules + dynamic import) to
 * avoid order-dependent state leaking between tests. Time is controlled with
 * fake timers so the 30s debounce window is deterministic.
 *
 * The @upstash/redis client class is mocked so a fully typed Redis instance
 * can be constructed whose sorted-set methods are plain vi.fn spies.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @upstash/redis — the class methods delegate to hoisted spies
// ---------------------------------------------------------------------------

const { mockZadd, mockZremrangebyscore, mockZcard } = vi.hoisted(() => ({
  mockZadd: vi.fn(() => Promise.resolve(1)),
  mockZremrangebyscore: vi.fn(() => Promise.resolve(0)),
  mockZcard: vi.fn(() => Promise.resolve(0)),
}));

vi.mock('@upstash/redis', () => {
  class Redis {
    zadd = mockZadd;
    zremrangebyscore = mockZremrangebyscore;
    zcard = mockZcard;
  }
  return { Redis };
});

import { Redis } from '@upstash/redis';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PresenceModule = typeof import('./presence');

/** Fresh module copy per test so the module-global debounce Map is isolated. */
async function loadPresence(): Promise<PresenceModule> {
  vi.resetModules();
  return import('./presence');
}

function makeRedis(): Redis {
  return new Redis({ url: 'https://fake.upstash.example', token: 'fake-token' });
}

const NOW = new Date('2026-01-01T00:00:00.000Z');
const NOW_MS = NOW.getTime();
const PRESENCE_KEY = 'users:online';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mockZadd.mockReset().mockImplementation(() => Promise.resolve(1));
  mockZremrangebyscore.mockReset().mockImplementation(() => Promise.resolve(0));
  mockZcard.mockReset().mockImplementation(() => Promise.resolve(0));
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// trackPresence
// ---------------------------------------------------------------------------

describe('trackPresence', () => {
  it('writes a heartbeat with the current timestamp on first call', async () => {
    // Arrange
    const presence = await loadPresence();
    const redis = makeRedis();

    // Act
    await presence.trackPresence('user-1', redis);

    // Assert
    expect(mockZadd).toHaveBeenCalledTimes(1);
    expect(mockZadd).toHaveBeenCalledWith(PRESENCE_KEY, { score: NOW_MS, member: 'user-1' });
  });

  it('debounces repeat heartbeats for the same user within the 30s window', async () => {
    // Arrange
    const presence = await loadPresence();
    const redis = makeRedis();

    // Act — three calls inside the window
    await presence.trackPresence('user-1', redis);
    vi.advanceTimersByTime(10_000);
    await presence.trackPresence('user-1', redis);
    vi.advanceTimersByTime(19_999); // total 29 999ms since the first write
    await presence.trackPresence('user-1', redis);

    // Assert — only the first call reached Redis
    expect(mockZadd).toHaveBeenCalledTimes(1);
  });

  it('resolves without touching Redis when debounced', async () => {
    // Arrange
    const presence = await loadPresence();
    const redis = makeRedis();
    await presence.trackPresence('user-1', redis);
    mockZadd.mockClear();

    // Act
    const result = presence.trackPresence('user-1', redis);

    // Assert — a settled no-op promise, no Redis traffic
    await expect(result).resolves.toBeUndefined();
    expect(mockZadd).not.toHaveBeenCalled();
  });

  it('writes again once the 30s debounce window has elapsed', async () => {
    // Arrange
    const presence = await loadPresence();
    const redis = makeRedis();
    await presence.trackPresence('user-1', redis);

    // Act — advance exactly to the window boundary (>= 30s allows a write)
    vi.advanceTimersByTime(30_000);
    await presence.trackPresence('user-1', redis);

    // Assert — second write carries the new timestamp
    expect(mockZadd).toHaveBeenCalledTimes(2);
    expect(mockZadd).toHaveBeenLastCalledWith(PRESENCE_KEY, {
      score: NOW_MS + 30_000,
      member: 'user-1',
    });
  });

  it('retries immediately after a failed write instead of debouncing the failure', async () => {
    // Arrange
    const presence = await loadPresence();
    const redis = makeRedis();
    mockZadd.mockImplementationOnce(() => Promise.reject(new Error('zadd failed')));

    // Act — first write fails; the rejection still propagates to the caller
    await expect(presence.trackPresence('user-1', redis)).rejects.toThrow('zadd failed');
    // Next request inside what would have been the debounce window
    vi.advanceTimersByTime(1_000);
    await presence.trackPresence('user-1', redis);

    // Assert — the failed write did not consume the debounce window
    expect(mockZadd).toHaveBeenCalledTimes(2);
    expect(mockZadd).toHaveBeenLastCalledWith(PRESENCE_KEY, {
      score: NOW_MS + 1_000,
      member: 'user-1',
    });
  });

  it('debounces per user — a different user writes immediately', async () => {
    // Arrange
    const presence = await loadPresence();
    const redis = makeRedis();

    // Act
    await presence.trackPresence('user-1', redis);
    await presence.trackPresence('user-2', redis);

    // Assert
    expect(mockZadd).toHaveBeenCalledTimes(2);
    expect(mockZadd).toHaveBeenNthCalledWith(1, PRESENCE_KEY, {
      score: NOW_MS,
      member: 'user-1',
    });
    expect(mockZadd).toHaveBeenNthCalledWith(2, PRESENCE_KEY, {
      score: NOW_MS,
      member: 'user-2',
    });
  });
});

// ---------------------------------------------------------------------------
// countOnlineUsers
// ---------------------------------------------------------------------------

describe('countOnlineUsers', () => {
  it('prunes stale heartbeats before counting and returns zcard', async () => {
    // Arrange
    const presence = await loadPresence();
    const redis = makeRedis();
    const callOrder: string[] = [];
    mockZremrangebyscore.mockImplementation(() => {
      callOrder.push('prune');
      return Promise.resolve(3);
    });
    mockZcard.mockImplementation(() => {
      callOrder.push('count');
      return Promise.resolve(7);
    });

    // Act
    const count = await presence.countOnlineUsers(redis);

    // Assert — prune first (cutoff = now - 60s), then count
    expect(count).toBe(7);
    expect(callOrder).toEqual(['prune', 'count']);
    expect(mockZremrangebyscore).toHaveBeenCalledWith(PRESENCE_KEY, '-inf', NOW_MS - 60_000);
  });

  it('rejects when the prune step fails (caller decides how to degrade)', async () => {
    // Arrange
    const presence = await loadPresence();
    const redis = makeRedis();
    mockZremrangebyscore.mockImplementation(() => Promise.reject(new Error('redis down')));

    // Act / Assert
    await expect(presence.countOnlineUsers(redis)).rejects.toThrow('redis down');
    expect(mockZcard).not.toHaveBeenCalled();
  });

  it('rejects when zcard fails after a successful prune', async () => {
    // Arrange
    const presence = await loadPresence();
    const redis = makeRedis();
    mockZcard.mockImplementation(() => Promise.reject(new Error('zcard failed')));

    // Act / Assert
    await expect(presence.countOnlineUsers(redis)).rejects.toThrow('zcard failed');
    expect(mockZremrangebyscore).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// runPresenceJanitor
// ---------------------------------------------------------------------------

describe('runPresenceJanitor', () => {
  it('prunes heartbeats older than the 60s TTL without counting', async () => {
    // Arrange
    const presence = await loadPresence();
    const redis = makeRedis();

    // Act
    await presence.runPresenceJanitor(redis);

    // Assert
    expect(mockZremrangebyscore).toHaveBeenCalledTimes(1);
    expect(mockZremrangebyscore).toHaveBeenCalledWith(PRESENCE_KEY, '-inf', NOW_MS - 60_000);
    expect(mockZcard).not.toHaveBeenCalled();
  });
});
