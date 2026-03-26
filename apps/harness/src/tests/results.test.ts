import { describe, it, expect, beforeAll } from 'bun:test';
import { seedUser, createTestProgram, seedResult, type SeededUser } from '../helpers/seed';
import { ResultEntrySchema } from '../schemas/programs';
import { UndoResponseSchema } from '../schemas/results';

describe('results', () => {
  let user: SeededUser;
  let programId: string;

  beforeAll(async () => {
    user = await seedUser();
    programId = await createTestProgram(user.accessToken, user.client);
  });

  describe('POST /api/programs/:id/results', () => {
    it('returns 201 with result entry shape', async () => {
      const resultUser = await seedUser();
      const resultProgramId = await createTestProgram(resultUser.accessToken, resultUser.client);

      const res = await seedResult(
        resultUser.client,
        resultUser.accessToken,
        resultProgramId,
        0,
        't1',
        'success'
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;

      // Verify workoutIndex, slotId, result keys are present
      expect(body['workoutIndex']).toBe(0);
      expect(body['slotId']).toBe('t1');
      expect(body['result']).toBe('success');
    });

    it('result entry has only "result" key (no amrapReps) when not submitted', async () => {
      const resultUser = await seedUser();
      const resultProgramId = await createTestProgram(resultUser.accessToken, resultUser.client);

      const res = await seedResult(
        resultUser.client,
        resultUser.accessToken,
        resultProgramId,
        0,
        't1',
        'success'
      );
      const body = (await res.json()) as Record<string, unknown>;
      expect('amrapReps' in body).toBe(false);
      expect('rpe' in body).toBe(false);
      expect('setLogs' in body).toBe(false);
    });

    it('result entry includes amrapReps when submitted', async () => {
      const resultUser = await seedUser();
      const resultProgramId = await createTestProgram(resultUser.accessToken, resultUser.client);

      const res = await seedResult(
        resultUser.client,
        resultUser.accessToken,
        resultProgramId,
        0,
        't3',
        'success',
        { amrapReps: 12 }
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect('amrapReps' in body).toBe(true);
      expect(body['amrapReps']).toBe(12);
    });

    it('program instance reflects recorded result', async () => {
      // After recording, verify via GET that results map is populated
      const res = await seedResult(user.client, user.accessToken, programId, 0, 't1', 'success');
      expect(res.status).toBe(201);

      const getRes = await user.client.get(`/api/programs/${programId}`, {
        accessToken: user.accessToken,
      });
      const instance = (await getRes.json()) as {
        results: Record<string, Record<string, unknown>>;
      };
      expect(instance.results['0']).toBeDefined();
      expect(instance.results['0']!['t1']).toBeDefined();

      // Validate the result entry within the program instance
      const entry = instance.results['0']!['t1'];
      const parseResult = ResultEntrySchema.safeParse(entry);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('POST /api/programs/:id/undo', () => {
    it('returns undo response with undone entry', async () => {
      const undoUser = await seedUser();
      const undoProgramId = await createTestProgram(undoUser.accessToken, undoUser.client);

      // Record a result first so there's something to undo
      await seedResult(undoUser.client, undoUser.accessToken, undoProgramId, 0, 't1', 'success');

      const res = await undoUser.client.post(`/api/programs/${undoProgramId}/undo`, undefined, {
        accessToken: undoUser.accessToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();

      // Validate the full { undone: { ... } } wrapper shape
      const parseResult = UndoResponseSchema.safeParse(body);
      expect(parseResult.success).toBe(true);
      expect((body as { undone: unknown }).undone).not.toBeNull();
    });

    it('undo entry does not contain prevRpe or prevAmrapReps for simple result', async () => {
      const undoUser = await seedUser();
      const undoProgramId = await createTestProgram(undoUser.accessToken, undoUser.client);

      await seedResult(undoUser.client, undoUser.accessToken, undoProgramId, 0, 't1', 'success');

      const res = await undoUser.client.post(`/api/programs/${undoProgramId}/undo`, undefined, {
        accessToken: undoUser.accessToken,
      });
      const body = (await res.json()) as { undone: Record<string, unknown> | null };
      const undone = body.undone!;
      expect('prevRpe' in undone).toBe(false);
      expect('prevAmrapReps' in undone).toBe(false);
    });

    it('returns { undone: null } when nothing to undo', async () => {
      const emptyUser = await seedUser();
      const emptyProgramId = await createTestProgram(emptyUser.accessToken, emptyUser.client);

      const res = await emptyUser.client.post(`/api/programs/${emptyProgramId}/undo`, undefined, {
        accessToken: emptyUser.accessToken,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { undone: unknown };
      expect(body.undone).toBeNull();
    });
  });
});
