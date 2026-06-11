process.env['LOG_LEVEL'] = 'silent';

import { mock, describe, it, expect } from 'bun:test';

// A fake ioredis client whose script execution always fails, simulating a Redis
// outage while the client object still exists.
const throwingRedis = {
  evalsha: mock(() => Promise.reject(new Error('ECONNREFUSED'))),
  eval: mock(() => Promise.reject(new Error('ECONNREFUSED'))),
};

mock.module('../lib/redis', () => ({
  getRedis: mock(() => throwingRedis),
}));

import { RedisRateLimitStore } from './redis-rate-limit';

describe('RedisRateLimitStore fail-closed fallback', () => {
  it('does not fail open or throw when Redis errors — falls back to in-memory limiting', async () => {
    const store = new RedisRateLimitStore();
    // First request under the limit is allowed via the in-memory fallback.
    const first = await store.check('rl:test:ip', 60_000, 1);
    expect(first).toBe(true);
    // Second request exceeds the limit and is BLOCKED — proving the limiter
    // stays enforced during a Redis outage instead of returning true blindly.
    const second = await store.check('rl:test:ip', 60_000, 1);
    expect(second).toBe(false);
  });
});
