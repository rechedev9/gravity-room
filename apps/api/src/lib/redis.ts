import Redis from 'ioredis';
import { logger } from './logger';

let _redis: Redis | undefined;

/**
 * Returns a singleton ioredis client when REDIS_URL is set, or undefined when
 * running without Redis (single-instance deployments use the in-memory limiter).
 */
export function getRedis(): Redis | undefined {
  if (_redis) return _redis;

  const url = process.env['REDIS_URL'];
  if (!url) return undefined;

  _redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  _redis.on('error', (err: unknown) => {
    logger.error({ err }, 'Redis connection error');
  });

  _redis.on('connect', () => {
    logger.info('Redis connected');
  });

  return _redis;
}
