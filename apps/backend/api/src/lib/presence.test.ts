import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackPresence } from './presence';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('trackPresence', () => {
  it('debounces repeated heartbeats for the same user', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-01-01T00:00:00.000Z'));
    const zadd = vi.fn(async () => 1);
    const redis = { zadd };

    await trackPresence('user-1', redis);
    await trackPresence('user-1', redis);

    expect(zadd).toHaveBeenCalledTimes(1);
  });

  it('bounds the in-memory debounce registry under a burst of unique users', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-01-01T00:00:00.000Z'));
    const zadd = vi.fn(async () => 1);
    const redis = { zadd };

    for (let index = 0; index <= 10_000; index += 1) {
      await trackPresence(`burst-user-${index}`, redis);
    }
    await trackPresence('burst-user-0', redis);

    // Once the 10,000-entry cap is reached, the oldest ID is evicted. Seeing it
    // again must write a heartbeat instead of being retained forever.
    expect(zadd).toHaveBeenCalledTimes(10_002);
  });
});
