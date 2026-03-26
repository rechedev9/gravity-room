import { describe, it, expect, beforeAll } from 'bun:test';
import { seedUser, type SeededUser } from '../helpers/seed';
import { ExerciseListResponseSchema, MuscleGroupsResponseSchema } from '../schemas/exercises';

describe('exercises', () => {
  let user: SeededUser;

  beforeAll(async () => {
    user = await seedUser();
  });

  describe('GET /api/exercises', () => {
    it('returns valid ExerciseListResponse shape', async () => {
      const res = await user.client.get('/api/exercises', {
        accessToken: user.accessToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = ExerciseListResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it('nullable fields are present even when null', async () => {
      const res = await user.client.get('/api/exercises', {
        accessToken: user.accessToken,
      });
      const body = (await res.json()) as {
        data: Array<Record<string, unknown>>;
      };
      expect(body.data.length).toBeGreaterThan(0);

      const entry = body.data[0]!;
      // These fields should always be present (nullable, not optional)
      expect('equipment' in entry).toBe(true);
      expect('createdBy' in entry).toBe(true);
      expect('force' in entry).toBe(true);
      expect('level' in entry).toBe(true);
      expect('mechanic' in entry).toBe(true);
      expect('category' in entry).toBe(true);
      expect('secondaryMuscles' in entry).toBe(true);
    });
  });

  describe('GET /api/muscle-groups', () => {
    it('returns valid MuscleGroupsResponse shape', async () => {
      const res = await user.client.get('/api/muscle-groups', {
        accessToken: user.accessToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = MuscleGroupsResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it('contains at least one muscle group', async () => {
      const res = await user.client.get('/api/muscle-groups', {
        accessToken: user.accessToken,
      });
      const body = (await res.json()) as unknown[];
      expect(body.length).toBeGreaterThan(0);
    });
  });
});
