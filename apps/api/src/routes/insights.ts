import { Elysia, t } from 'elysia';
import { jwtPlugin, resolveUserId } from '../middleware/auth-guard';
import { rateLimit } from '../middleware/rate-limit';
import { requestLogger } from '../middleware/request-logger';
import { getInsights } from '../services/insights';
import { logger } from '../lib/logger';

const security = [{ bearerAuth: [] }];

export const insightsRoutes = new Elysia({ prefix: '/insights' })
  .use(requestLogger)
  .use(jwtPlugin)
  .resolve(resolveUserId)

  .get(
    '/',
    async ({ userId, query }) => {
      await rateLimit(userId, 'GET /insights', { maxRequests: 30 });

      let types: string[] = [];
      if (query.types) {
        types = query.types
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }

      try {
        const rows = await getInsights(userId, types);
        return {
          data: rows.map((r) => ({
            insightType: r.insightType,
            exerciseId: r.exerciseId,
            payload: r.payload,
            computedAt: r.computedAt.toISOString(),
            validUntil: r.validUntil ? r.validUntil.toISOString() : null,
          })),
        };
      } catch (err) {
        logger.error({ err, userId }, 'failed to fetch insights');
        throw err;
      }
    },
    {
      query: t.Object({
        types: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Insights'],
        summary: 'List user insights',
        description:
          'Returns pre-computed analytics insights for the authenticated user. ' +
          'Optionally filter by comma-separated insight types (e.g. ?types=volume_trend,frequency).',
        security,
      },
    }
  );
