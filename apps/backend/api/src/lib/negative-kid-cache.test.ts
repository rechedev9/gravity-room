import { describe, expect, it, vi } from 'vitest';
import { NegativeKidCache } from './negative-kid-cache';

describe('NegativeKidCache', () => {
  it.each([
    { capacity: 1, inserted: 20 },
    { capacity: 8, inserted: 100 },
    { capacity: 32, inserted: 1_000 },
  ])(
    'bounds $inserted unique attacker-controlled kids to $capacity live entries',
    ({ capacity, inserted }) => {
      const cache = new NegativeKidCache(capacity, 60_000, () => 1_000);

      for (let index = 0; index < inserted; index += 1) cache.add(`kid-${index}`);

      const retained = Array.from({ length: inserted }, (_, index) =>
        cache.has(`kid-${index}`)
      ).filter(Boolean);
      expect(retained).toHaveLength(capacity);
      expect(cache.has('kid-0')).toBe(false);
      expect(cache.has(`kid-${inserted - 1}`)).toBe(true);
    }
  );

  it.each([1, 1_000, 60_000])(
    'expires entries after the configured fake-clock TTL (%i ms)',
    (ttlMs) => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-08-02T00:00:00.000Z'));
        const cache = new NegativeKidCache(4, ttlMs);
        cache.add('expired-kid');
        expect(cache.has('expired-kid')).toBe(true);

        vi.advanceTimersByTime(ttlMs);
        expect(cache.has('expired-kid')).toBe(false);

        // Expired entries do not consume capacity when many fresh kids arrive.
        for (let index = 0; index < 10; index += 1) cache.add(`fresh-${index}`);
        expect(cache.has('fresh-9')).toBe(true);
        expect(cache.has('fresh-6')).toBe(true);
        expect(cache.has('fresh-5')).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    }
  );
});
