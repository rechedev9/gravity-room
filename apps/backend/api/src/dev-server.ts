/**
 * LOCAL-DEV-ONLY entrypoint.
 *
 * The Vercel production deployment never touches this file: it drives the API
 * through the serverless catch-all `api/[...path].ts`, which mounts the same
 * pure `createApp()` factory via `app.fetch(request)`. This module exists purely
 * so that local workflows still have a live HTTP server on `PORT`:
 *   - `bun run dev:api` (watch-mode local API on :3001),
 *   - the web `api:types` codegen and `context:refresh`, which fetch the
 *     OpenAPI spec from `http://localhost:3001/swagger/json`,
 *   - the Playwright e2e webServer (waits on `http://localhost:3001/api/health`).
 *
 * It mirrors the env wiring of `api/[...path].ts` exactly (corsOrigins, csp,
 * permissionsPolicy) via the shared `app-config.ts` so the locally served app is
 * byte-for-byte the serverless app, then serves it with `Bun.serve({ fetch })`,
 * the Bun-idiomatic listen path.
 */
import './lib/sentry';
import { createApp } from './create-app';
import { buildAppOptions } from './app-config';
import { logger } from './lib/logger';

// ---------------------------------------------------------------------------
// Build the app once and serve it on PORT (default 3001).
//
// Env wiring (corsOrigins, csp, permissionsPolicy) comes from the shared
// app-config.ts so the locally served app is byte-for-byte the serverless app
// that api/[...path].ts builds — there is no duplicated config to drift.
// ---------------------------------------------------------------------------

const app = createApp(buildAppOptions());

const PORT = Number(process.env['PORT']) || 3001;

Bun.serve({
  port: PORT,
  fetch: (request) => app.fetch(request),
});

logger.info({ port: PORT }, 'local dev API listening (serverless prod uses api/[...path].ts)');
