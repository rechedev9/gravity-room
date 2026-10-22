import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@gzclp/database/schema';
import { logger } from '../lib/logger';
import { setServiceRlsContext } from './rls-setters';

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

/** Closes the pool; with timeoutSeconds, queries still running after it are cut off. */
export async function closeDb(timeoutSeconds?: number): Promise<void> {
  if (_client) {
    await _client.end({ timeout: timeoutSeconds });
    _client = undefined;
    _db = undefined;
  }
}

function wrapWithDefaultServiceRole(db: DbInstance): DbInstance {
  const originalTransaction = db.transaction.bind(db);
  const wrappedTransaction: DbInstance['transaction'] = (fn, options) =>
    originalTransaction(async (tx) => {
      await setServiceRlsContext(tx);
      return fn(tx);
    }, options);
  db.transaction = wrappedTransaction;
  return db;
}

export function getDb(): DbInstance {
  if (!_db) {
    const url = process.env['DATABASE_URL'];
    if (!url) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    _client = postgres(url, {
      // One long-lived process serves every request, so it needs a real pool.
      max: 10,
      // Long enough to keep warm connections and their prepared statements.
      idle_timeout: 300,
      connect_timeout: 10,
      ssl:
        process.env['DB_SSL'] === 'false'
          ? false
          : process.env['NODE_ENV'] === 'production'
            ? 'require'
            : false,
      // Startup parameters reach every pooled connection; the service role keeps
      // non-transactional queries from being denied by FORCE ROW LEVEL SECURITY.
      connection: { statement_timeout: 30_000, 'app.service_role': 'on' },
      // TCP keepalive to detect dead connections (interval in seconds)
      keep_alive: KEEP_ALIVE_INTERVAL_SECONDS,
      // Recycle connections after 1 hour
      max_lifetime: MAX_CONNECTION_LIFETIME_SECONDS,
    });
    _db = wrapWithDefaultServiceRole(drizzle(_client, { schema, logger: queryLogger }));
  }
  return _db;
}
