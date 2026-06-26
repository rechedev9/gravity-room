// Centralised env validation for the serverless api and pre-deploy gating.
//
// REQUIRED_ENV is the single source of truth for "which env vars does the
// backend consume, and which of them are required when NODE_ENV is
// 'production'". It is consumed by:
//   - create-app.ts at cold start (fail-fast with one consolidated error so a
//     misconfigured production function crashes immediately instead of serving
//     500s per-request)
//   - scripts/check-env.ts as a CLI (local + pre-deploy gate)
//
// The product runs as ONE same-origin Vercel project: the Elysia API is a Node
// serverless function (api/[...path].ts) backed by Neon Postgres and Upstash
// Redis (REST). The analytics insight pipelines were ported to TypeScript and
// run in-process under src/analytics, driven by Vercel Cron — there is no longer
// a separate analytics service, so every var below is consumed by the api.

export type EnvVarSpec = {
  name: string;
  service: 'api';
  requiredInProd: boolean;
  description: string;
  example?: string;
};

export const REQUIRED_ENV: ReadonlyArray<EnvVarSpec> = [
  // ── api: required-in-prod ────────────────────────────────────────────────
  {
    name: 'DATABASE_URL',
    service: 'api',
    requiredInProd: true,
    description:
      'Neon POOLED (PgBouncer) connection string used at request time; host contains "-pooler". The serverless DB client opens at most one connection per warm instance (pool max=1, prepare:false). Boot-crashes the api if unset in production.',
    example: 'postgresql://USER:PASSWORD@HOST-pooler.neon.tech/gravity?sslmode=require',
  },
  {
    name: 'UPSTASH_REDIS_REST_URL',
    service: 'api',
    requiredInProd: true,
    description:
      'Upstash Redis REST endpoint backing presence, caches, and rate limiting via the connectionless @upstash/redis client. Mandatory in production (cold-start crash if unset); degrades gracefully when unset in local dev.',
    example: 'https://YOUR-DB.upstash.io',
  },
  {
    name: 'UPSTASH_REDIS_REST_TOKEN',
    service: 'api',
    requiredInProd: true,
    description:
      'Upstash Redis REST token, paired with UPSTASH_REDIS_REST_URL. Mandatory in production alongside the URL.',
    example: '<upstash-rest-token>',
  },
  {
    name: 'INTERNAL_SECRET',
    service: 'api',
    requiredInProd: true,
    description:
      'Bearer secret guarding the manual ops path of /api/internal/* (cleanup-tokens, purge-users, analytics/compute). The internal guard fails closed: if neither INTERNAL_SECRET nor CRON_SECRET is set, every internal request is rejected 401.',
    example: '<random-32-byte-hex>',
  },
  {
    name: 'CRON_SECRET',
    service: 'api',
    requiredInProd: true,
    description:
      'Required in production. Vercel Cron injects it as `Authorization: Bearer <CRON_SECRET>` on every scheduled invocation of the /api/internal/* cron routes; without it every scheduled cron run is rejected 401 and cleanup/purge/analytics silently stop. Set the value in the Vercel project; not needed for local dev.',
    example: '<vercel-cron-bearer-secret>',
  },
  {
    name: 'JWT_SECRET',
    service: 'api',
    requiredInProd: true,
    description: 'JWT signing secret. Must be >= 64 chars in production; >= 32 elsewhere.',
    example: '<min-64-chars-random-string>',
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    service: 'api',
    requiredInProd: true,
    description: 'Web Google OAuth client ID. Throws per-request 500 when unset.',
    example: '<web-google-client-id>.apps.googleusercontent.com',
  },
  {
    name: 'GOOGLE_CLIENT_IDS',
    service: 'api',
    requiredInProd: true,
    description:
      'Comma-separated Google OAuth client IDs accepted by mobile auth endpoints (android,ios,web).',
    example:
      '<android>.apps.googleusercontent.com,<ios>.apps.googleusercontent.com,<web>.apps.googleusercontent.com',
  },

  // ── api: optional ────────────────────────────────────────────────────────
  {
    name: 'DIRECT_DATABASE_URL',
    service: 'api',
    requiredInProd: false,
    description:
      'Neon DIRECT (non-pooled) connection string. Used ONLY by the build-time deploy step `bun run --filter api db:deploy` (drizzle migrations + idempotent seeds), which must run DDL serially against a direct connection, never PgBouncer. Falls back to DATABASE_URL when unset, so it is not consumed at request time.',
    example: 'postgresql://USER:PASSWORD@HOST.neon.tech/gravity?sslmode=require',
  },
  {
    name: 'CORS_ORIGIN',
    service: 'api',
    requiredInProd: false,
    description:
      'Allowed CORS origin (or comma-separated list). LEAVE EMPTY for the same-origin Vercel deployment (the SPA and API share an origin, so no cross-origin is allowed). Set a value only for split-origin local dev.',
    example: '',
  },
  {
    name: 'NODE_ENV',
    service: 'api',
    requiredInProd: false,
    description:
      'Runtime mode. Setting to "production" arms hard-fail checks (DATABASE_URL, UPSTASH_REDIS_REST_*, INTERNAL_SECRET, CRON_SECRET, GOOGLE_CLIENT_ID(S), JWT min-len).',
    example: 'production',
  },
  {
    name: 'PORT',
    service: 'api',
    requiredInProd: false,
    description: 'HTTP port for the api server.',
    example: '3001',
  },
  {
    name: 'LOG_LEVEL',
    service: 'api',
    requiredInProd: false,
    description: 'Pino log level: trace | debug | info | warn | error | fatal | silent.',
    example: 'info',
  },
  {
    name: 'ANALYTICS_BATCH_SIZE',
    service: 'api',
    requiredInProd: false,
    description:
      'Bounded number of least-recently-computed users processed per /api/internal/analytics/compute cron tick. Default 50.',
    example: '50',
  },
  {
    name: 'SENTRY_DSN',
    service: 'api',
    requiredInProd: false,
    description:
      '@sentry/node DSN for error + performance tracing. captureException is a no-op when unset. Pull-based /metrics was removed; observability is Sentry plus pino JSON logs.',
    example: 'https://<key>@<org>.ingest.sentry.io/<project>',
  },
  {
    name: 'SENTRY_TRACES_SAMPLE_RATE',
    service: 'api',
    requiredInProd: false,
    description:
      'Fraction of transactions sampled for @sentry/node performance tracing. Default 0.1.',
    example: '0.1',
  },
  {
    name: 'TRUSTED_PROXY',
    service: 'api',
    requiredInProd: false,
    description:
      'Truthy when behind a reverse proxy (reads X-Forwarded-For for rate limiting). Any non-empty string is truthy, including "false".',
    example: 'true',
  },
  {
    name: 'TELEGRAM_BOT_TOKEN',
    service: 'api',
    requiredInProd: false,
    description: 'Telegram bot token for new-user alerts. Silent no-op when unset.',
    example: '<bot-token-from-@BotFather>',
  },
  {
    name: 'TELEGRAM_CHAT_ID',
    service: 'api',
    requiredInProd: false,
    description: 'Telegram chat/channel ID for new-user alerts. Silent no-op when unset.',
    example: '-1001234567890',
  },
  {
    name: 'JWT_ACCESS_EXPIRY',
    service: 'api',
    requiredInProd: false,
    description: 'Access-token lifetime (jose duration string).',
    example: '15m',
  },
  {
    name: 'AUTH_DEV_ROUTE_ENABLED',
    service: 'api',
    requiredInProd: false,
    description:
      'Enables POST /api/auth/dev (E2E test sign-in). Hard-disabled in production regardless of value.',
    example: 'false',
  },
  {
    name: 'AUTH_DEV_ROUTE_SECRET',
    service: 'api',
    requiredInProd: false,
    description:
      'Shared secret (>= 16 chars) required in the x-dev-auth-secret header by POST /api/auth/dev. The route is not registered unless this is set; never set in production.',
    example: '<random-32-byte-hex>',
  },
  {
    name: 'SWAGGER_ENABLED',
    service: 'api',
    requiredInProd: false,
    description:
      'Exposes /swagger UI and /swagger/json. Hard-disabled in production regardless of value.',
    example: 'false',
  },
  {
    name: 'DB_SSL',
    service: 'api',
    requiredInProd: false,
    description:
      'Set to the literal string "false" to disable SSL. Any other value keeps SSL enabled in production.',
    example: 'false',
  },
  {
    name: 'API_PUBLIC_URL',
    service: 'api',
    requiredInProd: false,
    description:
      'Public base URL of this API, used to build OAuth/OIDC redirect URIs (Apple/GitHub). Falls back to http://localhost:3001 when unset.',
    example: 'https://gravityroom.app',
  },
  {
    name: 'RESEND_API_KEY',
    service: 'api',
    requiredInProd: false,
    description:
      'Resend API key for transactional email (verification, password reset). Email sending is a silent no-op when unset; required once email/password sign-in is live.',
    example: 're_<resend-api-key>',
  },
  {
    name: 'EMAIL_FROM',
    service: 'api',
    requiredInProd: false,
    description:
      'From address for transactional email. Required alongside RESEND_API_KEY for email to send.',
    example: 'Gravity Room <auth@gravityroom.app>',
  },
  {
    name: 'APPLE_CLIENT_ID',
    service: 'api',
    requiredInProd: false,
    description:
      'Apple Service ID (audience) for Sign in with Apple. Apple sign-in is disabled when unset.',
    example: 'app.gravityroom.web',
  },
  {
    name: 'GITHUB_CLIENT_ID',
    service: 'api',
    requiredInProd: false,
    description:
      'GitHub OAuth app client ID. GitHub sign-in is disabled unless both id and secret are set.',
    example: '<github-oauth-client-id>',
  },
  {
    name: 'GITHUB_CLIENT_SECRET',
    service: 'api',
    requiredInProd: false,
    description: 'GitHub OAuth app client secret. Pairs with GITHUB_CLIENT_ID.',
    example: '<github-oauth-client-secret>',
  },
  {
    name: 'MICROSOFT_CLIENT_ID',
    service: 'api',
    requiredInProd: false,
    description:
      'Microsoft identity platform application client ID. Microsoft/Outlook sign-in is disabled unless both id and secret are set.',
    example: '<microsoft-application-client-id>',
  },
  {
    name: 'MICROSOFT_CLIENT_SECRET',
    service: 'api',
    requiredInProd: false,
    description: 'Microsoft identity platform client secret. Pairs with MICROSOFT_CLIENT_ID.',
    example: '<microsoft-client-secret>',
  },
  {
    name: 'MICROSOFT_TENANT_ID',
    service: 'api',
    requiredInProd: false,
    description:
      'Microsoft tenant segment for OAuth endpoints. Defaults to consumers for Outlook/Microsoft personal accounts; set common, organizations, or a tenant id when needed.',
    example: 'consumers',
  },
];

export type ValidateEnvResult = { ok: true } | { ok: false; missing: string[]; errors: string[] };

type EnvLike = Record<string, string | undefined>;

function isPresent(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

// Unique required-in-prod var names, in REQUIRED_ENV declaration order. The
// Set-based dedup is defensive: every entry is now a distinct api var.
function requiredNames(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const spec of REQUIRED_ENV) {
    if (!spec.requiredInProd) continue;
    if (seen.has(spec.name)) continue;
    seen.add(spec.name);
    out.push(spec.name);
  }
  return out;
}

export function validateEnv(
  env: EnvLike = process.env,
  nodeEnv: string = env['NODE_ENV'] ?? 'development'
): ValidateEnvResult {
  // Validation is only enforced in production. Dev/test envs are permissive
  // because dev workflows routinely run with partial config (no UPSTASH_*,
  // no GOOGLE_CLIENT_*, etc.) and we don't want to break `bun run dev:api`.
  if (nodeEnv !== 'production') return { ok: true };

  const missing: string[] = [];
  const errors: string[] = [];

  for (const name of requiredNames()) {
    if (!isPresent(env[name])) missing.push(name);
  }

  // Additional shape checks for vars that ARE present but fail their constraint.
  const jwt = env['JWT_SECRET'];
  if (isPresent(jwt) && jwt.length < 64) {
    errors.push(`JWT_SECRET must be at least 64 characters in production (got ${jwt.length})`);
  }

  const port = env['PORT'];
  if (isPresent(port) && !Number.isInteger(Number(port))) {
    errors.push(`PORT must parse as an integer (got "${port}")`);
  }

  if (missing.length === 0 && errors.length === 0) return { ok: true };
  return { ok: false, missing, errors };
}

export function formatValidationError(result: Extract<ValidateEnvResult, { ok: false }>): string {
  const lines: string[] = ['Environment validation failed for NODE_ENV=production:'];
  if (result.missing.length > 0) {
    lines.push('', 'Missing required env vars:');
    for (const name of result.missing) {
      const spec = REQUIRED_ENV.find((s) => s.name === name && s.requiredInProd);
      lines.push(`  - ${name}${spec ? ` — ${spec.description}` : ''}`);
    }
  }
  if (result.errors.length > 0) {
    lines.push('', 'Constraint violations:');
    for (const err of result.errors) lines.push(`  - ${err}`);
  }
  return lines.join('\n');
}
