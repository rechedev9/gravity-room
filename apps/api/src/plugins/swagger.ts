import { swagger } from '@elysiajs/swagger';
import { version } from '../../package.json';

export const swaggerPlugin = swagger({
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
