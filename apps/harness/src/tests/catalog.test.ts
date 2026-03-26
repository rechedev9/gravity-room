import { describe, it, expect } from 'bun:test';
import { createClient } from '../helpers/client';
import { seedUser } from '../helpers/seed';
import {
  CatalogListResponseSchema,
  CatalogDetailResponseSchema,
  PreviewResponseSchema,
} from '../schemas/catalog';

describe('catalog', () => {
  const client = createClient();

  describe('GET /api/catalog', () => {
    it('returns valid CatalogList shape', async () => {
      const res = await client.get('/api/catalog');
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = CatalogListResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it('has exact Cache-Control header', async () => {
      const res = await client.get('/api/catalog');
      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toBe('public, max-age=300, stale-while-revalidate=60');
    });

    it('contains at least one catalog entry', async () => {
      const res = await client.get('/api/catalog');
      const body = (await res.json()) as unknown[];
      expect(body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/catalog/gzclp', () => {
    it('returns valid CatalogDetail shape', async () => {
      const res = await client.get('/api/catalog/gzclp');
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = CatalogDetailResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it('has Cache-Control header', async () => {
      const res = await client.get('/api/catalog/gzclp');
      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toBe('public, max-age=300');
    });
  });

  describe('POST /api/catalog/preview', () => {
    // Minimal valid 3-workout definition for preview tests
    const minimalDefinition = {
      id: 'test-preview',
      name: 'Test Preview',
      description: '',
      author: 'harness',
      version: 1,
      category: 'strength',
      source: 'custom',
      cycleLength: 1,
      totalWorkouts: 3,
      workoutsPerWeek: 3,
      exercises: { ex: { name: 'Exercise' } },
      configFields: [{ key: 'ex', label: 'Exercise', type: 'weight', min: 0, step: 2.5 }],
      weightIncrements: { ex: 5 },
      days: [
        {
          name: 'Day 1',
          slots: [
            {
              id: 'slot1',
              exerciseId: 'ex',
              tier: 't1',
              stages: [{ sets: 5, reps: 3 }],
              onSuccess: { type: 'add_weight' },
              onMidStageFail: { type: 'no_change' },
              onFinalStageFail: { type: 'no_change' },
              startWeightKey: 'ex',
            },
          ],
        },
      ],
    };

    it('returns 401 without auth', async () => {
      const res = await client.post('/api/catalog/preview', { definition: minimalDefinition });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('returns 422 for empty definition object', async () => {
      const { accessToken } = await seedUser();
      const res = await client.post('/api/catalog/preview', { definition: {} }, { accessToken });
      expect(res.status).toBe(422);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 200 with valid definition — max 10 rows, correct shape', async () => {
      const { accessToken } = await seedUser();
      const res = await client.post(
        '/api/catalog/preview',
        { definition: minimalDefinition, config: { ex: 60 } },
        { accessToken }
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = PreviewResponseSchema.safeParse(body);
      if (!result.success) {
        console.error('Preview schema errors:', result.error.issues);
      }
      expect(result.success).toBe(true);
      const rows = body as unknown[];
      expect(rows.length).toBe(3); // totalWorkouts=3 so exactly 3 rows
      expect(rows.length).toBeLessThanOrEqual(10);
    });

    it('returns rows with required fields on every slot', async () => {
      const { accessToken } = await seedUser();
      const res = await client.post(
        '/api/catalog/preview',
        { definition: minimalDefinition, config: { ex: 60 } },
        { accessToken }
      );
      expect(res.status).toBe(200);
      const rows = (await res.json()) as Array<{
        index: number;
        dayName: string;
        slots: Array<Record<string, unknown>>;
        isChanged: boolean;
      }>;
      for (const row of rows) {
        expect(typeof row.index).toBe('number');
        expect(typeof row.dayName).toBe('string');
        expect(Array.isArray(row.slots)).toBe(true);
        expect(typeof row.isChanged).toBe('boolean');
        for (const slot of row.slots) {
          expect(typeof slot['slotId']).toBe('string');
          expect(typeof slot['exerciseId']).toBe('string');
          expect(typeof slot['exerciseName']).toBe('string');
          expect(typeof slot['weight']).toBe('number');
          expect(typeof slot['isAmrap']).toBe('boolean');
          expect(typeof slot['isChanged']).toBe('boolean');
          expect(typeof slot['isDeload']).toBe('boolean');
        }
      }
    });
  });
});
