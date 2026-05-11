import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { version } from '../../package.json';

const IS_PRODUCTION = process.env['NODE_ENV'] === 'production';
// Positive feature flag: must be explicitly enabled, and never in production.
const SWAGGER_ENABLED = process.env['SWAGGER_ENABLED'] === 'true' && !IS_PRODUCTION;

// Swagger UI is disabled by default to avoid exposing the API surface.
// Set SWAGGER_ENABLED=true in non-production environments to expose /swagger and /swagger/json.
export const swaggerPlugin = !SWAGGER_ENABLED
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
