import { describe, it, expect } from 'bun:test';
import { createClient } from '../helpers/client';
import { HealthResponseSchema, StatsOnlineResponseSchema } from '../schemas/system';
import { expectISODate } from '../helpers/assertions';

describe('system', () => {
  const client = createClient();

  describe('GET /health', () => {
    it('returns valid HealthResponse shape', async () => {
      const res = await client.get('/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = HealthResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it('status is "ok" when healthy', async () => {
      const res = await client.get('/health');
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe('ok');
    });

    it('timestamp is valid ISO date', async () => {
      const res = await client.get('/health');
      const body = (await res.json()) as { timestamp: string };
      expectISODate(body.timestamp);
    });
  });

  describe('GET /api/stats/online', () => {
    it('returns valid StatsOnlineResponse shape', async () => {
      const res = await client.get('/api/stats/online');
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = StatsOnlineResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it('count is null or non-negative integer', async () => {
      const res = await client.get('/api/stats/online');
      const body = (await res.json()) as { count: number | null };
      expect('count' in body).toBe(true);
      if (body.count !== null) {
        expect(body.count).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(body.count)).toBe(true);
      }
    });
  });
});
