import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { logger } from '../lib/logger';
import { dbQueriesTotal } from '../lib/metrics';

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

type QueryType = 'select' | 'insert' | 'update' | 'delete' | 'other';

function deriveQueryType(sql: string): QueryType {
  const keyword = sql.trimStart().split(/\s+/)[0]?.toLowerCase() ?? 'other';
  if (
    keyword === 'select' ||
    keyword === 'insert' ||
    keyword === 'update' ||
    keyword === 'delete'
  ) {
    return keyword;
  }
  return 'other';
}

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
    dbQueriesTotal.inc({ query_type: deriveQueryType(query) });
  },
};

/** Closes the database connection pool. Called during graceful shutdown. */
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
    const poolSize = Number(process.env['DB_POOL_SIZE']) || 50;
    _client = postgres(url, {
      max: poolSize,
      idle_timeout: 30,
      connect_timeout: 10,
      ssl: process.env['NODE_ENV'] === 'production' ? 'require' : false,
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
