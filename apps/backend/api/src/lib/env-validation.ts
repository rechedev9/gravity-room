// Centralised env validation for the api process and pre-deploy gating.
//
// REQUIRED_ENV is the single source of truth for "which env vars does any
// backend service consume, and which of them are required when NODE_ENV is
// 'production'". It is consumed by:
//   - create-app.ts at boot (fail-fast with one consolidated error)
//   - scripts/check-env.ts as a CLI (runtime + CI pre-deploy gate)
//   - validate.yml in CI (verifies .env.production.example stays in sync)
//
// Adding a new required-in-prod env var here without also updating
// .env.production.example will make the CI sync check fail. That is the
// whole point — see commit "feat(api): centralise env validation".

export type EnvVarSpec = {
  name: string;
  service: 'api' | 'analytics';
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
    description: 'PostgreSQL connection string. Boot-crashes the api if unset.',
    example: 'postgres://gravity:CHANGE_ME@postgres:5432/gravity',
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
  {
    name: 'METRICS_TOKEN',
    service: 'api',
    requiredInProd: true,
    description:
      'Bearer token for GET /metrics. Boot-crashes the api in production when unset (PR #67).',
    example: '<random-32-byte-hex>',
  },
  {
    name: 'CORS_ORIGIN',
    service: 'api',
    requiredInProd: true,
    description:
      'Allowed CORS origin (or comma-separated list). Boot-crashes in production when unset.',
    example: 'https://gravityroom.app',
  },

  // ── api: optional ────────────────────────────────────────────────────────
  {
    name: 'NODE_ENV',
    service: 'api',
    requiredInProd: false,
    description:
      'Runtime mode. Setting to "production" arms hard-fail checks (METRICS_TOKEN, CORS_ORIGIN, JWT min-len).',
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
    name: 'REDIS_URL',
    service: 'api',
    requiredInProd: false,
    description:
      'Redis connection URL. When unset, rate-limit and presence fall back to in-memory stores.',
    example: 'redis://redis:6379',
  },
  {
    name: 'SENTRY_DSN',
    service: 'api',
    requiredInProd: false,
    description: 'Sentry DSN for error tracking. captureException is a no-op when unset.',
    example: 'https://<key>@<org>.ingest.sentry.io/<project>',
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
    name: 'DB_POOL_SIZE',
    service: 'api',
    requiredInProd: false,
    description: 'postgres-js pool max connections.',
    example: '50',
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

  // ── analytics ────────────────────────────────────────────────────────────
  {
    name: 'DATABASE_URL',
    service: 'analytics',
    requiredInProd: true,
    description:
      'PostgreSQL connection string. pydantic raises ValidationError at import when unset. Should equal api DATABASE_URL.',
    example: 'postgres://gravity:CHANGE_ME@postgres:5432/gravity',
  },
  {
    name: 'INTERNAL_SECRET',
    service: 'analytics',
    requiredInProd: true,
    description:
      'Shared secret guarding POST /compute. When empty, /compute rejects every request silently.',
    example: '<random-32-byte-hex>',
  },
  {
    name: 'COMPUTE_INTERVAL_HOURS',
    service: 'analytics',
    requiredInProd: false,
    description: 'APScheduler interval for compute job.',
    example: '6',
  },
];

export type ValidateEnvResult = { ok: true } | { ok: false; missing: string[]; errors: string[] };

type EnvLike = Record<string, string | undefined>;

function isPresent(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

// Unique required-in-prod var names, in REQUIRED_ENV declaration order.
// DATABASE_URL appears for both api and analytics — same env, treat as one.
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
  // because dev workflows routinely run with partial config (no METRICS_TOKEN,
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
