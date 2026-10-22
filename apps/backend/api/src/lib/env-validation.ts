// Centralised env validation for the api and pre-deploy gating.
//
// REQUIRED_ENV is the single source of truth for "which env vars does the
// backend consume, and which of them are required when NODE_ENV is
// 'production'". It is consumed by:
//   - create-app.ts at startup (fail-fast with one consolidated error so a
//     misconfigured production server crashes immediately instead of serving
//     500s per-request)
//   - scripts/check-env.ts as a CLI (local + pre-deploy gate)
//
// The Elysia API runs as one Node process on the VPS, backed by Postgres and an
// Upstash-compatible Redis REST endpoint. The analytics pipelines run in-process
// under src/analytics, driven by the VPS cron, so every var below is consumed by the api.

export const MIN_INTERNAL_SECRET_LENGTH = 32;
export const DEFAULT_ANALYTICS_BATCH_SIZE = 50;
export const MAX_ANALYTICS_BATCH_SIZE = 100;

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
      'Postgres connection string used at request time. The api keeps a pool of up to 10 connections. Boot-crashes the api if unset in production.',
    example: 'postgresql://USER:PASSWORD@HOST:5432/gravity',
  },
  {
    name: 'UPSTASH_REDIS_REST_URL',
    service: 'api',
    requiredInProd: true,
    description:
      'Upstash Redis REST endpoint backing presence, caches, and rate limiting via the connectionless @upstash/redis client. Mandatory in production (startup crash if unset). Degrades gracefully when unset in local dev.',
    example: 'https://YOUR-DB.upstash.io',
  },
  {
    name: 'UPSTASH_REDIS_REST_TOKEN',
    service: 'api',
    requiredInProd: true,
    description:
      'Upstash Redis REST token, paired with UPSTASH_REDIS_REST_URL. Mandatory in production.',
    example: '<upstash-rest-token>',
  },
  {
    name: 'INTERNAL_SECRET',
    service: 'api',
    requiredInProd: true,
    description:
      'Bearer secret guarding operator-only /api/internal/* routes (readiness, standalone cleanup/purge) and, with CRON_SECRET, the scheduled cron routes. Must contain at least 32 characters of cryptographically random material and differ from CRON_SECRET.',
    example: '<random-32-byte-hex>',
  },
  {
    name: 'CRON_SECRET',
    service: 'api',
    requiredInProd: true,
    description:
      'Required in production. The VPS cron presents it as Authorization Bearer credentials on scheduled routes only (/api/internal/maintenance, /api/internal/analytics/compute). Must not unlock operator-only internal routes. At least 32 characters of cryptographically random material and distinct from INTERNAL_SECRET.',
    example: '<cron-bearer-secret>',
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
      'Direct (non-pooled) Postgres connection string. Used ONLY by the deploy step `migrate-deploy` (drizzle migrations + idempotent seeds), which must run DDL serially against a direct connection, never PgBouncer. Falls back to DATABASE_URL when unset, and must not be a PgBouncer URL in production; not consumed at request time.',
    example: 'postgresql://USER:PASSWORD@HOST:5432/gravity',
  },
  {
    name: 'CORS_ORIGIN',
    service: 'api',
    requiredInProd: false,
    description:
      'Allowed CORS origin (or comma-separated list); also the SPA base for post-login redirects and email action links. LEAVE EMPTY for the same-origin production deployment, where API_PUBLIC_URL supplies the origin. Set a value only for split-origin local dev.',
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
      'Bounded number of least-recently-computed users processed per /api/internal/analytics/compute cron tick. Integer from 1 to 100; default 50.',
    example: '50',
  },
  {
    name: 'LOG_AUTH_ACTION_LINKS',
    service: 'api',
    requiredInProd: false,
    description:
      'Explicit local-development-only opt-in for logging full verification/reset action links. Rejected in production.',
    example: 'false',
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
      'Set to the literal string "true" only when self-hosting behind a trusted reverse proxy. Other values, including "false", do not enable X-Forwarded-For trust.',
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
    requiredInProd: true,
    description:
      'Trusted public origin used for OAuth/OIDC redirect URIs and, in same-origin deployments, email action links. Required in production, which never derives it from request Host headers. Set it to pin the canonical/custom domain; local dev falls back to the request origin or localhost.',
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

// Required-in-prod specs, deduped by name in REQUIRED_ENV declaration order. The
// Set-based dedup is defensive: every entry is now a distinct api var.
function requiredSpecs(): EnvVarSpec[] {
  const seen = new Set<string>();
  const out: EnvVarSpec[] = [];
  for (const spec of REQUIRED_ENV) {
    if (!spec.requiredInProd) continue;
    if (seen.has(spec.name)) continue;
    seen.add(spec.name);
    out.push(spec);
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

  for (const spec of requiredSpecs()) {
    if (!isPresent(env[spec.name])) missing.push(spec.name);
  }

  // Additional shape checks for vars that ARE present but fail their constraint.
  const jwt = env['JWT_SECRET'];
  if (isPresent(jwt) && jwt.length < 64) {
    errors.push(`JWT_SECRET must be at least 64 characters in production (got ${jwt.length})`);
  }

  const internalSecret = env['INTERNAL_SECRET']?.trim();
  const cronSecret = env['CRON_SECRET']?.trim();
  if (internalSecret && internalSecret.length < MIN_INTERNAL_SECRET_LENGTH) {
    errors.push(
      `INTERNAL_SECRET must be at least ${MIN_INTERNAL_SECRET_LENGTH} characters in production (got ${internalSecret.length})`
    );
  }
  if (cronSecret && cronSecret.length < MIN_INTERNAL_SECRET_LENGTH) {
    errors.push(
      `CRON_SECRET must be at least ${MIN_INTERNAL_SECRET_LENGTH} characters in production (got ${cronSecret.length})`
    );
  }
  if (internalSecret && cronSecret && internalSecret === cronSecret) {
    errors.push('INTERNAL_SECRET and CRON_SECRET must be different values in production');
  }

  if (env['LOG_AUTH_ACTION_LINKS'] === 'true') {
    errors.push('LOG_AUTH_ACTION_LINKS must not be enabled in production');
  }

  const analyticsBatchSize = env['ANALYTICS_BATCH_SIZE'];
  if (isPresent(analyticsBatchSize)) {
    const parsedBatchSize = Number(analyticsBatchSize);
    if (
      !Number.isInteger(parsedBatchSize) ||
      parsedBatchSize < 1 ||
      parsedBatchSize > MAX_ANALYTICS_BATCH_SIZE
    ) {
      errors.push(
        `ANALYTICS_BATCH_SIZE must be an integer between 1 and ${MAX_ANALYTICS_BATCH_SIZE} (got "${analyticsBatchSize}")`
      );
    }
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
