import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { version } from '../../package.json';

// Swagger is disabled only on TRUE production. On Vercel, NODE_ENV is "production"
// for BOTH preview and production deployments, so we must read VERCEL_ENV to tell
// them apart: preview keeps swagger ENABLED so the web api-types codegen drift
// check can target a preview URL, while production stays locked down. Off Vercel
// (local/CI) VERCEL_ENV is unset, so we fall back to NODE_ENV.
const IS_PRODUCTION =
  process.env['VERCEL_ENV'] !== undefined
    ? process.env['VERCEL_ENV'] === 'production'
    : process.env['NODE_ENV'] === 'production';

// Swagger UI is disabled in production to avoid exposing the API surface.
// Access the JSON spec directly at /swagger/json in non-production environments.
export const swaggerPlugin = IS_PRODUCTION
  ? new Elysia({ name: 'swagger-plugin' })
  : swagger({
      documentation: {
        info: {
          title: 'GZCLP Tracker API',
          version,
          description: 'REST API for the GZCLP linear progression weightlifting program tracker.',
        },
        tags: [
          { name: 'Auth', description: 'Authentication and session management' },
          { name: 'Programs', description: 'Program instance CRUD and import/export' },
          { name: 'Results', description: 'Workout result recording, deletion, and undo' },
          { name: 'Catalog', description: 'Public program definition reference data' },
          { name: 'Exercises', description: 'Exercise catalog and custom exercise management' },
          {
            name: 'Program Definitions',
            description: 'User-created program definitions',
          },
          { name: 'System', description: 'Health check and diagnostics' },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
      path: '/swagger',
      exclude: ['/swagger', '/swagger/json'],
    });
