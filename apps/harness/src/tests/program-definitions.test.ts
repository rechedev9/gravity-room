import { describe, it, expect, beforeAll } from 'bun:test';
import { seedUser, type SeededUser } from '../helpers/seed';
import {
  ProgramDefinitionListResponseSchema,
  ProgramDefinitionResponseSchema,
} from '../schemas/program-definitions';
import { expectISODate } from '../helpers/assertions';

describe('program-definitions', () => {
  let user: SeededUser;

  beforeAll(async () => {
    user = await seedUser();
  });

  describe('GET /api/program-definitions', () => {
    it('returns valid ProgramDefinitionList shape', async () => {
      const res = await user.client.get('/api/program-definitions', {
        accessToken: user.accessToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = ProgramDefinitionListResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it('returns empty data array for fresh user', async () => {
      const freshUser = await seedUser();
      const res = await freshUser.client.get('/api/program-definitions', {
        accessToken: freshUser.accessToken,
      });
      const body = (await res.json()) as { data: unknown[]; total: number };
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    });
  });

  describe('POST + GET /api/program-definitions', () => {
    it('created definition has valid shape and ISO timestamps', async () => {
      const defUser = await seedUser();

      // Create a minimal valid program definition
      const createRes = await defUser.client.post(
        '/api/program-definitions',
        {
          definition: {
            source: 'custom',
            name: 'Harness Test Def',
            description: 'Test definition',
            author: 'harness',
            workouts: [
              {
                name: 'Day A',
                slots: [
                  {
                    exerciseId: 'squat',
                    setsScheme: '5x3',
                    progression: [],
                  },
                ],
              },
            ],
          },
        },
        { accessToken: defUser.accessToken }
      );
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      const parseResult = ProgramDefinitionResponseSchema.safeParse(created);
      expect(parseResult.success).toBe(true);

      const def = created as {
        id: string;
        createdAt: string;
        updatedAt: string;
        deletedAt: unknown;
      };
      expectISODate(def.createdAt);
      expectISODate(def.updatedAt);

      // deletedAt should be null for new definition
      expect('deletedAt' in def).toBe(true);
      expect(def.deletedAt).toBeNull();
    });
  });

  describe('DELETE /api/program-definitions/:id', () => {
    it('returns 204 empty body for owned definition', async () => {
      const delUser = await seedUser();

      // Create a definition to delete
      const createRes = await delUser.client.post(
        '/api/program-definitions',
        {
          definition: {
            source: 'custom',
            name: 'To Delete',
            description: 'Will be deleted',
            author: 'harness',
            workouts: [
              {
                name: 'Day A',
                slots: [
                  {
                    exerciseId: 'squat',
                    setsScheme: '5x3',
                    progression: [],
                  },
                ],
              },
            ],
          },
        },
        { accessToken: delUser.accessToken }
      );
      const created = (await createRes.json()) as { id: string };

      const delRes = await delUser.client.delete(`/api/program-definitions/${created.id}`, {
        accessToken: delUser.accessToken,
      });
      expect(delRes.status).toBe(204);
      const text = await delRes.text();
      expect(text).toBe('');
    });
  });
});
