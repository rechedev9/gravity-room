/**
 * Node HTTP server for `createApp()`: production in the VPS `api` image, `pnpm dev:api`,
 * the web `api:types` codegen and the Playwright e2e webServer.
 */
import './lib/sentry';
import { serve } from '@hono/node-server';
import { createApp } from './create-app';
import { buildAppOptions } from './app-config';
import { closeDb } from './db';
import { logger } from './lib/logger';
import { closeRedis } from './lib/redis';
import { flushSentry } from './lib/sentry';
import { drainKeepAlive } from './lib/wait-until';

const app = createApp(buildAppOptions());

const PORT = Number(process.env['PORT']) || 3001;
// Unset keeps the Node default: every IPv4 and IPv6 address.
const HOSTNAME = process.env['HOST'] || undefined;

const server = serve({
  port: PORT,
  hostname: HOSTNAME,
  fetch: (request) => app.fetch(request),
});

logger.info({ port: PORT, host: HOSTNAME ?? 'all' }, 'API listening');

// Fits inside the 10 s `docker stop` grace period with the Sentry flush after it.
const DRAIN_TIMEOUT_MS = 5000;

async function closeResources(): Promise<void> {
  await drainKeepAlive(DRAIN_TIMEOUT_MS);
  await Promise.allSettled([closeDb(2), closeRedis(), flushSentry()]);
  process.exit(0);
}

// Node as PID 1 in the container ignores SIGTERM without a handler, so `docker stop`
// would wait out its timeout and kill in-flight requests and background work.
function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'API shutting down');
  server.close(() => void closeResources());
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
