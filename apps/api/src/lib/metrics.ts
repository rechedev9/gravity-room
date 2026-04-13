import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [registry],
});

export const rateLimitHitsTotal = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit rejections',
  labelNames: ['endpoint'] as const,
  registers: [registry],
});

export const httpErrorsTotal = new Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP error responses (4xx and 5xx)',
  labelNames: ['status_class', 'error_code'] as const,
  registers: [registry],
});

export const dbQueriesTotal = new Counter({
  name: 'db_queries_total',
  help: 'Total number of Drizzle ORM queries executed, by query type',
  labelNames: ['query_type'] as const,
  registers: [registry],
});
