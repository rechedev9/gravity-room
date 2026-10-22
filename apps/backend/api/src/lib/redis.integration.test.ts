// Opt-in: set REDIS_TEST_URL to a throwaway Redis. Every key written is under a
// random prefix and deleted afterwards.
process.env['LOG_LEVEL'] = 'silent';

import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { closeRedis, getRedis } from './redis';

const redisUrl = process.env['REDIS_TEST_URL'];
if (redisUrl) process.env['REDIS_URL'] = redisUrl;
const prefix = `it:${randomUUID()}`;

describe.skipIf(!redisUrl)('redis client (real Redis)', () => {
  const client = (): NonNullable<ReturnType<typeof getRedis>> => {
    const redis = getRedis();
    if (!redis) throw new Error('REDIS_URL was not picked up');
    return redis;
  };

  afterAll(async () => {
    const redis = client();
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, { match: `${prefix}:*`, count: 100 });
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== '0');
    await closeRedis();
  });

  it('round-trips JSON values and reports a miss as null', async () => {
    const value = { id: 'gzclp', days: [1, 2], nested: { ok: true } };
    await client().set(`${prefix}:json`, value, { ex: 60 });

    expect(await client().get(`${prefix}:json`)).toEqual(value);
    expect(await client().get(`${prefix}:missing`)).toBeNull();
  });

  it('denies the request after the limit within one window', async () => {
    const opts = { key: `${prefix}:rl:count`, limit: 3, windowMs: 60_000, cost: 1 };
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await client().slidingWindow(opts));

    expect(results.map((r) => r.success)).toEqual([true, true, true, false]);
    const reset = results[3]?.reset ?? 0;
    expect(reset % 60_000).toBe(0);
    expect(reset).toBeGreaterThan(Date.now());
  });

  it('charges weighted requests by their cost', async () => {
    const base = { key: `${prefix}:rl:weighted`, limit: 10, windowMs: 60_000 };

    expect((await client().slidingWindow({ ...base, cost: 6 })).success).toBe(true);
    expect((await client().slidingWindow({ ...base, cost: 5 })).success).toBe(false);
  });

  it('keeps presence in a sorted set', async () => {
    const key = `${prefix}:presence`;
    await client().zadd(key, { score: 1, member: 'old' });
    await client().zadd(key, { score: Date.now(), member: 'new' });
    await client().zremrangebyscore(key, '-inf', 10);

    expect(await client().zcard(key)).toBe(1);
  });
});
