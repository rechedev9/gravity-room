import { Elysia } from 'elysia';
import { getRedis } from '../lib/redis';
import { countOnlineUsers } from '../lib/presence';
import { rateLimit } from '../middleware/rate-limit';
import { requestLogger } from '../middleware/request-logger';

export const statsRoutes = new Elysia().use(requestLogger).get(
  '/stats/online',
  async ({ ip }) => {
    await rateLimit(ip, 'GET /stats/online', { maxRequests: 30, windowMs: 60_000 });
    const redis = getRedis();
    if (!redis) return { count: null };
    try {
      const count = await countOnlineUsers(redis);
      return { count };
    } catch {
      return { count: null };
    }
  },
  {
    detail: {
      tags: ['Stats'],
      summary: 'Online users count',
      description:
        'Returns the approximate number of users active in the last 60 seconds. Returns null when Redis is unavailable.',
    },
  }
);
