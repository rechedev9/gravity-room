import { sql } from 'drizzle-orm';
import { getDb } from '../db';
import { logger } from './logger';
import { getRedis } from './redis';

export type DependencyStatus =
  | { readonly status: 'ok'; readonly latencyMs: number }
  | { readonly status: 'disabled' }
  | { readonly status: 'error' };

export interface ReadinessResult {
  readonly status: 'ready' | 'degraded';
  readonly timestamp: string;
  readonly db: DependencyStatus;
  readonly redis: DependencyStatus;
}

async function checkDatabase(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    await getDb().execute(sql`SELECT 1`);
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (error: unknown) {
    logger.error({ err: error }, 'Database readiness check failed');
    return { status: 'error' };
  }
}

async function checkRedis(): Promise<DependencyStatus> {
  const redis = getRedis();
  if (!redis) return { status: 'disabled' };

  const start = Date.now();
  try {
    await redis.ping();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (error: unknown) {
    logger.error({ err: error }, 'Redis readiness check failed');
    return { status: 'error' };
  }
}

/**
 * Deep dependency readiness probe. This is intentionally mounted only beneath
 * the secret-guarded internal router; the public liveness route must remain an
 * in-memory check that cannot amplify traffic into Postgres or Redis.
 */
export async function checkReadiness(): Promise<ReadinessResult> {
  const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const ready = db.status === 'ok' && redis.status !== 'error';
  return {
    status: ready ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    db,
    redis,
  };
}
