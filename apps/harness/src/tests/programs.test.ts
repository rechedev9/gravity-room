import { describe, it, expect, beforeAll } from 'bun:test';
import { seedUser, createTestProgram, DEFAULT_WEIGHTS, type SeededUser } from '../helpers/seed';
import {
  ProgramInstanceResponseSchema,
  ProgramListResponseSchema,
  ExportResponseSchema,
} from '../schemas/programs';
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

    it('returns 422 AMBIGUOUS_SOURCE when both programId and definitionId are provided', async () => {
      const freshUser = await seedUser();
      const res = await freshUser.client.post(
        '/api/programs',
        {
          programId: 'gzclp',
          definitionId: crypto.randomUUID(),
          name: 'Ambiguous',
          config: DEFAULT_WEIGHTS,
        },
        { accessToken: freshUser.accessToken }
      );
      expect(res.status).toBe(422);
      const body = await res.json();
      expectErrorShape(body);
      expect((body as { code: string }).code).toBe('AMBIGUOUS_SOURCE');
    });

    it('returns 422 MISSING_PROGRAM_SOURCE when neither source is provided', async () => {
      const freshUser = await seedUser();
      const res = await freshUser.client.post(
        '/api/programs',
        { name: 'Missing Source', config: DEFAULT_WEIGHTS },
        { accessToken: freshUser.accessToken }
      );
      expect(res.status).toBe(422);
      const body = await res.json();
      expectErrorShape(body);
      expect((body as { code: string }).code).toBe('MISSING_PROGRAM_SOURCE');
    });

    it('returns 400 INVALID_PROGRAM for unknown catalog programId', async () => {
      const freshUser = await seedUser();
      const res = await freshUser.client.post(
        '/api/programs',
        { programId: 'not-a-real-program', name: 'Unknown Program', config: DEFAULT_WEIGHTS },
        { accessToken: freshUser.accessToken }
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expectErrorShape(body);
      expect((body as { code: string }).code).toBe('INVALID_PROGRAM');
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

    it('accepts limit query param and still returns valid ProgramList shape', async () => {
      const res = await user.client.get('/api/programs?limit=1', {
        accessToken: user.accessToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = ProgramListResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
      expect((body as { data: unknown[] }).data.length).toBeLessThanOrEqual(1);
    });
  });

  describe('PATCH /api/programs/:id/metadata', () => {
    it('merges metadata and returns full ProgramInstanceResponse', async () => {
      const metadataUser = await seedUser();
      const metadataId = await createTestProgram(metadataUser.accessToken, metadataUser.client);
      const res = await metadataUser.client.patch(
        `/api/programs/${metadataId}/metadata`,
        { metadata: { phase: 'base', bodyweight: 82.5 } },
        { accessToken: metadataUser.accessToken }
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = ProgramInstanceResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
      expect((body as { metadata: Record<string, unknown> | null }).metadata).toEqual({
        phase: 'base',
        bodyweight: 82.5,
      });
    });

    it('returns 400 METADATA_TOO_LARGE when patch exceeds 10KB', async () => {
      const metadataUser = await seedUser();
      const metadataId = await createTestProgram(metadataUser.accessToken, metadataUser.client);
      const huge = 'x'.repeat(10_100);
      const res = await metadataUser.client.patch(
        `/api/programs/${metadataId}/metadata`,
        { metadata: { huge } },
        { accessToken: metadataUser.accessToken }
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expectErrorShape(body);
      expect((body as { code: string }).code).toBe('METADATA_TOO_LARGE');
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

  describe('PATCH /api/programs/:id', () => {
    it('updates name and returns valid ProgramInstanceResponse', async () => {
      const patchUser = await seedUser();
      const patchId = await createTestProgram(patchUser.accessToken, patchUser.client);
      const res = await patchUser.client.patch(
        `/api/programs/${patchId}`,
        { name: 'Renamed Program' },
        { accessToken: patchUser.accessToken }
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = ProgramInstanceResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
      expect((body as { name: string }).name).toBe('Renamed Program');
    });

    it('updates status to archived', async () => {
      const patchUser = await seedUser();
      const patchId = await createTestProgram(patchUser.accessToken, patchUser.client);
      const res = await patchUser.client.patch(
        `/api/programs/${patchId}`,
        { status: 'archived' },
        { accessToken: patchUser.accessToken }
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe('archived');
    });

    it('updates config', async () => {
      const patchUser = await seedUser();
      const patchId = await createTestProgram(patchUser.accessToken, patchUser.client);
      const newConfig = { t1Weight: 80, t2Weight: 50 };
      const res = await patchUser.client.patch(
        `/api/programs/${patchId}`,
        { config: newConfig },
        { accessToken: patchUser.accessToken }
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { config: Record<string, unknown> };
      expect(body.config).toEqual(newConfig);
    });

    it('returns 404 for non-existent program', async () => {
      const res = await user.client.patch(
        '/api/programs/00000000-0000-0000-0000-000000000000',
        { name: 'Ghost' },
        { accessToken: user.accessToken }
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expectErrorShape(body);
    });

    it('returns 422 for invalid status', async () => {
      const res = await user.client.patch(
        `/api/programs/${programId}`,
        { status: 'invalid_status' },
        { accessToken: user.accessToken }
      );
      expect(res.status).toBe(422);
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

  describe('GET /api/programs/:id/export', () => {
    it('returns valid export response shape', async () => {
      const exportUser = await seedUser();
      const exportId = await createTestProgram(exportUser.accessToken, exportUser.client);
      const res = await exportUser.client.get(`/api/programs/${exportId}/export`, {
        accessToken: exportUser.accessToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = ExportResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
      expect((body as { version: number }).version).toBe(1);
    });
  });

  describe('POST /api/programs/import', () => {
    it('imports an exported program and returns ProgramInstanceResponse', async () => {
      const importUser = await seedUser();
      const sourceId = await createTestProgram(importUser.accessToken, importUser.client);
      const exportRes = await importUser.client.get(`/api/programs/${sourceId}/export`, {
        accessToken: importUser.accessToken,
      });
      const exported = await exportRes.json();

      const targetUser = await seedUser();
      const importRes = await targetUser.client.post('/api/programs/import', exported, {
        accessToken: targetUser.accessToken,
      });
      expect(importRes.status).toBe(201);
      const body = await importRes.json();
      const result = ProgramInstanceResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
      expect((body as { programId: string }).programId).toBe('gzclp');
    });

    it('returns 400 INVALID_PROGRAM for unknown programId', async () => {
      const targetUser = await seedUser();
      const res = await targetUser.client.post(
        '/api/programs/import',
        {
          version: 1,
          exportDate: new Date().toISOString(),
          programId: 'missing-program',
          name: 'Bad Import',
          config: DEFAULT_WEIGHTS,
          results: {},
          undoHistory: [],
        },
        { accessToken: targetUser.accessToken }
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expectErrorShape(body);
      expect((body as { code: string }).code).toBe('INVALID_PROGRAM');
    });

    it('returns 400 INVALID_DATA for bad workout index', async () => {
      const targetUser = await seedUser();
      const res = await targetUser.client.post(
        '/api/programs/import',
        {
          version: 1,
          exportDate: new Date().toISOString(),
          programId: 'gzclp',
          name: 'Bad Workout Index',
          config: DEFAULT_WEIGHTS,
          results: {
            '9999': {
              'squat-a': { result: 'success' },
            },
          },
          undoHistory: [],
        },
        { accessToken: targetUser.accessToken }
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expectErrorShape(body);
      expect((body as { code: string }).code).toBe('INVALID_DATA');
    });
  });
});
