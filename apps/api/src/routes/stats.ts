import { Elysia } from 'elysia';
import { getRedis } from '../lib/redis';
import { countOnlineUsers } from '../lib/presence';

export const statsRoutes = new Elysia().get(
  '/stats/online',
  async () => {
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
