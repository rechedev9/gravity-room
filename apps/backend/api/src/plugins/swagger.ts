import { Elysia } from 'elysia';
import { version } from '../../package.json';

// Swagger is disabled whenever NODE_ENV is "production". On Vercel that covers
// BOTH preview and production deployments (Vercel sets NODE_ENV=production for
// previews too), and that is the intended behavior: `/swagger/json` is mounted
// at the app root, but vercel.json rewrites every non-`/api` path to
// `/index.html`, so the spec is unreachable on any Vercel deployment regardless.
// The CI api-types drift check does NOT depend on a live preview URL: it boots
// the pure createApp() factory locally with NODE_ENV=development (swagger ON)
// and scrapes http://localhost:3001/swagger/json. So there is no reason to
// special-case VERCEL_ENV; NODE_ENV alone gives the correct prod-off/local-on split.
const IS_PRODUCTION = process.env['NODE_ENV'] === 'production';

// Swagger UI is disabled in production to avoid exposing the API surface.
// Access the JSON spec directly at /swagger/json in non-production environments.
//
// In production we mount an empty Elysia and never touch @elysiajs/swagger. In
// non-production we lazily `import()` it inside this branch and register it as a
// deferred plugin, so the package and its heavy OpenAPI dependencies tree-shake
// out of the production bundle entirely.
export const swaggerPlugin = IS_PRODUCTION
  ? new Elysia({ name: 'swagger-plugin' })
  : new Elysia({ name: 'swagger-plugin' }).use(
      import('@elysiajs/swagger').then(({ swagger }) =>
        swagger({
          documentation: {
            info: {
              title: 'GZCLP Tracker API',
              version,
              description:
                'REST API for the GZCLP linear progression weightlifting program tracker.',
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
        })
      )
    );
