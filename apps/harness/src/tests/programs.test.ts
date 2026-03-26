import { describe, it, expect, beforeAll } from 'bun:test';
import { seedUser, createTestProgram, DEFAULT_WEIGHTS, type SeededUser } from '../helpers/seed';
import { ProgramInstanceResponseSchema, ProgramListResponseSchema } from '../schemas/programs';
import { expectISODate, expectKeys, expectErrorShape, expectEmpty204 } from '../helpers/assertions';

describe('programs', () => {
  let user: SeededUser;
  let programId: string;

  beforeAll(async () => {
    user = await seedUser();
    programId = await createTestProgram(user.accessToken, user.client);
  });

  describe('POST /api/programs', () => {
    it('returns 201 with valid ProgramInstanceResponse shape', async () => {
      const freshUser = await seedUser();
      const res = await freshUser.client.post(
        '/api/programs',
        { programId: 'gzclp', name: 'Shape Test', config: DEFAULT_WEIGHTS },
        { accessToken: freshUser.accessToken }
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      const result = ProgramInstanceResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it('has exact key set', async () => {
      const freshUser = await seedUser();
      const res = await freshUser.client.post(
        '/api/programs',
        { programId: 'gzclp', name: 'Keys Test', config: DEFAULT_WEIGHTS },
        { accessToken: freshUser.accessToken }
      );
      const body = await res.json();
      expectKeys(body, [
        'completedDates',
        'config',
        'createdAt',
        'customDefinition',
        'definitionId',
        'id',
        'metadata',
        'name',
        'programId',
        'resultTimestamps',
        'results',
        'status',
        'undoHistory',
        'updatedAt',
      ]);
    });

    it('fresh program has empty collections', async () => {
      const freshUser = await seedUser();
      const res = await freshUser.client.post(
        '/api/programs',
        { programId: 'gzclp', name: 'Empty Test', config: DEFAULT_WEIGHTS },
        { accessToken: freshUser.accessToken }
      );
      const body = (await res.json()) as {
        results: Record<string, unknown>;
        undoHistory: unknown[];
        resultTimestamps: Record<string, unknown>;
        completedDates: Record<string, unknown>;
      };
      expect(body.results).toEqual({});
      expect(body.undoHistory).toEqual([]);
      expect(body.resultTimestamps).toEqual({});
      expect(body.completedDates).toEqual({});
    });

    it('nullable fields are present with null value', async () => {
      const freshUser = await seedUser();
      const res = await freshUser.client.post(
        '/api/programs',
        { programId: 'gzclp', name: 'Null Test', config: DEFAULT_WEIGHTS },
        { accessToken: freshUser.accessToken }
      );
      const body = (await res.json()) as Record<string, unknown>;
      expect('metadata' in body).toBe(true);
      expect(body['metadata']).toBeNull();
      expect('definitionId' in body).toBe(true);
      expect(body['definitionId']).toBeNull();
      expect('customDefinition' in body).toBe(true);
      expect(body['customDefinition']).toBeNull();
    });
  });

  describe('GET /api/programs/:id', () => {
    it('returns valid ProgramInstanceResponse shape', async () => {
      const res = await user.client.get(`/api/programs/${programId}`, {
        accessToken: user.accessToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = ProgramInstanceResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it('timestamps are valid ISO dates', async () => {
      const res = await user.client.get(`/api/programs/${programId}`, {
        accessToken: user.accessToken,
      });
      const body = (await res.json()) as { createdAt: string; updatedAt: string };
      expectISODate(body.createdAt);
      expectISODate(body.updatedAt);
    });
  });

  describe('GET /api/programs', () => {
    it('returns valid ProgramList shape', async () => {
      const res = await user.client.get('/api/programs', {
        accessToken: user.accessToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = ProgramListResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it('nextCursor is null when single program fits in page', async () => {
      const singleUser = await seedUser();
      await createTestProgram(singleUser.accessToken, singleUser.client);
      const res = await singleUser.client.get('/api/programs', {
        accessToken: singleUser.accessToken,
      });
      const body = (await res.json()) as { nextCursor: string | null };
      expect(body.nextCursor).toBeNull();
    });
  });

  describe('GET /api/programs/:id — 404', () => {
    it('returns 404 with exact error shape for non-existent ID', async () => {
      const res = await user.client.get('/api/programs/00000000-0000-0000-0000-000000000000', {
        accessToken: user.accessToken,
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expectErrorShape(body);
    });
  });

  describe('DELETE /api/programs/:id', () => {
    it('returns 204 empty body', async () => {
      const delUser = await seedUser();
      const delProgramId = await createTestProgram(delUser.accessToken, delUser.client);
      const res = await delUser.client.delete(`/api/programs/${delProgramId}`, {
        accessToken: delUser.accessToken,
      });
      await expectEmpty204(res);
    });
  });
});
