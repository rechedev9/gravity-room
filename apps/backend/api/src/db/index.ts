import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { logger } from '../lib/logger';

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

/** TCP keepalive interval in seconds to detect dead connections. */
const KEEP_ALIVE_INTERVAL_SECONDS = 60;

/** Recycle connections after 1 hour to prevent stale TCP sockets. */
const MAX_CONNECTION_LIFETIME_SECONDS = 3600;

let _client: postgres.Sql | undefined;
let _db: DbInstance | undefined;

const queryLogger = {
  logQuery(query: string, params: unknown[]): void {
    if (process.env['NODE_ENV'] !== 'production') {
      logger.debug({ sql: query, params }, 'SQL');
    }
  },
};

/**
 * Closes the database connection pool.
 *
 * NOT part of the serverless request lifecycle: on Vercel the pooled client is a
 * module-scope singleton reused across warm invocations, so no handler or request
 * path calls this. Retained for scripts and tests that need an explicit teardown.
 */
export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.end();
    _client = undefined;
    _db = undefined;
  }
}

export function getDb(): DbInstance {
  if (!_db) {
    const url = process.env['DATABASE_URL'];
    if (!url) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    _client = postgres(url, {
      // Serverless: exactly one connection per warm instance against the pooled
      // (PgBouncer) endpoint. Hard-coded to 1 — DB_POOL_SIZE was removed.
      max: 1,
      idle_timeout: 30,
      connect_timeout: 10,
      ssl:
        process.env['DB_SSL'] === 'false'
          ? false
          : process.env['NODE_ENV'] === 'production'
            ? 'require'
            : false,
      // Prevent runaway queries from exhausting the pool
      connection: { statement_timeout: 30_000 },
      // PgBouncer safety — plain queries instead of prepared statements
      prepare: false,
      // TCP keepalive to detect dead connections (interval in seconds)
      keep_alive: KEEP_ALIVE_INTERVAL_SECONDS,
      // Recycle connections after 1 hour
      max_lifetime: MAX_CONNECTION_LIFETIME_SECONDS,
    });
    _db = drizzle(_client, { schema, logger: queryLogger });
  }
  return _db;
}
