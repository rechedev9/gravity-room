/**
 * Node HTTP server for `createApp()`: production in the VPS `api` image, `pnpm dev:api`,
 * the web `api:types` codegen and the Playwright e2e webServer.
 */
import './lib/sentry';
import { serve } from '@hono/node-server';
import { createApp } from './create-app';
import { buildAppOptions } from './app-config';
import { logger } from './lib/logger';

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

// Node as PID 1 in the container ignores SIGTERM without a handler, so `docker stop`
// would wait out its timeout and kill in-flight requests.
function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'API shutting down');
  server.close(() => process.exit(0));
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
