/**
 * Result routes — record, delete, and undo workout results.
 * Nested under /programs/:id/results. All routes require auth.
 */
import { Elysia, t } from 'elysia';
import { jwtPlugin, resolveUserId } from '../middleware/auth-guard';
import { rateLimit } from '../middleware/rate-limit';
import { requestLogger } from '../middleware/request-logger';
import { recordResult, deleteResult, undoLast } from '../services/results';

const security = [{ bearerAuth: [] }];

export const resultRoutes = new Elysia({ prefix: '/programs/:id' })
  .use(requestLogger)
  .use(jwtPlugin)
  .resolve(resolveUserId)

  // POST /programs/:id/results — record a workout result
  .post(
    '/results',
    async ({ userId, params, body, set, reqLogger }) => {
      reqLogger.info(
        {
          event: 'result.record',
          userId,
          instanceId: params.id,
          workoutIndex: body.workoutIndex,
          slotId: body.slotId,
        },
        'recording result'
      );
      await rateLimit(userId, 'POST /programs/results', { maxRequests: 60 });
      const result = await recordResult(userId, params.id, body);
      set.status = 201;
      return {
        workoutIndex: result.workoutIndex,
        slotId: result.slotId,
        result: result.result,
        ...(result.amrapReps !== null ? { amrapReps: result.amrapReps } : {}),
        ...(result.rpe !== null ? { rpe: result.rpe } : {}),
      };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workoutIndex: t.Integer({ minimum: 0 }),
        slotId: t.String({ minLength: 1 }),
        result: t.Union([t.Literal('success'), t.Literal('fail')]),
        amrapReps: t.Optional(t.Integer({ minimum: 0 })),
        rpe: t.Optional(t.Integer({ minimum: 1, maximum: 10 })),
      }),
      detail: {
        tags: ['Results'],
        summary: 'Record a workout result',
        description:
          'Upserts a result for a given workout index and slot (tier). Automatically pushes an undo entry capturing the previous state.',
        security,
        responses: {
          201: { description: 'Result recorded' },
          400: { description: 'Invalid amrapReps or bad slot ID' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Program not found or not owned by user' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )

  // DELETE /programs/:id/results/:workoutIndex/:slotId — delete a result
  .delete(
    '/results/:workoutIndex/:slotId',
    async ({ userId, params, set, reqLogger }) => {
      reqLogger.info(
        {
          event: 'result.delete',
          userId,
          instanceId: params.id,
          workoutIndex: params.workoutIndex,
          slotId: params.slotId,
        },
        'deleting result'
      );
      await deleteResult(userId, params.id, params.workoutIndex, params.slotId);
      set.status = 204;
    },
    {
      params: t.Object({
        id: t.String(),
        workoutIndex: t.Numeric(),
        slotId: t.String(),
      }),
      detail: {
        tags: ['Results'],
        summary: 'Delete a workout result',
        description:
          'Removes a recorded result and pushes an undo entry so the deletion can be reversed.',
        security,
        responses: {
          204: { description: 'Result deleted' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Result or program not found' },
        },
      },
    }
  )

  // POST /programs/:id/undo — undo last action
  .post(
    '/undo',
    async ({ userId, params, reqLogger }) => {
      reqLogger.info(
        { event: 'result.undo', userId, instanceId: params.id },
        'undoing last result action'
      );
      await rateLimit(userId, 'POST /programs/undo');
      const entry = await undoLast(userId, params.id);
      if (!entry) {
        return { undone: null };
      }
      return {
        undone: {
          i: entry.workoutIndex,
          slotId: entry.slotId,
          ...(entry.prevResult !== null ? { prev: entry.prevResult } : {}),
        },
      };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ['Results'],
        summary: 'Undo last result action',
        description:
          'Pops the most recent undo entry (LIFO) and restores the previous result state. Returns `{ undone: null }` if nothing to undo.',
        security,
        responses: {
          200: { description: 'Undo applied or null if stack was empty' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Program not found or not owned by user' },
          429: { description: 'Rate limited' },
        },
      },
    }
  );
