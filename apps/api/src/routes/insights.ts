import { Elysia, t } from 'elysia';
import { jwtPlugin, resolveUserId } from '../middleware/auth-guard';
import { rateLimit } from '../middleware/rate-limit';
import { requestLogger } from '../middleware/request-logger';
import { getInsights } from '../services/insights';
import { ApiError } from '../middleware/error-handler';
import { INSIGHT_TYPES, parseInsightTypesQuery } from '../lib/insight-types';
import { logger } from '../lib/logger';

const security = [{ bearerAuth: [] }];

export const insightsRoutes = new Elysia({ prefix: '/insights' })
  .use(requestLogger)
  .use(jwtPlugin)
  .resolve(resolveUserId)

  .get(
    '/',
    async ({ userId, query }) => {
      const parsed = parseInsightTypesQuery(query.types);
      if (!parsed.ok) {
        throw new ApiError(400, 'Invalid insight type', 'INVALID_INSIGHT_TYPE', {
          details: {
            invalidValues: parsed.error.invalidValues,
            validValues: INSIGHT_TYPES,
          },
        });
      }

      await rateLimit(userId, 'GET /insights', { maxRequests: 30 });

      try {
        const rows = await getInsights(userId, parsed.value);
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
          'Optionally filter by comma-separated insight types. ' +
          'Valid values: volume_trend, frequency, plateau_detection, load_recommendation. ' +
          'Unknown types return 400 with { code: "INVALID_INSIGHT_TYPE", invalidValues, validValues }.',
        security,
      },
    }
  );
