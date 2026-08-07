var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all) __defProp(target, name, { get: all[name], enumerable: true });
};

// apps/backend/api/src/lib/app-url.ts
var DEFAULT_DEV_WEB_ORIGIN = 'http://localhost:5173';
function originFromRequest(request) {
  if (!request) return void 0;
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host')?.trim();
  if (!host) return void 0;
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
  return `${proto}://${host}`;
}
function configuredOrigin(raw, name) {
  const value = raw?.trim();
  if (!value) return void 0;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute http(s) origin`);
  }
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error(`${name} must be an absolute http(s) origin without credentials or a path`);
  }
  return url.origin;
}
function trustedVercelOrigin() {
  if (process.env['VERCEL'] !== '1') return void 0;
  const host =
    process.env['VERCEL_ENV'] === 'production'
      ? (process.env['VERCEL_PROJECT_PRODUCTION_URL'] ?? process.env['VERCEL_URL'])
      : (process.env['VERCEL_URL'] ?? process.env['VERCEL_PROJECT_PRODUCTION_URL']);
  if (!host) return void 0;
  return configuredOrigin(`https://${host}`, 'Vercel public URL');
}
function productionOriginError() {
  throw new Error(
    'A trusted public origin is required in production; set API_PUBLIC_URL or use Vercel system environment variables'
  );
}
function getWebBaseUrl(request) {
  const configuredWeb = configuredOrigin(process.env['CORS_ORIGIN']?.split(',')[0], 'CORS_ORIGIN');
  if (configuredWeb) return configuredWeb;
  const configuredApi = configuredOrigin(process.env['API_PUBLIC_URL'], 'API_PUBLIC_URL');
  if (configuredApi) return configuredApi;
  const vercel = trustedVercelOrigin();
  if (vercel) return vercel;
  if (process.env['NODE_ENV'] === 'production') return productionOriginError();
  const fromRequest = originFromRequest(request);
  if (fromRequest) {
    const url = new URL(fromRequest);
    const isLocalApi =
      process.env['NODE_ENV'] !== 'production' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]') &&
      url.port === '3001';
    return isLocalApi ? DEFAULT_DEV_WEB_ORIGIN : fromRequest;
  }
  return DEFAULT_DEV_WEB_ORIGIN;
}
function getApiBaseUrl(request) {
  const configured = configuredOrigin(process.env['API_PUBLIC_URL'], 'API_PUBLIC_URL');
  if (configured) return configured;
  const vercel = trustedVercelOrigin();
  if (vercel) return vercel;
  if (process.env['NODE_ENV'] === 'production') return productionOriginError();
  const fromRequest = originFromRequest(request);
  if (fromRequest) return fromRequest;
  return 'http://localhost:3001';
}

// apps/backend/api/src/app-config.ts
function parseCorsOrigins(raw) {
  if (!raw) {
    return process.env['NODE_ENV'] === 'production' ? [] : DEFAULT_DEV_WEB_ORIGIN;
  }
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const origin of origins) {
    let url;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGIN contains invalid URL: "${origin}"`);
    }
    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:') ||
      url.username !== '' ||
      url.password !== '' ||
      url.pathname !== '/' ||
      url.search !== '' ||
      url.hash !== '' ||
      (url.origin !== origin && `${url.origin}/` !== origin)
    ) {
      throw new Error(`CORS_ORIGIN must contain http(s) origins only: "${origin}"`);
    }
  }
  const first = origins[0];
  return origins.length === 1 && first !== void 0 ? first : origins;
}
var CSP =
  "default-src 'self'; script-src 'self' https://accounts.google.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; img-src 'self' data: blob: https://lh3.googleusercontent.com; connect-src 'self' https://accounts.google.com https://www.googleapis.com https://*.ingest.sentry.io; font-src 'self' https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src https://accounts.google.com; frame-ancestors 'none'; upgrade-insecure-requests";
var PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()';
function buildAppOptions() {
  return {
    corsOrigins: parseCorsOrigins(process.env['CORS_ORIGIN']),
    csp: CSP,
    permissionsPolicy: PERMISSIONS_POLICY,
  };
}

// apps/backend/api/src/lib/sentry.ts
import * as Sentry from '@sentry/node';

// apps/backend/api/src/lib/redact-sensitive.ts
function redactSensitiveText(value) {
  return value
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)([^\s/:@]+):([^\s/@]+)@/gi, '$1[Redacted]:[Redacted]@')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [Redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[Redacted JWT]')
    .replace(/([?&](?:token|password|secret|api_key|apikey)=)[^&#\s]+/gi, '$1[Redacted]')
    .replace(/(\/bot)\d+:[\w-]+/g, '$1[Redacted]');
}
function sanitizedError(error) {
  if (!(error instanceof Error)) return error;
  const sanitized = new Error(redactSensitiveText(error.message));
  sanitized.name = error.name;
  if (error.stack) sanitized.stack = redactSensitiveText(error.stack);
  return sanitized;
}

// apps/backend/api/src/lib/sentry.ts
var dsn = process.env['SENTRY_DSN'];
if (dsn) {
  const rawRate = process.env['SENTRY_TRACES_SAMPLE_RATE']?.trim();
  const parsedRate = rawRate ? Number(rawRate) : Number.NaN;
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    // Performance tracing: push-based traces replace the deleted pull metrics.
    tracesSampleRate: Number.isFinite(parsedRate) ? parsedRate : 0.1,
    // Never attach PII (client IP, cookies, request headers/bodies) to events.
    sendDefaultPii: false,
    // Belt-and-suspenders: strip request headers/cookies/body from any event an
    // integration may have populated before it leaves the process. sendDefaultPii
    // already withholds most of this, but this guarantees credentials in an
    // Authorization header, session cookie, or JSON body never reach Sentry.
    beforeSend(event) {
      if (event.request) {
        delete event.request.headers;
        delete event.request.cookies;
        delete event.request.data;
      }
      return event;
    },
  });
}
function captureException2(error) {
  if (!dsn) return;
  Sentry.captureException(sanitizedError(error));
}
async function flushSentry(timeoutMs = 2e3) {
  if (!dsn) return;
  await Sentry.flush(timeoutMs);
}

// apps/backend/api/src/lib/wait-until.ts
import { waitUntil } from '@vercel/functions';

// apps/backend/api/src/lib/logger.ts
import pino from 'pino';
var isProduction = process.env['NODE_ENV'] === 'production';
var isTest = process.env['NODE_ENV'] === 'test';
function secureErrorSerializer(error) {
  if (!(error instanceof Error)) {
    return { type: 'NonError', message: redactSensitiveText(String(error)) };
  }
  const serialized = pino.stdSerializers.err(error);
  return {
    ...serialized,
    ...(typeof serialized.message === 'string'
      ? { message: redactSensitiveText(serialized.message) }
      : {}),
    ...(typeof serialized.stack === 'string'
      ? { stack: redactSensitiveText(serialized.stack) }
      : {}),
  };
}
var loggerRedactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.headers.authorization',
  '*.headers.cookie',
  'authorization',
  '*.authorization',
  'cookie',
  '*.cookie',
  'password',
  '*.password',
  'passwordHash',
  '*.passwordHash',
  'password_hash',
  '*.password_hash',
  'token',
  '*.token',
  'tokenHash',
  '*.tokenHash',
  'token_hash',
  '*.token_hash',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'secret',
  '*.secret',
  'apiKey',
  '*.apiKey',
];
var logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  serializers: { ...pino.stdSerializers, err: secureErrorSerializer, error: secureErrorSerializer },
  redact: {
    paths: loggerRedactPaths,
    censor: '[Redacted]',
  },
  ...(!isProduction && !isTest
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

// apps/backend/api/src/lib/wait-until.ts
function keepAlive(promise) {
  const settled = promise.catch((err2) => {
    logger.warn({ err: err2 }, 'background task failed');
  });
  if (process.env['VERCEL']) {
    try {
      waitUntil(settled);
      return;
    } catch {}
  }
  void settled;
}

// apps/backend/api/src/create-app.ts
import { Elysia as Elysia12 } from 'elysia';
import { cors } from '@elysiajs/cors';

// apps/backend/api/src/middleware/error-handler.ts
var ApiError = class extends Error {
  constructor(statusCode, message, code, options) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    if (options?.headers) this.headers = options.headers;
    if (options?.details) this.details = options.details;
  }
};

// apps/backend/api/src/middleware/request-logger.ts
import { Elysia } from 'elysia';
import { randomUUID } from 'crypto';
import { isIP } from 'node:net';
function isVercelEnvironment(value) {
  return value === '1';
}
var ON_VERCEL = isVercelEnvironment(process.env['VERCEL']);
var TRUSTED_PROXY = process.env['TRUSTED_PROXY'] === 'true' || ON_VERCEL;
function clientIpFromXff(xff) {
  const parts = xff.split(',');
  for (let i = parts.length - 1; i >= 0; i--) {
    const candidate = parts[i]?.trim();
    if (candidate && isIP(candidate) !== 0) return candidate;
  }
  return void 0;
}
function clientIpFromVercelXff(xff) {
  for (const raw of xff.split(',')) {
    const candidate = raw.trim();
    if (candidate && isIP(candidate) !== 0) return candidate;
  }
  return void 0;
}
function deriveClientIp(headers, env) {
  if (env.onVercel) {
    const vercelXff = headers.get('x-vercel-forwarded-for');
    if (vercelXff) return clientIpFromVercelXff(vercelXff) ?? 'unknown';
    return 'unknown';
  }
  if (env.trustedProxy) {
    const xff = headers.get('x-forwarded-for');
    if (xff) return clientIpFromXff(xff) ?? 'unknown';
  }
  return 'unknown';
}
function resolveResponseStatus(responseValue, setStatus) {
  if (responseValue instanceof Response) return responseValue.status;
  if (typeof responseValue === 'object' && responseValue !== null) {
    const status = Reflect.get(responseValue, 'status');
    const headers = Reflect.get(responseValue, 'headers');
    const clone = Reflect.get(responseValue, 'clone');
    if (
      typeof status === 'number' &&
      Number.isInteger(status) &&
      status >= 200 &&
      status <= 599 &&
      typeof headers === 'object' &&
      headers !== null &&
      typeof clone === 'function'
    ) {
      return status;
    }
  }
  return setStatus ?? 200;
}
var REQ_ID_RE = /^[\w-]{8,64}$/;
function safeRequestPath(rawUrl) {
  try {
    return new URL(rawUrl, 'http://localhost').pathname;
  } catch {
    return '/<invalid-url>';
  }
}
function validRequestId(value) {
  return typeof value === 'string' && REQ_ID_RE.test(value);
}
function earlyResponse(responseValue, status, setHeaders) {
  if (responseValue instanceof Response) return responseValue;
  const headers = new Headers();
  for (const [name, value] of Object.entries(setHeaders)) headers.set(name, String(value));
  if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8');
  const numericStatus = typeof status === 'number' ? status : Number(status);
  return new Response(JSON.stringify(responseValue ?? null), {
    status: Number.isInteger(numericStatus) ? numericStatus : 500,
    headers,
  });
}
var requestLogger = new Elysia({ name: 'request-logger' })
  .derive({ as: 'global' }, ({ request }) => {
    const rawReqId = request.headers.get('x-request-id');
    const reqId = rawReqId && REQ_ID_RE.test(rawReqId) ? rawReqId : randomUUID();
    const method = request.method;
    const url = safeRequestPath(request.url);
    const ip = deriveClientIp(request.headers, {
      onVercel: ON_VERCEL,
      trustedProxy: TRUSTED_PROXY,
    });
    const startMs = Date.now();
    const reqLogger = logger.child({ reqId, method, url, ip });
    reqLogger.info('incoming request');
    return { reqId, reqLogger, startMs, ip };
  })
  .mapResponse({ as: 'global' }, ({ reqId, reqLogger, startMs, set, responseValue, request }) => {
    const hasDerivedContext = validRequestId(reqId) && reqLogger !== void 0;
    const responseReqId = validRequestId(reqId) ? reqId : randomUUID();
    const responseLogger =
      reqLogger ??
      logger.child({
        reqId: responseReqId,
        method: request.method,
        url: safeRequestPath(request.url),
        ip: deriveClientIp(request.headers, {
          onVercel: ON_VERCEL,
          trustedProxy: TRUSTED_PROXY,
        }),
      });
    const status = resolveResponseStatus(responseValue, set.status);
    const latencyMs = typeof startMs === 'number' ? Date.now() - startMs : void 0;
    set.headers['x-request-id'] = responseReqId;
    responseLogger.info({ status, latencyMs }, 'request completed');
    if (!hasDerivedContext) return earlyResponse(responseValue, status, set.headers);
  });

// apps/backend/api/src/plugins/swagger.ts
import { Elysia as Elysia2 } from 'elysia';

// apps/backend/api/package.json
var version = '0.0.1';

// apps/backend/api/src/plugins/swagger.ts
var IS_PRODUCTION = process.env['NODE_ENV'] === 'production';
var swaggerPlugin = IS_PRODUCTION
  ? new Elysia2({ name: 'swagger-plugin' })
  : new Elysia2({ name: 'swagger-plugin' }).use(
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

// apps/backend/api/src/routes/auth.ts
import { Elysia as Elysia4, t } from 'elysia';
import { createHmac, timingSafeEqual } from 'node:crypto';

// apps/backend/api/src/middleware/auth-guard.ts
import { Elysia as Elysia3 } from 'elysia';
import { jwt } from '@elysiajs/jwt';

// apps/backend/api/src/lib/redis.ts
import { Redis } from '@upstash/redis';
function resolveRedisCredentials() {
  return {
    url: process.env['UPSTASH_REDIS_REST_URL'] ?? process.env['KV_REST_API_URL'],
    token: process.env['UPSTASH_REDIS_REST_TOKEN'] ?? process.env['KV_REST_API_TOKEN'],
  };
}
function assertRedisConfigured() {
  const { url, token } = resolveRedisCredentials();
  if (process.env['NODE_ENV'] === 'production' && (!url || !token)) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL/KV_REST_API_TOKEN) are required in production'
    );
  }
}
assertRedisConfigured();
var _redis;
var _warnedMissing = false;
function getRedis() {
  if (_redis) return _redis;
  const { url, token } = resolveRedisCredentials();
  if (!url || !token) {
    if (!_warnedMissing) {
      _warnedMissing = true;
      logger.warn('Upstash Redis not configured; presence and caches disabled');
    }
    return void 0;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

// apps/backend/api/src/lib/presence.ts
var PRESENCE_TTL_SEC = 60;
var PRESENCE_SORTED_SET_KEY = 'users:online';
var TTL_MS = PRESENCE_TTL_SEC * 1e3;
var TRACK_DEBOUNCE_MS = 3e4;
var MAX_DEBOUNCE_ENTRIES = 1e4;
var lastTrackByUser = /* @__PURE__ */ new Map();
var lastDebounceCleanupAt = 0;
function prunePresenceDebounce(now) {
  if (now - lastDebounceCleanupAt >= TRACK_DEBOUNCE_MS) {
    for (const [userId, lastTrackAt] of lastTrackByUser) {
      if (now - lastTrackAt >= TRACK_DEBOUNCE_MS) {
        lastTrackByUser.delete(userId);
      }
    }
    lastDebounceCleanupAt = now;
  }
  if (lastTrackByUser.size >= MAX_DEBOUNCE_ENTRIES) {
    const oldest = lastTrackByUser.keys().next();
    if (!oldest.done) lastTrackByUser.delete(oldest.value);
  }
}
function trackPresence(userId, redis) {
  const now = Date.now();
  const last = lastTrackByUser.get(userId);
  if (last !== void 0 && now - last < TRACK_DEBOUNCE_MS) {
    return Promise.resolve();
  }
  prunePresenceDebounce(now);
  lastTrackByUser.set(userId, now);
  return redis.zadd(PRESENCE_SORTED_SET_KEY, { score: now, member: userId });
}
async function countOnlineUsers(redis) {
  const cutoff = Date.now() - TTL_MS;
  await redis.zremrangebyscore(PRESENCE_SORTED_SET_KEY, '-inf', cutoff);
  return redis.zcard(PRESENCE_SORTED_SET_KEY);
}

// apps/backend/api/src/services/auth.ts
import { eq, lt, gte, and, isNull, sql as sql2 } from 'drizzle-orm';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import bcrypt from 'bcryptjs';

// packages/domain/src/type-guards.ts
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// apps/backend/api/src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// packages/database/src/schema.ts
var schema_exports = {};
__export(schema_exports, {
  emailVerificationTokens: () => emailVerificationTokens,
  emailVerificationTokensRelations: () => emailVerificationTokensRelations,
  exercises: () => exercises,
  exercisesRelations: () => exercisesRelations,
  instanceStatusEnum: () => instanceStatusEnum,
  muscleGroups: () => muscleGroups,
  passwordResetTokens: () => passwordResetTokens,
  passwordResetTokensRelations: () => passwordResetTokensRelations,
  programDefinitionStatusEnum: () => programDefinitionStatusEnum,
  programDefinitions: () => programDefinitions,
  programDefinitionsRelations: () => programDefinitionsRelations,
  programInstances: () => programInstances,
  programInstancesRelations: () => programInstancesRelations,
  programTemplates: () => programTemplates,
  refreshTokens: () => refreshTokens,
  refreshTokensRelations: () => refreshTokensRelations,
  resultTypeEnum: () => resultTypeEnum,
  undoEntries: () => undoEntries,
  undoEntriesRelations: () => undoEntriesRelations,
  userIdentities: () => userIdentities,
  userIdentitiesRelations: () => userIdentitiesRelations,
  userInsights: () => userInsights,
  userInsightsRelations: () => userInsightsRelations,
  users: () => users,
  usersRelations: () => usersRelations,
  workoutResults: () => workoutResults,
  workoutResultsRelations: () => workoutResultsRelations,
});
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  smallint,
  bigserial,
  index,
  unique,
  uniqueIndex,
  boolean,
  integer,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { relations, desc, sql } from 'drizzle-orm';
var instanceStatusEnum = pgEnum('instance_status', ['active', 'completed', 'archived']);
var resultTypeEnum = pgEnum('result_type', ['success', 'fail']);
var programDefinitionStatusEnum = pgEnum('program_definition_status', [
  'draft',
  'pending_review',
  'approved',
  'rejected',
]);
var users = pgTable(
  'users',
  {
    id: uuid().defaultRandom().primaryKey(),
    email: varchar({ length: 255 }).unique().notNull(),
    /**
     * Legacy Google identity column. External identities now live in
     * `user_identities`; this is kept (nullable) for backfill and back-compat
     * and is no longer the identity key. New non-Google users have it NULL.
     */
    googleId: varchar('google_id', { length: 255 }).unique(),
    /** argon2id hash for the email/password method (NULL for OAuth-only users). */
    passwordHash: text('password_hash'),
    /** True once the email is provider-verified (OAuth) or confirmed via link. */
    emailVerified: boolean('email_verified').notNull().default(false),
    /** Incremented whenever every session must be invalidated. Embedded in access JWTs. */
    authVersion: integer('auth_version').notNull().default(0),
    name: varchar({ length: 100 }),
    avatarUrl: text('avatar_url'),
    /**
     * Soft-delete timestamp. When set, the user is in a 30-day grace period
     * before `purge-deleted-users.ts` hard-deletes (CASCADE) the row and all
     * related data. The `/me` and token-refresh paths filter
     * `WHERE deleted_at IS NULL` (via `findUserById()` and token rotation), so a
     * soft-deleted user cannot fetch their profile or obtain new tokens. The
     * resource-route guard also reloads the active user and compares
     * `auth_version`, so deletion or explicit all-session revocation rejects
     * existing access tokens immediately.
     */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Partial index for the soft-delete purge job (scans only deleted rows).
    index('users_deleted_at_idx')
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} IS NOT NULL`),
  ]
);
var usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  identities: many(userIdentities),
  programInstances: many(programInstances),
  programDefinitions: many(programDefinitions),
  userInsights: many(userInsights),
}));
var refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).unique().notNull(),
    /**
     * Stable browser/native session family shared by every token rotation.
     *
     * Migration 0044 intentionally leaves the physical column nullable during
     * expand/contract rollout so the previous artifact can remain live. Its
     * database default covers inserts from that old artifact, and the migration
     * repairs existing rows. Runtime code therefore keeps the stronger non-null
     * invariant; the physical NOT NULL contract is a future migration after old
     * writers have been retired (docs/DATABASE_SECURITY_ROLLOUT.md).
     */
    familyId: uuid('family_id').defaultRandom().notNull(),
    /**
     * Hash of the immediate predecessor. Consumed rows are retained as
     * tombstones, so this link remains available for benign double-refresh
     * detection and full-family replay response.
     */
    previousTokenHash: varchar('previous_token_hash', { length: 64 }),
    /** Set atomically when this token is rotated. NULL means it is the active family tip. */
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('refresh_tokens_user_id_idx').on(table.userId),
    index('refresh_tokens_family_id_idx').on(table.familyId),
    index('refresh_tokens_expires_at_idx').on(table.expiresAt),
    // A family has exactly one unconsumed tip. The unique partial index is a
    // database backstop in addition to the row lock used during rotation.
    uniqueIndex('refresh_tokens_one_active_per_family_uq')
      .on(table.familyId)
      .where(sql`${table.consumedAt} IS NULL`),
    index('refresh_tokens_previous_token_hash_partial_idx')
      .on(table.previousTokenHash)
      .where(sql`${table.previousTokenHash} IS NOT NULL`),
  ]
);
var refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));
var userIdentities = pgTable(
  'user_identities',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    provider: varchar({ length: 20 }).notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('user_identities_provider_account_uq').on(table.provider, table.providerAccountId),
    index('user_identities_user_id_idx').on(table.userId),
  ]
);
var userIdentitiesRelations = relations(userIdentities, ({ one }) => ({
  user: one(users, { fields: [userIdentities.userId], references: [users.id] }),
}));
var passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).unique().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('password_reset_tokens_user_id_idx').on(table.userId),
    index('password_reset_tokens_expires_at_idx').on(table.expiresAt),
  ]
);
var passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));
var emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).unique().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('email_verification_tokens_user_id_idx').on(table.userId),
    index('email_verification_tokens_expires_at_idx').on(table.expiresAt),
  ]
);
var emailVerificationTokensRelations = relations(emailVerificationTokens, ({ one }) => ({
  user: one(users, { fields: [emailVerificationTokens.userId], references: [users.id] }),
}));
var programInstances = pgTable(
  'program_instances',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    templateId: varchar('template_id', { length: 50 }).notNull(),
    /** UUID FK to program_definitions — set when the user forks/customises a program. */
    definitionId: uuid('definition_id'),
    /** Inline snapshot of the forked definition (denormalised for offline / fast reads). */
    customDefinition: jsonb('custom_definition'),
    name: varchar({ length: 100 }).notNull(),
    programConfig: jsonb('program_config').notNull(),
    metadata: jsonb('metadata'),
    status: instanceStatusEnum().notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.definitionId],
      foreignColumns: [programDefinitions.id],
      name: 'program_instances_definition_id_program_definitions_id_fk',
    }).onDelete('set null'),
    index('program_instances_user_status_idx').on(table.userId, table.status),
    index('program_instances_user_created_id_idx').on(
      table.userId,
      desc(table.createdAt),
      table.id
    ),
  ]
);
var programInstancesRelations = relations(programInstances, ({ one, many }) => ({
  user: one(users, { fields: [programInstances.userId], references: [users.id] }),
  programTemplate: one(programTemplates, {
    fields: [programInstances.templateId],
    references: [programTemplates.id],
  }),
  definition: one(programDefinitions, {
    fields: [programInstances.definitionId],
    references: [programDefinitions.id],
  }),
  workoutResults: many(workoutResults),
  undoEntries: many(undoEntries),
}));
var workoutResults = pgTable(
  'workout_results',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    instanceId: uuid('instance_id')
      .references(() => programInstances.id, { onDelete: 'cascade' })
      .notNull(),
    workoutIndex: smallint('workout_index').notNull(),
    slotId: varchar('slot_id', { length: 50 }).notNull(),
    /** Stable exercise identity captured from the exact definition used for validation. */
    exerciseId: varchar('exercise_id', { length: 100 }),
    /** Program-definition version that supplied exerciseId. Nullable only for unresolved legacy rows. */
    definitionVersion: smallint('definition_version'),
    result: resultTypeEnum().notNull(),
    amrapReps: smallint('amrap_reps'),
    rpe: smallint('rpe'),
    setLogs: jsonb('set_logs'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('workout_results_instance_slot_uq').on(
      table.instanceId,
      table.workoutIndex,
      table.slotId
    ),
    index('workout_results_instance_id_idx').on(table.instanceId),
    index('workout_results_instance_workout_idx').on(table.instanceId, table.workoutIndex),
  ]
);
var workoutResultsRelations = relations(workoutResults, ({ one }) => ({
  instance: one(programInstances, {
    fields: [workoutResults.instanceId],
    references: [programInstances.id],
  }),
}));
var undoEntries = pgTable(
  'undo_entries',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    instanceId: uuid('instance_id')
      .references(() => programInstances.id, { onDelete: 'cascade' })
      .notNull(),
    workoutIndex: smallint('workout_index').notNull(),
    slotId: varchar('slot_id', { length: 50 }).notNull(),
    previousResult: resultTypeEnum('previous_result'),
    previousAmrapReps: smallint('previous_amrap_reps'),
    previousRpe: smallint('previous_rpe'),
    previousSetLogs: jsonb('previous_set_logs'),
    previousExerciseId: varchar('previous_exercise_id', { length: 100 }),
    previousDefinitionVersion: smallint('previous_definition_version'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('undo_entries_instance_id_idx').on(table.instanceId),
    index('undo_entries_instance_recency_idx').on(table.instanceId, table.id),
  ]
);
var undoEntriesRelations = relations(undoEntries, ({ one }) => ({
  instance: one(programInstances, {
    fields: [undoEntries.instanceId],
    references: [programInstances.id],
  }),
}));
var programDefinitions = pgTable(
  'program_definitions',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    definition: jsonb().notNull(),
    status: programDefinitionStatusEnum().notNull().default('draft'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('program_definitions_user_id_idx').on(table.userId),
    index('program_definitions_status_idx').on(table.status),
    // Performance index for list query: WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC
    index('program_definitions_user_deleted_updated_idx').on(
      table.userId,
      table.deletedAt,
      table.updatedAt
    ),
  ]
);
var programDefinitionsRelations = relations(programDefinitions, ({ one }) => ({
  user: one(users, { fields: [programDefinitions.userId], references: [users.id] }),
}));
var muscleGroups = pgTable('muscle_groups', {
  id: varchar({ length: 50 }).primaryKey(),
  name: varchar({ length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
var exercises = pgTable(
  'exercises',
  {
    id: varchar({ length: 100 }).primaryKey(),
    name: varchar({ length: 100 }).notNull(),
    muscleGroupId: varchar('muscle_group_id', { length: 50 })
      .references(() => muscleGroups.id, { onDelete: 'restrict' })
      .notNull(),
    equipment: varchar({ length: 50 }),
    isCompound: boolean('is_compound').notNull().default(false),
    isSystem: boolean('is_system').notNull().default(true),
    /**
     * Owner of custom exercises. `onDelete: 'set null'` means user deletion
     * orphans the exercise (is_system=false, created_by_user_id=NULL). The partial
     * index `exercises_orphaned_idx` enables efficient cleanup queries.
     */
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    forceType: varchar('force_type', { length: 20 }),
    level: varchar({ length: 20 }),
    movementMechanic: varchar('movement_mechanic', { length: 20 }),
    category: varchar({ length: 50 }),
    secondaryMuscles: text('secondary_muscles').array(),
  },
  (table) => [
    index('exercises_muscle_group_id_idx').on(table.muscleGroupId),
    index('exercises_created_by_idx').on(table.createdByUserId),
    // Performance indexes (migration 0015_add_performance_indexes)
    index('exercises_filter_composite_idx').on(
      table.isSystem,
      table.level,
      table.equipment,
      table.category
    ),
    index('exercises_is_compound_idx').on(table.isCompound),
    // NOTE: exercises_name_trgm_idx (GIN pg_trgm) is migration-only —
    // Drizzle's index() builder does not support GIN indexes.
    // NOTE: exercises_orphaned_idx (partial index WHERE is_system=false AND created_by_user_id IS NULL)
    // is migration-only (0021) — finds orphaned custom exercises after user deletion.
  ]
);
var exercisesRelations = relations(exercises, ({ one }) => ({
  muscleGroup: one(muscleGroups, {
    fields: [exercises.muscleGroupId],
    references: [muscleGroups.id],
  }),
  creator: one(users, {
    fields: [exercises.createdByUserId],
    references: [users.id],
  }),
}));
var programTemplates = pgTable(
  'program_templates',
  {
    id: varchar({ length: 50 }).primaryKey(),
    name: varchar({ length: 100 }).notNull(),
    description: text().notNull().default(''),
    author: varchar({ length: 100 }).notNull().default(''),
    version: smallint().notNull().default(1),
    category: varchar({ length: 50 }).notNull().default('strength'),
    level: varchar({ length: 20 }).notNull().default('intermediate'),
    source: varchar({ length: 10 }).notNull().default('preset'),
    definition: jsonb().notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('program_templates_is_active_idx').on(table.isActive)]
);
var userInsights = pgTable(
  'user_insights',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    insightType: varchar('insight_type', { length: 50 }).notNull(),
    exerciseId: varchar('exercise_id', { length: 100 }),
    payload: jsonb().notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }),
  },
  (table) => [
    unique('user_insights_user_type_exercise_uq')
      .on(table.userId, table.insightType, table.exerciseId)
      .nullsNotDistinct(),
    index('user_insights_user_type_idx').on(table.userId, table.insightType),
  ]
);
var userInsightsRelations = relations(userInsights, ({ one }) => ({
  user: one(users, { fields: [userInsights.userId], references: [users.id] }),
}));

// apps/backend/api/src/db/index.ts
var KEEP_ALIVE_INTERVAL_SECONDS = 60;
var MAX_CONNECTION_LIFETIME_SECONDS = 3600;
var _client;
var _db;
var queryLogger = {
  logQuery(query, params) {
    if (process.env['NODE_ENV'] !== 'production') {
      logger.debug({ sql: query, params }, 'SQL');
    }
  },
};
function getDb() {
  if (!_db) {
    const url = process.env['DATABASE_URL'];
    if (!url) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    _client = postgres(url, {
      // Serverless: exactly one connection per warm instance against the pooled
      // (PgBouncer) endpoint. Hard-coded to 1 — DB_POOL_SIZE was removed.
      max: 1,
      idle_timeout: 30,
      connect_timeout: 10,
      ssl:
        process.env['DB_SSL'] === 'false'
          ? false
          : process.env['NODE_ENV'] === 'production'
            ? 'require'
            : false,
      // Prevent runaway queries from exhausting the pool
      connection: { statement_timeout: 3e4 },
      // PgBouncer safety — plain queries instead of prepared statements
      prepare: false,
      // TCP keepalive to detect dead connections (interval in seconds)
      keep_alive: KEEP_ALIVE_INTERVAL_SECONDS,
      // Recycle connections after 1 hour
      max_lifetime: MAX_CONNECTION_LIFETIME_SECONDS,
    });
    _db = drizzle(_client, { schema: schema_exports, logger: queryLogger });
  }
  return _db;
}

// apps/backend/api/src/services/auth.ts
var REFRESH_TOKEN_DAYS = 7;
var REFRESH_TOKEN_MS = REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1e3;
function generateRefreshToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
async function hashToken(token) {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0')).join('');
}
async function findUserById(id) {
  const [user] = await getDb()
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);
  return user;
}
async function findUserByEmail(email) {
  const [user] = await getDb()
    .select()
    .from(users)
    .where(and(eq(users.email, email.toLowerCase()), isNull(users.deletedAt)))
    .limit(1);
  return user;
}
function accountDeletedError() {
  return new ApiError(
    403,
    'This account has been deleted. Contact support if you wish to recover it.',
    'ACCOUNT_DELETED'
  );
}
function isUniqueViolation(error) {
  if (!isRecord(error)) return false;
  if (error['code'] === '23505') return true;
  const cause = error['cause'];
  return isRecord(cause) && cause['code'] === '23505';
}
function decideIdentityLink(incomingEmailVerified, existing) {
  if (existing.isDeleted) return 'account_deleted';
  if (incomingEmailVerified && existing.emailVerified) return 'link';
  return 'conflict';
}
async function upsertIdentity(input) {
  const email = input.email.toLowerCase();
  return getDb().transaction(async (tx) => {
    const [identity] = await tx
      .select({ userId: userIdentities.userId })
      .from(userIdentities)
      .where(
        and(
          eq(userIdentities.provider, input.provider),
          eq(userIdentities.providerAccountId, input.providerAccountId)
        )
      )
      .limit(1);
    if (identity) {
      const [user2] = await tx.select().from(users).where(eq(users.id, identity.userId)).limit(1);
      if (!user2) throw new ApiError(500, 'Identity references a missing user', 'DB_WRITE_ERROR');
      if (user2.deletedAt) throw accountDeletedError();
      return { user: user2, isNewUser: false };
    }
    const [existing] = await tx.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      const decision = decideIdentityLink(input.emailVerified, {
        emailVerified: existing.emailVerified,
        isDeleted: existing.deletedAt !== null,
      });
      if (decision === 'account_deleted') throw accountDeletedError();
      if (decision === 'conflict') {
        throw new ApiError(
          409,
          'An account with this email already exists. Sign in with your original method.',
          'ACCOUNT_EXISTS_DIFFERENT_METHOD'
        );
      }
      await tx.insert(userIdentities).values({
        userId: existing.id,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
      });
      return { user: existing, isNewUser: false };
    }
    const [user] = await tx
      .insert(users)
      .values({
        email,
        name: input.name ?? null,
        emailVerified: input.emailVerified,
        googleId: input.provider === 'google' ? input.providerAccountId : null,
      })
      .returning();
    if (!user) throw new ApiError(500, 'Failed to create user', 'DB_WRITE_ERROR');
    await tx.insert(userIdentities).values({
      userId: user.id,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
    });
    return { user, isNewUser: true };
  });
}
async function findOrCreateUserByIdentity(input) {
  try {
    return await upsertIdentity(input);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return upsertIdentity(input);
    }
    throw error;
  }
}
async function findOrCreateGoogleUser(googleId, email, name) {
  return findOrCreateUserByIdentity({
    provider: 'google',
    providerAccountId: googleId,
    email,
    emailVerified: true,
    name,
  });
}
var PASSWORD_RESET_TTL_MS = 60 * 60 * 1e3;
var EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1e3;
async function hashPassword(password) {
  return argon2Hash(password);
}
async function verifyPassword(password, hash) {
  try {
    if (hash.startsWith('$argon2')) {
      return await argon2Verify(hash, password);
    }
    if (hash.startsWith('$2')) {
      return await bcrypt.compare(password, hash);
    }
    return false;
  } catch {
    return false;
  }
}
var dummyHashPromise = null;
function getDummyHash() {
  return (dummyHashPromise ??= hashPassword('timing-equalization-placeholder'));
}
async function authenticatePassword(email, password) {
  const user = await findUserByEmail(email);
  const hash = user?.passwordHash ?? (await getDummyHash());
  const ok2 = await verifyPassword(password, hash);
  if (!user || !user.passwordHash || !ok2) return null;
  return user;
}
async function createPasswordUser(input) {
  const email = input.email.toLowerCase();
  try {
    return await getDb().transaction(async (tx) => {
      return insertPasswordUser(tx, { ...input, email });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
    }
    throw error;
  }
}
async function insertPasswordUser(tx, input) {
  const [user] = await tx
    .insert(users)
    .values({
      email: input.email,
      name: input.name ?? null,
      passwordHash: input.passwordHash,
      emailVerified: false,
    })
    .returning();
  if (!user) throw new ApiError(500, 'Failed to create user', 'DB_WRITE_ERROR');
  await tx
    .insert(userIdentities)
    .values({ userId: user.id, provider: 'password', providerAccountId: user.id });
  return user;
}
async function setUserPassword(userId, passwordHash) {
  await getDb().transaction(async (tx) => {
    const [updated] = await tx
      .update(users)
      .set({
        passwordHash,
        authVersion: sql2`${users.authVersion} + 1`,
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({ id: users.id });
    if (!updated) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  });
}
async function markEmailVerified(userId) {
  const [updated] = await getDb()
    .update(users)
    .set({ emailVerified: true, updatedAt: /* @__PURE__ */ new Date() })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning();
  return updated;
}
async function mintEmailVerificationToken(userId) {
  const token = generateRefreshToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  return { token, row: { userId, tokenHash, expiresAt } };
}
async function createPasswordSignup(input) {
  const email = input.email.toLowerCase();
  const { token, row } = await mintEmailVerificationTokenForNewUser();
  try {
    return await getDb().transaction(async (tx) => {
      const user = await insertPasswordUser(tx, { ...input, email });
      await tx.insert(emailVerificationTokens).values({ ...row, userId: user.id });
      return { user, verificationToken: token };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
    }
    throw error;
  }
}
async function mintEmailVerificationTokenForNewUser() {
  const token = generateRefreshToken();
  const tokenHash = await hashToken(token);
  return {
    token,
    row: { tokenHash, expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS) },
  };
}
async function replaceEmailVerificationToken(userId) {
  const { token, row } = await mintEmailVerificationToken(userId);
  await getDb().transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
    await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
    await tx.insert(emailVerificationTokens).values(row);
  });
  return token;
}
async function verifyEmailWithToken(token) {
  const tokenHash = await hashToken(token);
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash))
      .returning();
    if (!row || row.expiresAt < /* @__PURE__ */ new Date()) return null;
    const [updated] = await tx
      .update(users)
      .set({ emailVerified: true, updatedAt: /* @__PURE__ */ new Date() })
      .where(and(eq(users.id, row.userId), isNull(users.deletedAt)))
      .returning();
    return updated ?? null;
  });
}
async function createPasswordResetToken(userId) {
  const token = generateRefreshToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await getDb().transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await tx.insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
  });
  return token;
}
async function isPasswordResetTokenValid(token) {
  const tokenHash = await hashToken(token);
  const [row] = await getDb()
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        gte(passwordResetTokens.expiresAt, /* @__PURE__ */ new Date())
      )
    )
    .limit(1);
  return row !== void 0;
}
async function resetPasswordWithToken(token, passwordHash) {
  const tokenHash = await hashToken(token);
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .returning();
    if (!row || row.expiresAt < /* @__PURE__ */ new Date()) return null;
    const [updated] = await tx
      .update(users)
      .set({
        passwordHash,
        authVersion: sql2`${users.authVersion} + 1`,
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(and(eq(users.id, row.userId), isNull(users.deletedAt)))
      .returning({ id: users.id });
    if (!updated) return null;
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, row.userId));
    return row.userId;
  });
}
async function updateUserProfile(userId, fields) {
  const db = getDb();
  const updates = { updatedAt: /* @__PURE__ */ new Date() };
  if (fields.name !== void 0) updates['name'] = fields.name;
  if (fields.avatarUrl !== void 0) updates['avatarUrl'] = fields.avatarUrl;
  const [updated] = await db
    .update(users)
    .set(updates)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning();
  if (!updated) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  return updated;
}
async function softDeleteUser(userId) {
  await getDb().transaction(async (tx) => {
    const [updated] = await tx
      .update(users)
      .set({
        deletedAt: /* @__PURE__ */ new Date(),
        authVersion: sql2`${users.authVersion} + 1`,
        updatedAt: /* @__PURE__ */ new Date(),
      })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({ id: users.id });
    if (!updated) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  });
}
var REFRESH_REUSE_GRACE_MS = 1e4;
var REFRESH_TOKEN_COLUMNS = {
  userId: refreshTokens.userId,
  familyId: refreshTokens.familyId,
  expiresAt: refreshTokens.expiresAt,
  tokenHash: refreshTokens.tokenHash,
  previousTokenHash: refreshTokens.previousTokenHash,
  consumedAt: refreshTokens.consumedAt,
  createdAt: refreshTokens.createdAt,
};
async function isRefreshSessionActive(userId, sessionId) {
  const [active] = await getDb()
    .select({ id: refreshTokens.id })
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.familyId, sessionId),
        isNull(refreshTokens.consumedAt),
        gte(refreshTokens.expiresAt, /* @__PURE__ */ new Date())
      )
    )
    .limit(1);
  return active !== void 0;
}
async function revokeSessionByToken(tokenHash) {
  await getDb().transaction(async (tx) => {
    const [initial] = await tx
      .select({ userId: refreshTokens.userId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    if (!initial) return;
    await tx.select({ id: users.id }).from(users).where(eq(users.id, initial.userId)).for('update');
    const [token] = await tx
      .select({ familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    if (!token) return;
    await tx.delete(refreshTokens).where(eq(refreshTokens.familyId, token.familyId));
  });
}
async function createAuthSession(userId, expectedAuthVersion) {
  const refreshToken = generateRefreshToken();
  const tokenHash = await hashToken(refreshToken);
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MS);
  await getDb().transaction(async (tx) => {
    const [user] = await tx
      .select({ authVersion: users.authVersion, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, userId))
      .for('update')
      .limit(1);
    if (!user || user.deletedAt || user.authVersion !== expectedAuthVersion) {
      throw new ApiError(401, 'Session state changed; authenticate again', 'AUTH_SESSION_CHANGED');
    }
    await tx.insert(refreshTokens).values({ userId, tokenHash, familyId: sessionId, expiresAt });
  });
  return { refreshToken, sessionId };
}
async function rotateRefreshToken(tokenHash) {
  return getDb().transaction(async (tx) => {
    const [initial] = await tx
      .select({ userId: refreshTokens.userId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    if (!initial) return { status: 'not_found' };
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, initial.userId))
      .for('update')
      .limit(1);
    const [candidate] = await tx
      .select(REFRESH_TOKEN_COLUMNS)
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .for('update')
      .limit(1);
    if (!candidate) return { status: 'not_found' };
    if (!user || user.deletedAt) {
      await tx.delete(refreshTokens).where(eq(refreshTokens.familyId, candidate.familyId));
      return { status: 'account_deleted' };
    }
    if (candidate.expiresAt < /* @__PURE__ */ new Date()) {
      await tx.delete(refreshTokens).where(eq(refreshTokens.familyId, candidate.familyId));
      return { status: 'expired' };
    }
    if (candidate.consumedAt) {
      const [successor] = await tx
        .select({ consumedAt: refreshTokens.consumedAt })
        .from(refreshTokens)
        .where(eq(refreshTokens.previousTokenHash, candidate.tokenHash))
        .limit(1);
      const isBenignConcurrentRetry =
        successor?.consumedAt === null &&
        Date.now() - candidate.consumedAt.getTime() <= REFRESH_REUSE_GRACE_MS;
      if (isBenignConcurrentRetry) {
        return { status: 'concurrent', userId: candidate.userId };
      }
      await tx
        .update(users)
        .set({ authVersion: sql2`${users.authVersion} + 1` })
        .where(eq(users.id, candidate.userId));
      await tx.delete(refreshTokens).where(eq(refreshTokens.userId, candidate.userId));
      return { status: 'reused', userId: candidate.userId };
    }
    const consumedAt = /* @__PURE__ */ new Date();
    const [consumed] = await tx
      .update(refreshTokens)
      .set({ consumedAt })
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.consumedAt)))
      .returning(REFRESH_TOKEN_COLUMNS);
    if (!consumed) return { status: 'not_found' };
    const refreshToken = generateRefreshToken();
    const newTokenHash = await hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MS);
    await tx
      .update(refreshTokens)
      .set({ expiresAt })
      .where(eq(refreshTokens.familyId, consumed.familyId));
    await tx.insert(refreshTokens).values({
      userId: consumed.userId,
      familyId: consumed.familyId,
      tokenHash: newTokenHash,
      expiresAt,
      previousTokenHash: tokenHash,
    });
    return {
      status: 'rotated',
      user,
      refreshToken,
      sessionId: consumed.familyId,
    };
  });
}
async function cleanupExpiredTokens() {
  const now = /* @__PURE__ */ new Date();
  const db = getDb();
  const [refreshDeleted, resetDeleted, verificationDeleted] = await Promise.all([
    db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, now))
      .returning({ id: refreshTokens.id }),
    db
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, now))
      .returning({ id: passwordResetTokens.id }),
    db
      .delete(emailVerificationTokens)
      .where(lt(emailVerificationTokens.expiresAt, now))
      .returning({ id: emailVerificationTokens.id }),
  ]);
  return refreshDeleted.length + resetDeleted.length + verificationDeleted.length;
}

// apps/backend/api/src/middleware/auth-guard.ts
var BEARER_PREFIX = 'Bearer ';
var TEST_SECRET = 'test-secret-do-not-use-outside-tests';
var isProduction2 = process.env['NODE_ENV'] === 'production';
var isTest2 = process.env['NODE_ENV'] === 'test';
var secret = process.env['JWT_SECRET'];
if (!secret && !isTest2) {
  throw new Error(
    'JWT_SECRET env var must be set (only NODE_ENV=test allows the built-in fallback)'
  );
}
var minLen = isProduction2 ? 64 : 32;
if (secret && secret.length < minLen) {
  throw new Error(`JWT_SECRET must be at least ${minLen} characters (got ${secret.length})`);
}
if (!secret) {
  logger.warn('JWT_SECRET not set \u2014 using test-only fallback (NODE_ENV=test).');
}
var JWT_SECRET = secret ?? TEST_SECRET;
var JWT_ISSUER = 'gravity-room-api';
var JWT_AUDIENCE = 'gravity-room-clients';
var jwtPlugin = new Elysia3({ name: 'jwt-plugin' }).use(
  jwt({
    name: 'jwt',
    secret: JWT_SECRET,
    alg: 'HS256',
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
  })
);
var BEARER_RE = new RegExp(`^${BEARER_PREFIX.trim()}[ \\t]+([^ \\t]+)[ \\t]*$`, 'i');
function extractBearerToken(headers) {
  const authorization = headers['authorization'];
  const match = authorization ? BEARER_RE.exec(authorization) : null;
  const token = match?.[1];
  if (!token) {
    throw new ApiError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED');
  }
  return token;
}
var ACCEPTED_JWT_ALGORITHMS = ['HS256'];
async function verifyAccessToken(jwtCtx, token) {
  const payload = await jwtCtx.verify(token, { algorithms: ACCEPTED_JWT_ALGORITHMS });
  if (!payload) {
    throw new ApiError(401, 'Invalid or expired token', 'TOKEN_INVALID');
  }
  if (payload['iss'] !== JWT_ISSUER) {
    throw new ApiError(401, 'Invalid token issuer', 'TOKEN_INVALID');
  }
  const aud = payload['aud'];
  const audMatches = Array.isArray(aud) ? aud.includes(JWT_AUDIENCE) : aud === JWT_AUDIENCE;
  if (!audMatches) {
    throw new ApiError(401, 'Invalid token audience', 'TOKEN_INVALID');
  }
  const userId = payload['sub'];
  if (typeof userId !== 'string') {
    throw new ApiError(401, 'Invalid token payload', 'TOKEN_INVALID');
  }
  const user = await findUserById(userId);
  if (!user || user.deletedAt) {
    throw new ApiError(401, 'Token user is no longer active', 'TOKEN_USER_INACTIVE');
  }
  const authVersion = payload['av'];
  if (!Number.isInteger(authVersion) || authVersion !== user.authVersion) {
    throw new ApiError(401, 'Token session has been revoked', 'TOKEN_REVOKED');
  }
  const sessionId = payload['sid'];
  if (sessionId !== void 0) {
    if (typeof sessionId !== 'string' || !(await isRefreshSessionActive(userId, sessionId))) {
      throw new ApiError(401, 'Token session has been revoked', 'TOKEN_REVOKED');
    }
  }
  return { userId };
}
async function resolveUserId({ jwt: jwtCtx, headers }) {
  const token = extractBearerToken(headers);
  const { userId } = await verifyAccessToken(jwtCtx, token);
  const redis = getRedis();
  if (redis) {
    keepAlive(trackPresence(userId, redis));
  }
  return { userId };
}

// apps/backend/api/src/middleware/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
var limiters = /* @__PURE__ */ new Map();
var _warnedNoRedis = false;
function getLimiter(windowMs, maxRequests) {
  const redis = getRedis();
  if (!redis) {
    if (!_warnedNoRedis) {
      _warnedNoRedis = true;
      logger.warn('Rate limiter: Upstash not configured, limiting is a no-op');
    }
    return void 0;
  }
  const cacheKey2 = `${windowMs}:${maxRequests}`;
  let limiter = limiters.get(cacheKey2);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
      prefix: 'rl',
    });
    limiters.set(cacheKey2, limiter);
  }
  return limiter;
}
var DEFAULT_WINDOW_MS = 6e4;
var DEFAULT_MAX_REQUESTS = 20;
async function rateLimit(ip, endpoint, opts) {
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = opts?.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const cost = opts?.cost ?? 1;
  if (!Number.isSafeInteger(cost) || cost < 1) {
    throw new Error('Rate-limit cost must be a positive safe integer');
  }
  const limiter = getLimiter(windowMs, maxRequests);
  if (!limiter) return;
  let result;
  try {
    result = await limiter.limit(`${endpoint}:${ip}`, { rate: cost });
  } catch (err2) {
    if (opts?.failClosed) {
      logger.error({ err: err2, endpoint }, 'Rate limiter unavailable on fail-closed endpoint');
      throw new ApiError(503, 'Authentication temporarily unavailable', 'RATE_LIMIT_UNAVAILABLE', {
        headers: { 'Retry-After': '5' },
      });
    }
    logger.warn(
      { err: err2 },
      'Rate limiter: Upstash request failed, allowing request (fail-open)'
    );
    return;
  }
  const { success, reset, pending } = result;
  keepAlive(pending);
  if (!success) {
    const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1e3));
    throw new ApiError(429, 'Too many requests', 'RATE_LIMITED', {
      headers: { 'Retry-After': String(retryAfter) },
    });
  }
}

// apps/backend/api/src/lib/bounded-json.ts
var MAX_PROVIDER_JSON_BYTES = 256 * 1024;
async function readBoundedJson(response, maxBytes, errorFactory) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isSafeInteger(declaredLength) && declaredLength > maxBytes) {
    throw errorFactory();
  }
  if (!response.body) throw errorFactory();
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw errorFactory();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw errorFactory();
  }
}

// apps/backend/api/src/lib/negative-kid-cache.ts
var MAX_JWT_KID_CHARS = 256;
var NegativeKidCache = class {
  constructor(maxEntries, ttlMs, now = Date.now) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.now = now;
    this.entries = /* @__PURE__ */ new Map();
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error('maxEntries must be a positive integer');
    }
  }
  has(key) {
    this.pruneExpired();
    return (this.entries.get(key) ?? 0) > this.now();
  }
  add(key) {
    this.pruneExpired();
    this.entries.delete(key);
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
    this.entries.set(key, this.now() + this.ttlMs);
  }
  pruneExpired() {
    const now = this.now();
    for (const [key, expiresAt] of this.entries) {
      if (expiresAt <= now) this.entries.delete(key);
    }
  }
};

// apps/backend/api/src/lib/google-auth.ts
var JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
var GOOGLE_ISSUERS = /* @__PURE__ */ new Set([
  'accounts.google.com',
  'https://accounts.google.com',
]);
var CACHE_TTL_MS = 60 * 60 * 1e3;
var FORCE_REFRESH_COOLDOWN_MS = 5e3;
var NEGATIVE_KID_TTL_MS = 6e4;
var MAX_NEGATIVE_KIDS = 128;
function getAllowedGoogleClientIds() {
  const clientIds = process.env['GOOGLE_CLIENT_IDS']
    ?.split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const clientId = process.env['GOOGLE_CLIENT_ID']?.trim();
  const allowedClientIds = new Set(clientIds);
  if (clientId) {
    allowedClientIds.add(clientId);
  }
  if (allowedClientIds.size === 0) {
    throw new ApiError(500, 'GOOGLE_CLIENT_ID env var must be set', 'CONFIGURATION_ERROR');
  }
  return [...allowedClientIds];
}
function getWebGoogleClientId() {
  const clientId = process.env['GOOGLE_CLIENT_ID']?.trim();
  if (!clientId) {
    throw new ApiError(500, 'GOOGLE_CLIENT_ID env var must be set', 'CONFIGURATION_ERROR');
  }
  return clientId;
}
function getMobileGoogleClientIds() {
  const clientIds = process.env['GOOGLE_CLIENT_IDS']
    ?.split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (clientIds && clientIds.length > 0) {
    return [...new Set(clientIds)];
  }
  throw new ApiError(500, 'GOOGLE_CLIENT_IDS env var must be set', 'CONFIGURATION_ERROR');
}
function isGoogleJwk(value) {
  if (!isRecord(value)) return false;
  return (
    typeof value['kid'] === 'string' &&
    typeof value['kty'] === 'string' &&
    typeof value['n'] === 'string' &&
    typeof value['e'] === 'string'
  );
}
function isJwksResponse(value) {
  if (!isRecord(value)) return false;
  return Array.isArray(value['keys']) && value['keys'].every(isGoogleJwk);
}
function isIdTokenHeader(value) {
  if (!isRecord(value)) return false;
  return typeof value['kid'] === 'string' && typeof value['alg'] === 'string';
}
function isIdTokenPayload(value) {
  if (!isRecord(value)) return false;
  if (
    value['email_verified'] !== void 0 &&
    typeof value['email_verified'] !== 'boolean' &&
    typeof value['email_verified'] !== 'string'
  )
    return false;
  if (value['nbf'] !== void 0 && typeof value['nbf'] !== 'number') return false;
  if (value['iat'] !== void 0 && typeof value['iat'] !== 'number') return false;
  if (value['azp'] !== void 0 && typeof value['azp'] !== 'string') return false;
  return (
    typeof value['sub'] === 'string' &&
    typeof value['email'] === 'string' &&
    typeof value['iss'] === 'string' &&
    typeof value['exp'] === 'number' &&
    (typeof value['aud'] === 'string' || Array.isArray(value['aud']))
  );
}
function parseJwtJsonSegment(segment, label) {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    throw new ApiError(401, `Invalid JWT ${label}`, 'AUTH_INVALID');
  }
}
var jwksCache = null;
var jwksFetch = null;
var lastForcedRefreshAt = 0;
var negativeKids = new NegativeKidCache(MAX_NEGATIVE_KIDS, NEGATIVE_KID_TTL_MS);
function parseCacheControlMaxAgeMs(cacheControl) {
  if (!cacheControl) return null;
  const match = /max-age\s*=\s*(\d+)/i.exec(cacheControl);
  if (!match?.[1]) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds * 1e3;
}
async function fetchGoogleCerts(options) {
  if (!options?.forceRefresh && jwksCache && Date.now() - jwksCache.fetchedAt < jwksCache.ttlMs) {
    return jwksCache.keys;
  }
  if (jwksFetch) return jwksFetch;
  const pending = (async () => {
    const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(5e3) });
    if (!res.ok)
      throw new ApiError(503, 'Google JWKS endpoint unavailable', 'AUTH_JWKS_UNAVAILABLE');
    const rawData = await readBoundedJson(
      res,
      MAX_PROVIDER_JSON_BYTES,
      () => new ApiError(503, 'Invalid Google JWKS response', 'AUTH_JWKS_UNAVAILABLE')
    );
    if (!isJwksResponse(rawData))
      throw new ApiError(503, 'Invalid JWKS response format', 'AUTH_JWKS_UNAVAILABLE');
    const ttlMs = parseCacheControlMaxAgeMs(res.headers.get('cache-control')) ?? CACHE_TTL_MS;
    jwksCache = { keys: rawData.keys, fetchedAt: Date.now(), ttlMs };
    return rawData.keys;
  })();
  jwksFetch = pending;
  try {
    return await pending;
  } finally {
    if (jwksFetch === pending) jwksFetch = null;
  }
}
async function verifyGoogleToken(credential, options) {
  const allowedClientIds = options?.allowedClientIds?.length
    ? [...options.allowedClientIds]
    : getAllowedGoogleClientIds();
  const parts = credential.split('.');
  if (parts.length !== 3)
    throw new ApiError(401, 'Invalid JWT format: expected 3 segments', 'AUTH_INVALID');
  const headerB64 = parts[0] ?? '';
  const payloadB64 = parts[1] ?? '';
  const signatureB64 = parts[2] ?? '';
  const rawHeader = parseJwtJsonSegment(headerB64, 'header');
  if (!isIdTokenHeader(rawHeader)) throw new ApiError(401, 'Invalid JWT header', 'AUTH_INVALID');
  if (rawHeader.alg !== 'RS256')
    throw new ApiError(401, 'Unsupported token algorithm', 'AUTH_INVALID');
  if (rawHeader.kid.length === 0 || rawHeader.kid.length > MAX_JWT_KID_CHARS) {
    throw new ApiError(401, 'Invalid token signing key id', 'AUTH_INVALID');
  }
  let keys = await fetchGoogleCerts();
  let jwk = keys.find((k) => k.kid === rawHeader.kid);
  if (!jwk) {
    if (negativeKids.has(rawHeader.kid)) {
      throw new ApiError(401, 'Unknown token signing key', 'AUTH_INVALID');
    }
    const now = Date.now();
    let refreshed = false;
    if (jwksFetch) {
      keys = await jwksFetch;
      refreshed = true;
    } else if (now - lastForcedRefreshAt >= FORCE_REFRESH_COOLDOWN_MS) {
      lastForcedRefreshAt = now;
      keys = await fetchGoogleCerts({ forceRefresh: true });
      refreshed = true;
    }
    jwk = keys.find((k) => k.kid === rawHeader.kid);
    if (jwk && refreshed) {
      lastForcedRefreshAt = 0;
    } else if (!jwk && refreshed) {
      negativeKids.add(rawHeader.kid);
    }
  }
  if (!jwk) throw new ApiError(401, 'Unknown token signing key', 'AUTH_INVALID');
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = Buffer.from(signatureB64, 'base64url');
  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signature,
    new TextEncoder().encode(signingInput)
  );
  if (!isValid) throw new ApiError(401, 'Invalid JWT signature', 'AUTH_INVALID');
  const rawPayload = parseJwtJsonSegment(payloadB64, 'payload');
  if (!isIdTokenPayload(rawPayload)) throw new ApiError(401, 'Invalid JWT payload', 'AUTH_INVALID');
  const CLOCK_SKEW_S2 = 60;
  const nowS = Date.now() / 1e3;
  if (nowS - CLOCK_SKEW_S2 > rawPayload.exp)
    throw new ApiError(401, 'Token has expired', 'AUTH_INVALID');
  if (rawPayload.nbf !== void 0 && nowS + CLOCK_SKEW_S2 < rawPayload.nbf)
    throw new ApiError(401, 'Token not yet valid', 'AUTH_INVALID');
  if (rawPayload.iat !== void 0 && nowS + CLOCK_SKEW_S2 < rawPayload.iat)
    throw new ApiError(401, 'Token issued in the future', 'AUTH_INVALID');
  if (!GOOGLE_ISSUERS.has(rawPayload.iss)) {
    throw new ApiError(401, 'Invalid token issuer', 'AUTH_INVALID');
  }
  const audiences = Array.isArray(rawPayload.aud) ? rawPayload.aud : [rawPayload.aud];
  if (!audiences.some((audience) => allowedClientIds.includes(audience))) {
    throw new ApiError(401, 'Invalid audience', 'AUTH_INVALID');
  }
  if (
    (audiences.length > 1 && rawPayload.azp === void 0) ||
    (rawPayload.azp !== void 0 && !allowedClientIds.includes(rawPayload.azp))
  ) {
    throw new ApiError(401, 'Invalid authorized party', 'AUTH_INVALID');
  }
  if (rawPayload.email_verified !== true && rawPayload.email_verified !== 'true') {
    throw new ApiError(401, 'Email not verified by Google', 'AUTH_INVALID');
  }
  return {
    sub: rawPayload.sub,
    email: rawPayload.email,
    name: rawPayload.name,
  };
}

// apps/backend/api/src/lib/telegram.ts
var TELEGRAM_TIMEOUT_MS = 5e3;
function sendTelegramMessage(text2) {
  return (async () => {
    const token = process.env['TELEGRAM_BOT_TOKEN'];
    const chatId = process.env['TELEGRAM_CHAT_ID'];
    if (!token || !chatId) return;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text2 }),
        signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
      });
      if (!res.ok) {
        logger.warn({ status: res.status }, 'telegram: sendMessage returned non-2xx response');
      }
    } catch (err2) {
      logger.warn({ err: err2 }, 'telegram: sendMessage failed');
    }
  })();
}

// apps/backend/api/src/lib/email.ts
var RESEND_ENDPOINT = 'https://api.resend.com/emails';
var EMAIL_TIMEOUT_MS = 1e4;
function isEmailConfigured() {
  return Boolean(process.env['RESEND_API_KEY'] && process.env['EMAIL_FROM']);
}
function maskEmailAddress(address) {
  const separator = address.lastIndexOf('@');
  if (separator <= 0 || separator === address.length - 1) return '[masked-email]';
  const local = address.slice(0, separator);
  const domain = address.slice(separator + 1);
  const domainDot = domain.lastIndexOf('.');
  const domainName = domainDot > 0 ? domain.slice(0, domainDot) : domain;
  const suffix = domainDot > 0 ? domain.slice(domainDot) : '';
  return `${local.charAt(0)}***@${domainName.charAt(0)}***${suffix}`;
}
function shouldLogAuthActionLinks(env = process.env) {
  return (
    env['LOG_AUTH_ACTION_LINKS'] === 'true' &&
    env['NODE_ENV'] === 'development' &&
    env['VERCEL'] !== '1'
  );
}
async function sendEmail(input) {
  const apiKey = process.env['RESEND_API_KEY'];
  const from = process.env['EMAIL_FROM'];
  if (!isEmailConfigured()) {
    logger.warn(
      { recipient: maskEmailAddress(input.to), subject: input.subject },
      'email: RESEND_API_KEY/EMAIL_FROM unset \u2014 skipping send (no-op)'
    );
    return false;
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn(
        { status: res.status, recipient: maskEmailAddress(input.to) },
        'email: Resend returned non-2xx'
      );
      return false;
    }
    return true;
  } catch (err2) {
    logger.warn({ err: err2, recipient: maskEmailAddress(input.to) }, 'email: send failed');
    return false;
  }
}
function devLogLink(kind, link) {
  if (shouldLogAuthActionLinks()) {
    logger.info({ kind, link }, `email[local]: ${kind} link`);
  }
}
async function sendVerificationEmail(to, token, request) {
  const link = `${getWebBaseUrl(request)}/verify-email?token=${encodeURIComponent(token)}`;
  devLogLink('verify-email', link);
  await sendEmail({
    to,
    subject: 'Verify your email \u2014 Gravity Room',
    html: `<p>Confirm your email to activate your Gravity Room account.</p><p><a href="${link}">Verify email</a></p><p>If you didn't sign up, you can ignore this message.</p>`,
    text: `Confirm your email to activate your Gravity Room account: ${link}`,
  });
}
async function sendPasswordResetEmail(to, token, request) {
  const link = `${getWebBaseUrl(request)}/reset-password?token=${encodeURIComponent(token)}`;
  devLogLink('reset-password', link);
  await sendEmail({
    to,
    subject: 'Reset your password \u2014 Gravity Room',
    html: `<p>Reset your Gravity Room password.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 1 hour. If you didn't request it, you can ignore this message.</p>`,
    text: `Reset your Gravity Room password (expires in 1 hour): ${link}`,
  });
}

// apps/backend/api/src/lib/oidc.ts
var JWKS_CACHE_TTL_MS = 60 * 60 * 1e3;
var JWKS_FORCE_REFRESH_COOLDOWN_MS = 5e3;
var JWKS_NEGATIVE_KID_TTL_MS = 6e4;
var MAX_NEGATIVE_KIDS2 = 256;
var CLOCK_SKEW_S = 60;
function isJwk(value) {
  return (
    isRecord(value) &&
    typeof value['kid'] === 'string' &&
    typeof value['kty'] === 'string' &&
    typeof value['n'] === 'string' &&
    typeof value['e'] === 'string'
  );
}
function isJwksResponse2(value) {
  return isRecord(value) && Array.isArray(value['keys']) && value['keys'].every(isJwk);
}
function isTokenHeader(value) {
  return isRecord(value) && typeof value['kid'] === 'string' && typeof value['alg'] === 'string';
}
function isOidcTokenPayload(value) {
  if (!isRecord(value)) return false;
  if (value['nbf'] !== void 0 && typeof value['nbf'] !== 'number') return false;
  if (value['iat'] !== void 0 && typeof value['iat'] !== 'number') return false;
  if (value['nonce'] !== void 0 && typeof value['nonce'] !== 'string') return false;
  if (value['tid'] !== void 0 && typeof value['tid'] !== 'string') return false;
  if (value['azp'] !== void 0 && typeof value['azp'] !== 'string') return false;
  return (
    typeof value['sub'] === 'string' &&
    typeof value['iss'] === 'string' &&
    typeof value['exp'] === 'number' &&
    (typeof value['aud'] === 'string' || Array.isArray(value['aud']))
  );
}
function normalizeVerifiedClaim(value) {
  return value === true || value === 'true';
}
function parseJwtJsonSegment2(segment, label) {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    throw new ApiError(401, `Invalid JWT ${label}`, 'AUTH_INVALID');
  }
}
var jwksCaches = /* @__PURE__ */ new Map();
var jwksFetches = /* @__PURE__ */ new Map();
var lastForcedRefresh = /* @__PURE__ */ new Map();
var negativeKids2 = new NegativeKidCache(MAX_NEGATIVE_KIDS2, JWKS_NEGATIVE_KID_TTL_MS);
async function fetchJwksNetwork(jwksUrl) {
  const inFlight = jwksFetches.get(jwksUrl);
  if (inFlight) return inFlight;
  const pending = (async () => {
    const res = await fetch(jwksUrl, { signal: AbortSignal.timeout(5e3) });
    if (!res.ok)
      throw new ApiError(503, 'Provider JWKS endpoint unavailable', 'AUTH_JWKS_UNAVAILABLE');
    const rawData = await readBoundedJson(
      res,
      MAX_PROVIDER_JSON_BYTES,
      () => new ApiError(503, 'Invalid provider JWKS response', 'AUTH_JWKS_UNAVAILABLE')
    );
    if (!isJwksResponse2(rawData))
      throw new ApiError(503, 'Invalid JWKS response format', 'AUTH_JWKS_UNAVAILABLE');
    jwksCaches.set(jwksUrl, { keys: rawData.keys, fetchedAt: Date.now() });
    return rawData.keys;
  })();
  jwksFetches.set(jwksUrl, pending);
  try {
    return await pending;
  } finally {
    if (jwksFetches.get(jwksUrl) === pending) jwksFetches.delete(jwksUrl);
  }
}
async function fetchJwks(jwksUrl) {
  const cached = jwksCaches.get(jwksUrl);
  if (cached && Date.now() - cached.fetchedAt < JWKS_CACHE_TTL_MS) return cached.keys;
  return fetchJwksNetwork(jwksUrl);
}
async function refreshJwksForUnknownKid(jwksUrl) {
  const inFlight = jwksFetches.get(jwksUrl);
  if (inFlight) return { keys: await inFlight, refreshed: true };
  const now = Date.now();
  const lastRefresh = lastForcedRefresh.get(jwksUrl) ?? 0;
  if (now - lastRefresh < JWKS_FORCE_REFRESH_COOLDOWN_MS) {
    return { keys: jwksCaches.get(jwksUrl)?.keys ?? [], refreshed: false };
  }
  lastForcedRefresh.set(jwksUrl, now);
  return { keys: await fetchJwksNetwork(jwksUrl), refreshed: true };
}
function issuerMatchesTemplate(template, payload) {
  return (
    payload.tid !== void 0 &&
    template.includes('{tenantid}') &&
    template.replace('{tenantid}', payload.tid) === payload.iss
  );
}
async function verifyOidcIdToken(opts) {
  const parts = opts.token.split('.');
  if (parts.length !== 3)
    throw new ApiError(401, 'Invalid JWT format: expected 3 segments', 'AUTH_INVALID');
  const headerB64 = parts[0] ?? '';
  const payloadB64 = parts[1] ?? '';
  const signatureB64 = parts[2] ?? '';
  const rawHeader = parseJwtJsonSegment2(headerB64, 'header');
  if (!isTokenHeader(rawHeader)) throw new ApiError(401, 'Invalid JWT header', 'AUTH_INVALID');
  if (rawHeader.alg !== 'RS256')
    throw new ApiError(401, 'Unsupported token algorithm', 'AUTH_INVALID');
  if (rawHeader.kid.length === 0 || rawHeader.kid.length > MAX_JWT_KID_CHARS) {
    throw new ApiError(401, 'Invalid token signing key id', 'AUTH_INVALID');
  }
  let keys = await fetchJwks(opts.jwksUrl);
  let jwk = keys.find((k) => k.kid === rawHeader.kid);
  if (!jwk) {
    const negativeKey = `${opts.jwksUrl}:${rawHeader.kid}`;
    if (negativeKids2.has(negativeKey)) {
      throw new ApiError(401, 'Unknown token signing key', 'AUTH_INVALID');
    }
    const refreshed = await refreshJwksForUnknownKid(opts.jwksUrl);
    keys = refreshed.keys;
    jwk = keys.find((k) => k.kid === rawHeader.kid);
    if (jwk && refreshed.refreshed) {
      lastForcedRefresh.delete(opts.jwksUrl);
    } else if (!jwk && refreshed.refreshed) {
      negativeKids2.add(negativeKey);
    }
  }
  if (!jwk) throw new ApiError(401, 'Unknown token signing key', 'AUTH_INVALID');
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(signatureB64, 'base64url'),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );
  if (!isValid) throw new ApiError(401, 'Invalid JWT signature', 'AUTH_INVALID');
  const rawPayload = parseJwtJsonSegment2(payloadB64, 'payload');
  if (!isOidcTokenPayload(rawPayload))
    throw new ApiError(401, 'Invalid JWT payload', 'AUTH_INVALID');
  const nowS = Date.now() / 1e3;
  if (nowS - CLOCK_SKEW_S > rawPayload.exp)
    throw new ApiError(401, 'Token has expired', 'AUTH_INVALID');
  if (rawPayload.nbf !== void 0 && nowS + CLOCK_SKEW_S < rawPayload.nbf)
    throw new ApiError(401, 'Token not yet valid', 'AUTH_INVALID');
  if (rawPayload.iat !== void 0 && nowS + CLOCK_SKEW_S < rawPayload.iat)
    throw new ApiError(401, 'Token issued in the future', 'AUTH_INVALID');
  const issuerAllowed =
    opts.issuers.includes(rawPayload.iss) ||
    (opts.issuerTemplates ?? []).some((template) => issuerMatchesTemplate(template, rawPayload));
  if (!issuerAllowed) throw new ApiError(401, 'Invalid token issuer', 'AUTH_INVALID');
  const audiences = Array.isArray(rawPayload.aud) ? rawPayload.aud : [rawPayload.aud];
  if (!audiences.some((audience) => opts.audiences.includes(audience)))
    throw new ApiError(401, 'Invalid audience', 'AUTH_INVALID');
  if (
    (audiences.length > 1 && rawPayload.azp === void 0) ||
    (rawPayload.azp !== void 0 && !opts.audiences.includes(rawPayload.azp))
  )
    throw new ApiError(401, 'Invalid authorized party', 'AUTH_INVALID');
  if (opts.expectedNonce !== void 0 && rawPayload.nonce !== opts.expectedNonce)
    throw new ApiError(401, 'Invalid token nonce', 'AUTH_INVALID');
  return {
    sub: rawPayload.sub,
    email: rawPayload.email,
    emailVerified: normalizeVerifiedClaim(rawPayload.email_verified),
    emailDomainOwnerVerified: normalizeVerifiedClaim(rawPayload.xms_edov),
    name: rawPayload.name,
  };
}

// apps/backend/api/src/lib/apple-auth.ts
var APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
var APPLE_ISSUER = 'https://appleid.apple.com';
var APPLE_AUTHORIZE_URL = 'https://appleid.apple.com/auth/authorize';
function isAppleConfigured() {
  return Boolean(process.env['APPLE_CLIENT_ID']?.trim());
}
function getAppleClientId() {
  const clientId = process.env['APPLE_CLIENT_ID']?.trim();
  if (!clientId)
    throw new ApiError(503, 'Apple sign-in is not configured', 'PROVIDER_NOT_CONFIGURED');
  return clientId;
}
function buildAppleAuthorizeUrl(state, redirectUri, nonce) {
  const params = new URLSearchParams({
    client_id: getAppleClientId(),
    redirect_uri: redirectUri,
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name email',
    state,
  });
  if (nonce) params.set('nonce', nonce);
  return `${APPLE_AUTHORIZE_URL}?${params.toString()}`;
}
async function verifyAppleIdToken(idToken, expectedNonce) {
  return verifyOidcIdToken({
    token: idToken,
    jwksUrl: APPLE_JWKS_URL,
    issuers: [APPLE_ISSUER],
    audiences: [getAppleClientId()],
    expectedNonce,
  });
}
function parseAppleUserName(userField) {
  if (!userField) return void 0;
  try {
    const parsed = JSON.parse(userField);
    if (!isRecord(parsed) || !isRecord(parsed['name'])) return void 0;
    const name = parsed['name'];
    const first = typeof name['firstName'] === 'string' ? name['firstName'] : '';
    const last = typeof name['lastName'] === 'string' ? name['lastName'] : '';
    const full = [first, last].filter(Boolean).join(' ').trim();
    return full.length > 0 ? full : void 0;
  } catch {
    return void 0;
  }
}

// apps/backend/api/src/lib/github-auth.ts
var GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
var GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
var GITHUB_API_USER = 'https://api.github.com/user';
var GITHUB_API_EMAILS = 'https://api.github.com/user/emails';
var HTTP_TIMEOUT_MS = 8e3;
function generatePkceVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString('base64url');
}
async function pkceChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(digest).toString('base64url');
}
function isGitHubConfigured() {
  return Boolean(
    process.env['GITHUB_CLIENT_ID']?.trim() && process.env['GITHUB_CLIENT_SECRET']?.trim()
  );
}
function getGitHubClientId() {
  const id = process.env['GITHUB_CLIENT_ID']?.trim();
  if (!id) throw new ApiError(503, 'GitHub sign-in is not configured', 'PROVIDER_NOT_CONFIGURED');
  return id;
}
function getGitHubClientSecret() {
  const secret2 = process.env['GITHUB_CLIENT_SECRET']?.trim();
  if (!secret2)
    throw new ApiError(503, 'GitHub sign-in is not configured', 'PROVIDER_NOT_CONFIGURED');
  return secret2;
}
function buildGitHubAuthorizeUrl(state, redirectUri, codeChallenge) {
  const params = new URLSearchParams({
    client_id: getGitHubClientId(),
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
    allow_signup: 'true',
  });
  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}
async function exchangeGitHubCode(code, redirectUri, codeVerifier) {
  const body = {
    client_id: getGitHubClientId(),
    client_secret: getGitHubClientSecret(),
    code,
    redirect_uri: redirectUri,
  };
  if (codeVerifier) body['code_verifier'] = codeVerifier;
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) throw new ApiError(502, 'GitHub token exchange failed', 'AUTH_PROVIDER_ERROR');
  const data = await readBoundedJson(
    res,
    MAX_PROVIDER_JSON_BYTES,
    () => new ApiError(502, 'GitHub token response invalid', 'AUTH_PROVIDER_ERROR')
  );
  if (!isRecord(data) || typeof data['access_token'] !== 'string') {
    throw new ApiError(502, 'GitHub token exchange returned no token', 'AUTH_PROVIDER_ERROR');
  }
  return data['access_token'];
}
function isGitHubEmail(value) {
  return (
    isRecord(value) &&
    typeof value['email'] === 'string' &&
    typeof value['primary'] === 'boolean' &&
    typeof value['verified'] === 'boolean'
  );
}
async function fetchGitHubIdentity(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'gravity-room',
  };
  const [userRes, emailsRes] = await Promise.all([
    fetch(GITHUB_API_USER, { headers, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) }),
    fetch(GITHUB_API_EMAILS, { headers, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) }),
  ]);
  if (!userRes.ok || !emailsRes.ok)
    throw new ApiError(502, 'GitHub user lookup failed', 'AUTH_PROVIDER_ERROR');
  const user = await readBoundedJson(
    userRes,
    MAX_PROVIDER_JSON_BYTES,
    () => new ApiError(502, 'GitHub user response invalid', 'AUTH_PROVIDER_ERROR')
  );
  if (!isRecord(user) || (typeof user['id'] !== 'number' && typeof user['id'] !== 'string')) {
    throw new ApiError(502, 'GitHub user response invalid', 'AUTH_PROVIDER_ERROR');
  }
  const emailsRaw = await readBoundedJson(
    emailsRes,
    MAX_PROVIDER_JSON_BYTES,
    () => new ApiError(502, 'GitHub email response invalid', 'AUTH_PROVIDER_ERROR')
  );
  const emails = Array.isArray(emailsRaw) ? emailsRaw.filter(isGitHubEmail) : [];
  const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
  if (!primary)
    throw new ApiError(401, 'No verified email on the GitHub account', 'AUTH_EMAIL_UNVERIFIED');
  const name =
    typeof user['name'] === 'string'
      ? user['name']
      : typeof user['login'] === 'string'
        ? user['login']
        : void 0;
  return { id: String(user['id']), email: primary.email, emailVerified: true, name };
}

// apps/backend/api/src/lib/microsoft-auth.ts
var MICROSOFT_LOGIN_BASE = 'https://login.microsoftonline.com';
var MICROSOFT_CONSUMERS_TENANT_ID = '9188040d-6c67-4c5b-b112-36a304b66dad';
var MICROSOFT_USERINFO_URL = 'https://graph.microsoft.com/oidc/userinfo';
var MICROSOFT_SCOPE = 'openid email profile';
var HTTP_TIMEOUT_MS2 = 8e3;
function isMicrosoftConfigured() {
  return Boolean(
    process.env['MICROSOFT_CLIENT_ID']?.trim() && process.env['MICROSOFT_CLIENT_SECRET']?.trim()
  );
}
function microsoftTenant() {
  return process.env['MICROSOFT_TENANT_ID']?.trim() || 'consumers';
}
function getMicrosoftClientId() {
  const id = process.env['MICROSOFT_CLIENT_ID']?.trim();
  if (!id)
    throw new ApiError(503, 'Microsoft sign-in is not configured', 'PROVIDER_NOT_CONFIGURED');
  return id;
}
function getMicrosoftClientSecret() {
  const secret2 = process.env['MICROSOFT_CLIENT_SECRET']?.trim();
  if (!secret2)
    throw new ApiError(503, 'Microsoft sign-in is not configured', 'PROVIDER_NOT_CONFIGURED');
  return secret2;
}
function microsoftAuthorizeUrl() {
  return `${MICROSOFT_LOGIN_BASE}/${encodeURIComponent(microsoftTenant())}/oauth2/v2.0/authorize`;
}
function microsoftTokenUrl() {
  return `${MICROSOFT_LOGIN_BASE}/${encodeURIComponent(microsoftTenant())}/oauth2/v2.0/token`;
}
function microsoftJwksUrl() {
  return `${MICROSOFT_LOGIN_BASE}/${encodeURIComponent(microsoftTenant())}/discovery/v2.0/keys`;
}
function microsoftIssuers() {
  const tenant = microsoftTenant();
  if (tenant === 'consumers') {
    return {
      issuers: [`${MICROSOFT_LOGIN_BASE}/${MICROSOFT_CONSUMERS_TENANT_ID}/v2.0`],
      issuerTemplates: [],
    };
  }
  if (tenant === 'common' || tenant === 'organizations') {
    return {
      issuers: [],
      issuerTemplates: [`${MICROSOFT_LOGIN_BASE}/{tenantid}/v2.0`],
    };
  }
  return {
    issuers: [`${MICROSOFT_LOGIN_BASE}/${tenant}/v2.0`],
    issuerTemplates: [],
  };
}
function buildMicrosoftAuthorizeUrl(state, redirectUri, nonce, codeChallenge) {
  const params = new URLSearchParams({
    client_id: getMicrosoftClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope: MICROSOFT_SCOPE,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${microsoftAuthorizeUrl()}?${params.toString()}`;
}
async function exchangeMicrosoftCode(code, redirectUri, codeVerifier) {
  const body = new URLSearchParams({
    client_id: getMicrosoftClientId(),
    client_secret: getMicrosoftClientSecret(),
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: MICROSOFT_SCOPE,
    code_verifier: codeVerifier,
  });
  const res = await fetch(microsoftTokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS2),
  });
  if (!res.ok) throw new ApiError(502, 'Microsoft token exchange failed', 'AUTH_PROVIDER_ERROR');
  const data = await readBoundedJson(
    res,
    MAX_PROVIDER_JSON_BYTES,
    () => new ApiError(502, 'Microsoft token response invalid', 'AUTH_PROVIDER_ERROR')
  );
  if (
    !isRecord(data) ||
    typeof data['id_token'] !== 'string' ||
    typeof data['access_token'] !== 'string'
  ) {
    throw new ApiError(502, 'Microsoft token exchange returned no token', 'AUTH_PROVIDER_ERROR');
  }
  return { idToken: data['id_token'], accessToken: data['access_token'] };
}
async function fetchMicrosoftUserInfo(accessToken) {
  const res = await fetch(MICROSOFT_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS2),
  });
  if (!res.ok) throw new ApiError(502, 'Microsoft user lookup failed', 'AUTH_PROVIDER_ERROR');
  const data = await readBoundedJson(
    res,
    MAX_PROVIDER_JSON_BYTES,
    () => new ApiError(502, 'Microsoft user response invalid', 'AUTH_PROVIDER_ERROR')
  );
  if (!isRecord(data))
    throw new ApiError(502, 'Microsoft user response invalid', 'AUTH_PROVIDER_ERROR');
  return {
    email: typeof data['email'] === 'string' ? data['email'] : void 0,
    name: typeof data['name'] === 'string' ? data['name'] : void 0,
  };
}
async function fetchMicrosoftIdentity(idToken, accessToken, expectedNonce) {
  const { issuers, issuerTemplates } = microsoftIssuers();
  const claims = await verifyOidcIdToken({
    token: idToken,
    jwksUrl: microsoftJwksUrl(),
    issuers,
    issuerTemplates,
    audiences: [getMicrosoftClientId()],
    expectedNonce,
  });
  const idTokenEmail = claims.email;
  const userInfo = idTokenEmail ? void 0 : await fetchMicrosoftUserInfo(accessToken);
  const email = idTokenEmail ?? userInfo?.email;
  if (!email) throw new ApiError(401, 'No email on the Microsoft account', 'AUTH_EMAIL_UNVERIFIED');
  const emailVerified =
    idTokenEmail !== void 0 && (claims.emailDomainOwnerVerified || claims.emailVerified);
  if (!emailVerified) {
    throw new ApiError(
      401,
      'Microsoft did not verify ownership of the account email',
      'AUTH_EMAIL_UNVERIFIED'
    );
  }
  return {
    id: claims.sub,
    email,
    emailVerified: true,
    name: claims.name ?? userInfo?.name,
  };
}

// apps/backend/api/src/routes/auth-boundary.ts
var MAX_AVATAR_DATA_URL_CHARS = 2e5;
var DATA_URL_IMAGE_RE =
  /^data:image\/(jpeg|png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
function classifyDevice(userAgent) {
  if (!userAgent) return 'Unknown';
  const normalizedUserAgent = userAgent.toLowerCase();
  if (
    normalizedUserAgent.includes('bot') ||
    normalizedUserAgent.includes('crawler') ||
    normalizedUserAgent.includes('spider')
  ) {
    return 'Bot';
  }
  if (/Mobile|Android|iPhone|iPad|iPod/.test(userAgent)) return 'Mobile';
  return 'Desktop';
}
function normalizeDisplayName(name) {
  if (name === void 0) return void 0;
  const normalized = name.trim();
  if (normalized.length === 0) {
    throw new ApiError(400, 'Name cannot be blank', 'INVALID_NAME');
  }
  return normalized;
}
function assertTrustedCredentialRequest(request) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new ApiError(415, 'Content-Type must be application/json', 'UNSUPPORTED_MEDIA_TYPE');
  }
  const fetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
  if (fetchSite === 'cross-site') {
    throw new ApiError(403, 'Cross-site authentication request rejected', 'CSRF_REJECTED');
  }
  const origin = request.headers.get('origin');
  if (!origin) return;
  const allowedOrigins = /* @__PURE__ */ new Set([
    new URL(request.url).origin,
    getApiBaseUrl(request),
    getWebBaseUrl(request),
  ]);
  for (const configured of process.env['CORS_ORIGIN']?.split(',') ?? []) {
    const value = configured.trim();
    if (value) allowedOrigins.add(new URL(value).origin);
  }
  let requestOrigin;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    throw new ApiError(403, 'Cross-origin authentication request rejected', 'CSRF_REJECTED');
  }
  if (!allowedOrigins.has(requestOrigin)) {
    throw new ApiError(403, 'Cross-origin authentication request rejected', 'CSRF_REJECTED');
  }
}
function assertValidAvatarDataUrl(avatarUrl) {
  if (avatarUrl === void 0 || avatarUrl === null) return;
  const dataUrlMatch = DATA_URL_IMAGE_RE.exec(avatarUrl);
  if (!dataUrlMatch) {
    throw new ApiError(
      400,
      'Avatar must be a base64 data URL (JPEG, PNG, or WebP)',
      'INVALID_AVATAR'
    );
  }
  if (avatarUrl.length > MAX_AVATAR_DATA_URL_CHARS) {
    throw new ApiError(400, 'Avatar exceeds maximum size (200KB)', 'AVATAR_TOO_LARGE');
  }
  const declaredType = dataUrlMatch[1];
  const base64Payload = avatarUrl.split(',')[1];
  if (!base64Payload) {
    throw new ApiError(400, 'Empty avatar data', 'INVALID_AVATAR');
  }
  const decoded = Buffer.from(base64Payload, 'base64');
  if (decoded.toString('base64') !== base64Payload) {
    throw new ApiError(400, 'Invalid base64 in avatar', 'INVALID_AVATAR');
  }
  if (declaredType === void 0 || !avatarSignatureMatches(declaredType, decoded)) {
    throw new ApiError(
      400,
      'Avatar data is not a valid image of the declared type',
      'INVALID_AVATAR'
    );
  }
}
function avatarSignatureMatches(declaredType, buffer) {
  switch (declaredType) {
    case 'jpeg':
      return buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
    case 'png':
      return (
        buffer.length >= 8 &&
        buffer[0] === 137 &&
        buffer[1] === 80 &&
        buffer[2] === 78 &&
        buffer[3] === 71 &&
        buffer[4] === 13 &&
        buffer[5] === 10 &&
        buffer[6] === 26 &&
        buffer[7] === 10
      );
    case 'webp':
      return (
        buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
      );
    default:
      return false;
  }
}

// apps/backend/api/src/routes/auth-oauth.ts
var OAUTH_COOKIE_NAMES = {
  apple: {
    state: 'oauth_apple_state',
    nonce: 'oauth_apple_nonce',
  },
  github: {
    state: 'oauth_github_state',
    pkce: 'oauth_github_pkce',
  },
  microsoft: {
    state: 'oauth_microsoft_state',
    nonce: 'oauth_microsoft_nonce',
    pkce: 'oauth_microsoft_pkce',
  },
};
var OAUTH_STATE_TTL_SECONDS = 10 * 60;
var OAUTH_COOKIE_PATH = '/api/auth';
function oauthStateCookieOptions(sameSite, isProduction3) {
  return {
    httpOnly: true,
    secure: isProduction3 || sameSite === 'none',
    sameSite,
    maxAge: OAUTH_STATE_TTL_SECONDS,
    path: OAUTH_COOKIE_PATH,
  };
}
function oauthCookieValue(cookie) {
  return typeof cookie?.value === 'string' ? cookie.value : void 0;
}
function removeOAuthStateCookie(cookie, sameSite, isProduction3) {
  if (!cookie) return;
  cookie.set({
    ...oauthStateCookieOptions(sameSite, isProduction3),
    value: '',
    maxAge: 0,
    expires: /* @__PURE__ */ new Date(0),
  });
}
function socialCallbackUrl(request, provider, error) {
  const base = `${getWebBaseUrl(request)}/auth/callback`;
  return error
    ? `${base}?provider=${provider}&error=${encodeURIComponent(error)}`
    : `${base}?provider=${provider}`;
}
function identityErrorCode(error) {
  if (error instanceof ApiError) {
    if (error.code === 'ACCOUNT_DELETED') return 'account_deleted';
    if (error.code === 'ACCOUNT_EXISTS_DIFFERENT_METHOD') return 'account_exists';
  }
  return 'signin_failed';
}
function providerExchangeErrorCode(error) {
  return error instanceof ApiError && error.code === 'AUTH_EMAIL_UNVERIFIED'
    ? 'email_required'
    : 'provider_error';
}

// apps/backend/api/src/routes/auth.ts
var ACCESS_TOKEN_EXPIRY = process.env['JWT_ACCESS_EXPIRY'] ?? '15m';
var REFRESH_COOKIE_NAME = 'refresh_token';
var IS_PRODUCTION2 = process.env['NODE_ENV'] === 'production';
var MAX_AUTH_TOKEN_CHARS = 256;
var MAX_EMAIL_CHARS = 254;
var MAX_OAUTH_CODE_CHARS = 4096;
var MAX_OAUTH_ERROR_CHARS = 512;
var MAX_OAUTH_ID_TOKEN_CHARS = 12e3;
var MAX_OAUTH_USER_CHARS = 4096;
var DEV_AUTH_SECRET = process.env['AUTH_DEV_ROUTE_SECRET'] ?? '';
var DEV_AUTH_ENABLED =
  process.env['AUTH_DEV_ROUTE_ENABLED'] === 'true' &&
  !IS_PRODUCTION2 &&
  DEV_AUTH_SECRET.length >= 16;
var DEV_AUTH_RATE_LIMIT = { maxRequests: 60, windowMs: 6e4 };
var emailInputSchema = t.String({ format: 'email', maxLength: MAX_EMAIL_CHARS });
var AUTH_ACCOUNT_KEY_SECRET = process.env['JWT_SECRET'] ?? 'test-only-auth-account-rate-limit-key';
var AUTH_GLOBAL_RATE_LIMIT = { maxRequests: 1e3, windowMs: 6e4 };
var RECIPIENT_DAILY_RATE_LIMIT = { maxRequests: 5, windowMs: 24 * 60 * 60 * 1e3 };
var RECIPIENT_COOLDOWN_RATE_LIMIT = { maxRequests: 1, windowMs: 6e4 };
function authRateLimit(key, endpoint, opts) {
  return rateLimit(key, endpoint, { ...opts, failClosed: true });
}
function accountRateLimitKey(email) {
  return `account:${createHmac('sha256', AUTH_ACCOUNT_KEY_SECRET).update(email.trim().toLowerCase()).digest('hex')}`;
}
async function applyCredentialAbuseLimits(ip, email, endpoint, ipMaxRequests, accountMaxRequests) {
  await Promise.all([
    authRateLimit(ip, endpoint, { maxRequests: ipMaxRequests }),
    authRateLimit(accountRateLimitKey(email), `${endpoint}:account`, {
      maxRequests: accountMaxRequests,
    }),
    authRateLimit('global', `${endpoint}:global`, AUTH_GLOBAL_RATE_LIMIT),
  ]);
}
async function recipientActionAllowed(email, endpoint) {
  const key = accountRateLimitKey(email);
  try {
    await authRateLimit(key, `${endpoint}:recipient-cooldown`, RECIPIENT_COOLDOWN_RATE_LIMIT);
    await authRateLimit(key, `${endpoint}:recipient-daily`, RECIPIENT_DAILY_RATE_LIMIT);
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'RATE_LIMITED') return false;
    throw error;
  }
}
function devAuthSecretMatches(provided) {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(DEV_AUTH_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}
var REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PRODUCTION2,
  sameSite: 'strict',
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
  path: '/api/auth',
};
function expireCookieAtPath(cookie, options) {
  cookie.set({
    value: '',
    path: options.path,
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    maxAge: 0,
    expires: /* @__PURE__ */ new Date(0),
  });
}
function removeRefreshCookie(refreshCookie) {
  expireCookieAtPath(refreshCookie, REFRESH_COOKIE_OPTIONS);
}
function assertEmailConfiguredForProduction() {
  if (process.env['NODE_ENV'] !== 'production' || isEmailConfigured()) return;
  throw new ApiError(503, 'Email delivery is not configured', 'EMAIL_NOT_CONFIGURED');
}
function isEmailPasswordAvailable() {
  return process.env['NODE_ENV'] !== 'production' || isEmailConfigured();
}
function isGoogleConfigured() {
  return Boolean(process.env['GOOGLE_CLIENT_ID']?.trim());
}
var userProfileResponseSchema = t.Object({
  id: t.String(),
  email: t.String({ format: 'email' }),
  name: t.Nullable(t.String()),
  avatarUrl: t.Nullable(t.String()),
});
var mobileGoogleAuthResponseSchema = t.Object({
  user: userProfileResponseSchema,
  accessToken: t.String(),
  refreshToken: t.String(),
});
var mobileRefreshAuthResponseSchema = t.Object({
  accessToken: t.String(),
  refreshToken: t.String(),
  user: userProfileResponseSchema,
});
function userResponse(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
  };
}
async function issueSessionTokens(jwt2, user) {
  const session = await createAuthSession(user.id, user.authVersion);
  try {
    const accessToken = await jwt2.sign({
      sub: user.id,
      ...(user.email ? { email: user.email } : {}),
      av: user.authVersion,
      sid: session.sessionId,
      exp: ACCESS_TOKEN_EXPIRY,
    });
    return { accessToken, refreshToken: session.refreshToken };
  } catch (error) {
    await revokeSessionByToken(await hashToken(session.refreshToken));
    throw error;
  }
}
async function issueTokens(jwt2, cookie, user) {
  const tokens = await issueSessionTokens(jwt2, user);
  cookie[REFRESH_COOKIE_NAME].set({ value: tokens.refreshToken, ...REFRESH_COOKIE_OPTIONS });
  return { accessToken: tokens.accessToken };
}
async function issueMobileTokens(jwt2, user) {
  return issueSessionTokens(jwt2, user);
}
async function refreshAuthToken(jwt2, reqLogger, refreshToken, onInvalidatedToken) {
  if (refreshToken.length > MAX_AUTH_TOKEN_CHARS) {
    onInvalidatedToken?.();
    throw new ApiError(401, 'Invalid refresh token', 'AUTH_INVALID_REFRESH');
  }
  const tokenHash = await hashToken(refreshToken);
  const rotation = await rotateRefreshToken(tokenHash);
  if (rotation.status === 'not_found') {
    onInvalidatedToken?.();
    throw new ApiError(401, 'Invalid refresh token', 'AUTH_INVALID_REFRESH');
  }
  if (rotation.status === 'concurrent') {
    reqLogger.info(
      { event: 'auth.concurrent_refresh', userId: rotation.userId },
      'concurrent refresh within grace window \u2014 not revoking'
    );
    throw new ApiError(401, 'Invalid refresh token', 'AUTH_INVALID_REFRESH');
  }
  if (rotation.status === 'reused') {
    reqLogger.warn(
      { event: 'auth.token_reuse_detected', userId: rotation.userId },
      'refresh token reuse detected \u2014 revoking all user sessions'
    );
    onInvalidatedToken?.();
    throw new ApiError(401, 'Invalid refresh token', 'AUTH_INVALID_REFRESH');
  }
  if (rotation.status === 'expired') {
    onInvalidatedToken?.();
    throw new ApiError(401, 'Refresh token expired', 'AUTH_REFRESH_EXPIRED');
  }
  if (rotation.status === 'account_deleted') {
    onInvalidatedToken?.();
    throw new ApiError(401, 'Account has been deleted', 'AUTH_ACCOUNT_DELETED');
  }
  const accessToken = await jwt2.sign({
    sub: rotation.user.id,
    av: rotation.user.authVersion,
    sid: rotation.sessionId,
    exp: ACCESS_TOKEN_EXPIRY,
  });
  reqLogger.info({ event: 'auth.refresh', userId: rotation.user.id }, 'token refreshed');
  return {
    accessToken,
    refreshToken: rotation.refreshToken,
    user: userResponse(rotation.user),
  };
}
async function signOutWithRefreshToken(refreshToken) {
  if (!refreshToken || typeof refreshToken !== 'string') {
    return;
  }
  if (refreshToken.length > MAX_AUTH_TOKEN_CHARS) {
    return;
  }
  const tokenHash = await hashToken(refreshToken);
  await revokeSessionByToken(tokenHash);
}
async function processGoogleSignIn(
  credential,
  allowedClientIds,
  passthroughApiErrors,
  userAgent,
  reqLogger
) {
  let googlePayload;
  try {
    googlePayload = await verifyGoogleToken(credential, { allowedClientIds });
  } catch (e) {
    reqLogger.warn({ err: e }, 'Google token verification failed');
    if (passthroughApiErrors && e instanceof ApiError) throw e;
    throw new ApiError(401, 'Invalid Google credential', 'AUTH_GOOGLE_INVALID');
  }
  const { user, isNewUser } = await findOrCreateGoogleUser(
    googlePayload.sub,
    googlePayload.email,
    googlePayload.name
  );
  if (isNewUser) {
    const deviceType = classifyDevice(userAgent ?? void 0);
    const timestamp2 = /* @__PURE__ */ new Date().toISOString();
    const text2 = `New user: ${user.email} | ${deviceType} | ${timestamp2}`;
    keepAlive(sendTelegramMessage(text2));
  }
  return { user, isNewUser };
}
var authSecurity = [{ bearerAuth: [] }];
var authRoutes = new Elysia4({ prefix: '/auth' })
  .use(requestLogger)
  .use(jwtPlugin)
  .get(
    '/providers',
    async ({ ip }) => {
      await rateLimit(ip, '/auth/providers', { maxRequests: 100 });
      return {
        emailPassword: isEmailPasswordAvailable(),
        google: isGoogleConfigured(),
        apple: isAppleConfigured(),
        github: isGitHubConfigured(),
        microsoft: isMicrosoftConfigured(),
      };
    },
    {
      response: t.Object({
        emailPassword: t.Boolean(),
        google: t.Boolean(),
        apple: t.Boolean(),
        github: t.Boolean(),
        microsoft: t.Boolean(),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'List available sign-in providers',
        description:
          'Returns public booleans for sign-in methods the current deployment can start. Does not expose provider credentials.',
      },
    }
  )
  .post(
    '/google',
    async ({ jwt: jwt2, body, cookie, set, reqLogger, ip, request }) => {
      assertTrustedCredentialRequest(request);
      await authRateLimit(ip, '/auth/google', { maxRequests: 10 });
      const webClientId = getWebGoogleClientId();
      const { user, isNewUser } = await processGoogleSignIn(
        body.credential,
        [webClientId],
        false,
        request.headers.get('user-agent'),
        reqLogger
      );
      const { accessToken } = await issueTokens(jwt2, cookie, user);
      reqLogger.info({ event: 'auth.google', userId: user.id, isNewUser }, 'google sign-in');
      set.status = 200;
      return { user: userResponse(user), accessToken };
    },
    {
      body: t.Object({
        credential: t.String({ minLength: 1, maxLength: MAX_OAUTH_ID_TOKEN_CHARS }),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Sign in with Google',
        description:
          'Verifies a Google ID token (RS256 + JWKS), finds or creates the user, and issues tokens.',
        responses: {
          200: { description: 'Authenticated; access token in body, refresh token in cookie' },
          401: { description: 'Invalid or expired Google credential' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )
  .post(
    '/mobile/google',
    async ({ jwt: jwt2, body, set, reqLogger, ip, request }) => {
      assertTrustedCredentialRequest(request);
      await authRateLimit(ip, '/auth/mobile/google', { maxRequests: 10 });
      const { user, isNewUser } = await processGoogleSignIn(
        body.credential,
        getMobileGoogleClientIds(),
        true,
        request.headers.get('user-agent'),
        reqLogger
      );
      const tokens = await issueMobileTokens(jwt2, user);
      reqLogger.info(
        { event: 'auth.mobile_google', userId: user.id, isNewUser },
        'mobile google sign-in'
      );
      set.status = 200;
      return { user: userResponse(user), ...tokens };
    },
    {
      body: t.Object({
        credential: t.String({ minLength: 1, maxLength: MAX_OAUTH_ID_TOKEN_CHARS }),
      }),
      response: {
        200: mobileGoogleAuthResponseSchema,
        401: t.Object(
          { error: t.String(), code: t.String() },
          { description: 'Invalid or expired Google credential' }
        ),
        403: t.Object({ error: t.String(), code: t.String() }, { description: 'Account deleted' }),
        429: t.Object({ error: t.String(), code: t.String() }, { description: 'Rate limited' }),
        500: t.Object(
          { error: t.String(), code: t.String() },
          { description: 'Internal or configuration error' }
        ),
        503: t.Object(
          { error: t.String(), code: t.String() },
          { description: 'Google JWKS unavailable' }
        ),
      },
      detail: {
        tags: ['Auth'],
        summary: 'Sign in with Google for mobile clients',
        description:
          'Verifies a Google ID token, finds or creates the user, and returns both access and refresh tokens in the response body.',
      },
    }
  )
  .post(
    '/signup',
    async ({ body, set, reqLogger, ip, request }) => {
      await authRateLimit(ip, '/auth/signup', { maxRequests: 10 });
      assertEmailConfiguredForProduction();
      const name = normalizeDisplayName(body.name);
      const passwordHash = await hashPassword(body.password);
      try {
        const { user, verificationToken } = await createPasswordSignup({
          email: body.email,
          passwordHash,
          name,
        });
        keepAlive(sendVerificationEmail(user.email, verificationToken, request));
        const deviceType = classifyDevice(request.headers.get('user-agent') ?? void 0);
        keepAlive(
          sendTelegramMessage(
            `New user: ${user.email} | ${deviceType} | ${/* @__PURE__ */ new Date().toISOString()}`
          )
        );
        reqLogger.info({ event: 'auth.signup', userId: user.id }, 'email signup');
      } catch (error) {
        if (!(error instanceof ApiError && error.code === 'EMAIL_TAKEN')) throw error;
        reqLogger.info({ event: 'auth.signup_existing' }, 'generic signup acknowledgement');
      }
      set.status = 201;
      return { message: 'If eligible, check your email to continue registration.' };
    },
    {
      body: t.Object({
        email: emailInputSchema,
        password: t.String({ minLength: 8, maxLength: 200 }),
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Sign up with email and password',
        description:
          'Creates an unverified email/password account when eligible and sends a verification email. Always returns the same 201 acknowledgement for existing addresses to prevent enumeration.',
        responses: {
          201: { description: 'Generic registration acknowledgement' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )
  .post(
    '/login',
    async ({ jwt: jwt2, body, cookie, set, reqLogger, ip, request }) => {
      assertTrustedCredentialRequest(request);
      await applyCredentialAbuseLimits(ip, body.email, '/auth/login', 10, 5);
      const user = await authenticatePassword(body.email, body.password);
      if (!user) {
        throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
      }
      if (!user.emailVerified) {
        throw new ApiError(403, 'Email not verified', 'EMAIL_NOT_VERIFIED');
      }
      const { accessToken } = await issueTokens(jwt2, cookie, user);
      reqLogger.info({ event: 'auth.login', userId: user.id }, 'password login');
      set.status = 200;
      return { user: userResponse(user), accessToken };
    },
    {
      body: t.Object({
        email: emailInputSchema,
        password: t.String({ minLength: 1, maxLength: 200 }),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Log in with email and password',
        description:
          'Verifies credentials and issues tokens. Returns a generic 401 for bad credentials (no enumeration) and 403 when the email is unverified.',
        responses: {
          200: { description: 'Authenticated; access token in body, refresh token in cookie' },
          401: { description: 'Invalid credentials' },
          403: { description: 'Email not verified' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )
  .post(
    '/verify-email',
    async ({ jwt: jwt2, body, cookie, set, reqLogger, ip, request }) => {
      assertTrustedCredentialRequest(request);
      await authRateLimit(ip, '/auth/verify-email', { maxRequests: 20 });
      const user = await verifyEmailWithToken(body.token);
      if (!user) {
        throw new ApiError(400, 'Invalid or expired verification token', 'INVALID_TOKEN');
      }
      const { accessToken } = await issueTokens(jwt2, cookie, user);
      reqLogger.info({ event: 'auth.email_verified', userId: user.id }, 'email verified');
      set.status = 200;
      return { user: userResponse(user), accessToken };
    },
    {
      body: t.Object({ token: t.String({ minLength: 1, maxLength: MAX_AUTH_TOKEN_CHARS }) }),
      detail: {
        tags: ['Auth'],
        summary: 'Verify email address',
        description: 'Consumes a verification token, marks the email verified, and issues tokens.',
        responses: {
          200: { description: 'Email verified; tokens issued' },
          400: { description: 'Invalid or expired token' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )
  .post(
    '/resend-verification',
    async ({ body, set, reqLogger, ip, request }) => {
      await Promise.all([
        authRateLimit(ip, '/auth/resend-verification', { maxRequests: 5 }),
        authRateLimit('global', '/auth/resend-verification:global', AUTH_GLOBAL_RATE_LIMIT),
      ]);
      assertEmailConfiguredForProduction();
      const allowed = await recipientActionAllowed(body.email, '/auth/resend-verification');
      const user = allowed ? await findUserByEmail(body.email) : void 0;
      if (user?.passwordHash && !user.emailVerified) {
        const token = await replaceEmailVerificationToken(user.id);
        keepAlive(sendVerificationEmail(user.email, token, request));
        reqLogger.info(
          { event: 'auth.resend_verification', userId: user.id },
          'verification email re-queued'
        );
      }
      set.status = 200;
      return {
        message:
          'If an account exists for that email and still needs verification, a new link has been sent.',
      };
    },
    {
      body: t.Object({ email: emailInputSchema }),
      detail: {
        tags: ['Auth'],
        summary: 'Resend the email verification link',
        description:
          'Re-sends the verification email when an unverified password account exists, replacing any earlier link. Always returns 200 to avoid account enumeration.',
        responses: {
          200: { description: 'Generic acknowledgement' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )
  .post(
    '/forgot-password',
    async ({ body, set, reqLogger, ip, request }) => {
      await Promise.all([
        authRateLimit(ip, '/auth/forgot-password', { maxRequests: 5 }),
        authRateLimit('global', '/auth/forgot-password:global', AUTH_GLOBAL_RATE_LIMIT),
      ]);
      assertEmailConfiguredForProduction();
      const allowed = await recipientActionAllowed(body.email, '/auth/forgot-password');
      const user = allowed ? await findUserByEmail(body.email) : void 0;
      if (user?.passwordHash) {
        const token = await createPasswordResetToken(user.id);
        keepAlive(sendPasswordResetEmail(user.email, token, request));
        reqLogger.info({ event: 'auth.forgot_password', userId: user.id }, 'reset email queued');
      }
      set.status = 200;
      return { message: 'If an account exists for that email, a reset link has been sent.' };
    },
    {
      body: t.Object({ email: emailInputSchema }),
      detail: {
        tags: ['Auth'],
        summary: 'Request a password reset',
        description:
          'Sends a reset link when a password account exists. Always returns 200 to avoid account enumeration.',
        responses: {
          200: { description: 'Generic acknowledgement' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )
  .post(
    '/reset-password',
    async ({ body, cookie, set, reqLogger, ip }) => {
      await Promise.all([
        authRateLimit(ip, '/auth/reset-password', { maxRequests: 10 }),
        authRateLimit('global', '/auth/reset-password:global', AUTH_GLOBAL_RATE_LIMIT),
      ]);
      if (!(await isPasswordResetTokenValid(body.token))) {
        throw new ApiError(400, 'Invalid or expired reset token', 'INVALID_TOKEN');
      }
      const passwordHash = await hashPassword(body.password);
      const userId = await resetPasswordWithToken(body.token, passwordHash);
      if (!userId) {
        throw new ApiError(400, 'Invalid or expired reset token', 'INVALID_TOKEN');
      }
      const refreshCookie = cookie[REFRESH_COOKIE_NAME];
      if (refreshCookie) removeRefreshCookie(refreshCookie);
      reqLogger.info({ event: 'auth.password_reset', userId }, 'password reset');
      set.status = 200;
      return { message: 'Password updated. Sign in with your new password.' };
    },
    {
      body: t.Object({
        token: t.String({ minLength: 1, maxLength: MAX_AUTH_TOKEN_CHARS }),
        password: t.String({ minLength: 8, maxLength: 200 }),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Reset password',
        description: 'Consumes a reset token, sets a new password, and revokes all sessions.',
        responses: {
          200: { description: 'Password updated' },
          400: { description: 'Invalid or expired token' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )
  .get(
    '/apple/start',
    async ({ cookie, redirect, ip, request }) => {
      await authRateLimit(ip, '/auth/apple/start', { maxRequests: 30 });
      if (!isAppleConfigured()) {
        return redirect(socialCallbackUrl(request, 'apple', 'provider_not_configured'));
      }
      const state = generateRefreshToken();
      const nonce = generateRefreshToken();
      cookie[OAUTH_COOKIE_NAMES.apple.state]?.set({
        value: state,
        ...oauthStateCookieOptions('none', IS_PRODUCTION2),
      });
      cookie[OAUTH_COOKIE_NAMES.apple.nonce]?.set({
        value: nonce,
        ...oauthStateCookieOptions('none', IS_PRODUCTION2),
      });
      return redirect(
        buildAppleAuthorizeUrl(state, `${getApiBaseUrl(request)}/api/auth/apple/callback`, nonce)
      );
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Start Sign in with Apple',
        description:
          'Redirects to Apple authorization (response_mode=form_post) and sets a short-lived CSRF state cookie.',
      },
    }
  )
  .post(
    '/apple/callback',
    async ({ jwt: jwt2, body, cookie, redirect, request, reqLogger, ip }) => {
      await authRateLimit(ip, '/auth/apple/callback', { maxRequests: 30 });
      const stateCookie = cookie[OAUTH_COOKIE_NAMES.apple.state];
      const expectedState = oauthCookieValue(stateCookie);
      removeOAuthStateCookie(stateCookie, 'none', IS_PRODUCTION2);
      const nonceCookie = cookie[OAUTH_COOKIE_NAMES.apple.nonce];
      const expectedNonce = oauthCookieValue(nonceCookie);
      removeOAuthStateCookie(nonceCookie, 'none', IS_PRODUCTION2);
      const idToken = typeof body.id_token === 'string' ? body.id_token : void 0;
      const requestState = typeof body.state === 'string' ? body.state : void 0;
      const providerError = typeof body.error === 'string' ? body.error : void 0;
      if (providerError || !idToken || !requestState) {
        return redirect(socialCallbackUrl(request, 'apple', 'cancelled'));
      }
      if (!expectedState || expectedState !== requestState || !expectedNonce) {
        return redirect(socialCallbackUrl(request, 'apple', 'state_mismatch'));
      }
      let claims;
      try {
        claims = await verifyAppleIdToken(idToken, expectedNonce);
      } catch (e) {
        reqLogger.warn({ err: e }, 'apple: id_token verification failed');
        return redirect(socialCallbackUrl(request, 'apple', 'invalid_token'));
      }
      if (!claims.email) {
        return redirect(socialCallbackUrl(request, 'apple', 'email_required'));
      }
      try {
        const { user, isNewUser } = await findOrCreateUserByIdentity({
          provider: 'apple',
          providerAccountId: claims.sub,
          email: claims.email,
          emailVerified: claims.emailVerified,
          name: claims.name ?? parseAppleUserName(body.user),
        });
        if (isNewUser) {
          const deviceType = classifyDevice(request.headers.get('user-agent') ?? void 0);
          keepAlive(
            sendTelegramMessage(
              `New user: ${user.email} | apple/${deviceType} | ${/* @__PURE__ */ new Date().toISOString()}`
            )
          );
        }
        await issueTokens(jwt2, cookie, user);
        reqLogger.info({ event: 'auth.apple', userId: user.id }, 'apple sign-in');
        return redirect(socialCallbackUrl(request, 'apple'));
      } catch (e) {
        reqLogger.warn({ err: e }, 'apple: sign-in failed');
        return redirect(socialCallbackUrl(request, 'apple', identityErrorCode(e)));
      }
    },
    {
      body: t.Object({
        id_token: t.Optional(t.String({ maxLength: MAX_OAUTH_ID_TOKEN_CHARS })),
        state: t.Optional(t.String({ maxLength: MAX_AUTH_TOKEN_CHARS })),
        code: t.Optional(t.String({ maxLength: MAX_OAUTH_CODE_CHARS })),
        user: t.Optional(t.String({ maxLength: MAX_OAUTH_USER_CHARS })),
        error: t.Optional(t.String({ maxLength: MAX_OAUTH_ERROR_CHARS })),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Apple sign-in callback (form_post)',
        description:
          'Verifies the Apple ID token, links or creates the user, sets the refresh cookie, and redirects to the SPA callback.',
      },
    }
  )
  .get(
    '/github/start',
    async ({ cookie, redirect, ip, request }) => {
      await authRateLimit(ip, '/auth/github/start', { maxRequests: 30 });
      if (!isGitHubConfigured()) {
        return redirect(socialCallbackUrl(request, 'github', 'provider_not_configured'));
      }
      const state = generateRefreshToken();
      const verifier = generatePkceVerifier();
      const challenge = await pkceChallenge(verifier);
      cookie[OAUTH_COOKIE_NAMES.github.state]?.set({
        value: state,
        ...oauthStateCookieOptions('lax', IS_PRODUCTION2),
      });
      cookie[OAUTH_COOKIE_NAMES.github.pkce]?.set({
        value: verifier,
        ...oauthStateCookieOptions('lax', IS_PRODUCTION2),
      });
      return redirect(
        buildGitHubAuthorizeUrl(
          state,
          `${getApiBaseUrl(request)}/api/auth/github/callback`,
          challenge
        )
      );
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Start GitHub sign-in',
        description:
          'Redirects to GitHub authorization and sets a short-lived CSRF state cookie (SameSite=Lax).',
      },
    }
  )
  .get(
    '/github/callback',
    async ({ jwt: jwt2, query, cookie, redirect, request, reqLogger, ip }) => {
      await authRateLimit(ip, '/auth/github/callback', { maxRequests: 30 });
      const stateCookie = cookie[OAUTH_COOKIE_NAMES.github.state];
      const expectedState = oauthCookieValue(stateCookie);
      removeOAuthStateCookie(stateCookie, 'lax', IS_PRODUCTION2);
      const pkceCookie = cookie[OAUTH_COOKIE_NAMES.github.pkce];
      const codeVerifier = oauthCookieValue(pkceCookie);
      removeOAuthStateCookie(pkceCookie, 'lax', IS_PRODUCTION2);
      const code = typeof query.code === 'string' ? query.code : void 0;
      const requestState = typeof query.state === 'string' ? query.state : void 0;
      const providerError = typeof query.error === 'string' ? query.error : void 0;
      if (providerError || !code || !requestState) {
        return redirect(socialCallbackUrl(request, 'github', 'cancelled'));
      }
      if (!expectedState || expectedState !== requestState || !codeVerifier) {
        return redirect(socialCallbackUrl(request, 'github', 'state_mismatch'));
      }
      let identity;
      try {
        const redirectUri = `${getApiBaseUrl(request)}/api/auth/github/callback`;
        const accessToken = await exchangeGitHubCode(code, redirectUri, codeVerifier);
        identity = await fetchGitHubIdentity(accessToken);
      } catch (e) {
        reqLogger.warn({ err: e }, 'github: oauth exchange/lookup failed');
        return redirect(socialCallbackUrl(request, 'github', providerExchangeErrorCode(e)));
      }
      try {
        const { user, isNewUser } = await findOrCreateUserByIdentity({
          provider: 'github',
          providerAccountId: identity.id,
          email: identity.email,
          emailVerified: identity.emailVerified,
          name: identity.name,
        });
        if (isNewUser) {
          const deviceType = classifyDevice(request.headers.get('user-agent') ?? void 0);
          keepAlive(
            sendTelegramMessage(
              `New user: ${user.email} | github/${deviceType} | ${/* @__PURE__ */ new Date().toISOString()}`
            )
          );
        }
        await issueTokens(jwt2, cookie, user);
        reqLogger.info({ event: 'auth.github', userId: user.id }, 'github sign-in');
        return redirect(socialCallbackUrl(request, 'github'));
      } catch (e) {
        reqLogger.warn({ err: e }, 'github: sign-in failed');
        return redirect(socialCallbackUrl(request, 'github', identityErrorCode(e)));
      }
    },
    {
      query: t.Object({
        code: t.Optional(t.String({ maxLength: MAX_OAUTH_CODE_CHARS })),
        state: t.Optional(t.String({ maxLength: MAX_AUTH_TOKEN_CHARS })),
        error: t.Optional(t.String({ maxLength: MAX_OAUTH_ERROR_CHARS })),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'GitHub sign-in callback',
        description:
          'Exchanges the code, looks up the GitHub user + primary verified email, links or creates the user, sets the refresh cookie, and redirects to the SPA callback.',
      },
    }
  )
  .get(
    '/microsoft/start',
    async ({ cookie, redirect, ip, request }) => {
      await authRateLimit(ip, '/auth/microsoft/start', { maxRequests: 30 });
      if (!isMicrosoftConfigured()) {
        return redirect(socialCallbackUrl(request, 'microsoft', 'provider_not_configured'));
      }
      const state = generateRefreshToken();
      const nonce = generateRefreshToken();
      const verifier = generatePkceVerifier();
      const challenge = await pkceChallenge(verifier);
      cookie[OAUTH_COOKIE_NAMES.microsoft.state]?.set({
        value: state,
        ...oauthStateCookieOptions('lax', IS_PRODUCTION2),
      });
      cookie[OAUTH_COOKIE_NAMES.microsoft.nonce]?.set({
        value: nonce,
        ...oauthStateCookieOptions('lax', IS_PRODUCTION2),
      });
      cookie[OAUTH_COOKIE_NAMES.microsoft.pkce]?.set({
        value: verifier,
        ...oauthStateCookieOptions('lax', IS_PRODUCTION2),
      });
      return redirect(
        buildMicrosoftAuthorizeUrl(
          state,
          `${getApiBaseUrl(request)}/api/auth/microsoft/callback`,
          nonce,
          challenge
        )
      );
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Start Microsoft sign-in',
        description:
          'Redirects to Microsoft authorization and sets short-lived CSRF, nonce, and PKCE cookies.',
      },
    }
  )
  .get(
    '/microsoft/callback',
    async ({ jwt: jwt2, query, cookie, redirect, request, reqLogger, ip }) => {
      await authRateLimit(ip, '/auth/microsoft/callback', { maxRequests: 30 });
      const stateCookie = cookie[OAUTH_COOKIE_NAMES.microsoft.state];
      const expectedState = oauthCookieValue(stateCookie);
      removeOAuthStateCookie(stateCookie, 'lax', IS_PRODUCTION2);
      const nonceCookie = cookie[OAUTH_COOKIE_NAMES.microsoft.nonce];
      const expectedNonce = oauthCookieValue(nonceCookie);
      removeOAuthStateCookie(nonceCookie, 'lax', IS_PRODUCTION2);
      const pkceCookie = cookie[OAUTH_COOKIE_NAMES.microsoft.pkce];
      const codeVerifier = oauthCookieValue(pkceCookie);
      removeOAuthStateCookie(pkceCookie, 'lax', IS_PRODUCTION2);
      const code = typeof query.code === 'string' ? query.code : void 0;
      const requestState = typeof query.state === 'string' ? query.state : void 0;
      const providerError = typeof query.error === 'string' ? query.error : void 0;
      if (providerError || !code || !requestState) {
        return redirect(socialCallbackUrl(request, 'microsoft', 'cancelled'));
      }
      if (!expectedState || expectedState !== requestState || !expectedNonce || !codeVerifier) {
        return redirect(socialCallbackUrl(request, 'microsoft', 'state_mismatch'));
      }
      let identity;
      try {
        const redirectUri = `${getApiBaseUrl(request)}/api/auth/microsoft/callback`;
        const tokenSet = await exchangeMicrosoftCode(code, redirectUri, codeVerifier);
        identity = await fetchMicrosoftIdentity(
          tokenSet.idToken,
          tokenSet.accessToken,
          expectedNonce
        );
      } catch (e) {
        reqLogger.warn({ err: e }, 'microsoft: oauth exchange/lookup failed');
        return redirect(socialCallbackUrl(request, 'microsoft', providerExchangeErrorCode(e)));
      }
      try {
        const { user, isNewUser } = await findOrCreateUserByIdentity({
          provider: 'microsoft',
          providerAccountId: identity.id,
          email: identity.email,
          emailVerified: identity.emailVerified,
          name: identity.name,
        });
        if (isNewUser) {
          const deviceType = classifyDevice(request.headers.get('user-agent') ?? void 0);
          keepAlive(
            sendTelegramMessage(
              `New user: ${user.email} | microsoft/${deviceType} | ${/* @__PURE__ */ new Date().toISOString()}`
            )
          );
        }
        await issueTokens(jwt2, cookie, user);
        reqLogger.info({ event: 'auth.microsoft', userId: user.id }, 'microsoft sign-in');
        return redirect(socialCallbackUrl(request, 'microsoft'));
      } catch (e) {
        reqLogger.warn({ err: e }, 'microsoft: sign-in failed');
        return redirect(socialCallbackUrl(request, 'microsoft', identityErrorCode(e)));
      }
    },
    {
      query: t.Object({
        code: t.Optional(t.String({ maxLength: MAX_OAUTH_CODE_CHARS })),
        state: t.Optional(t.String({ maxLength: MAX_AUTH_TOKEN_CHARS })),
        error: t.Optional(t.String({ maxLength: MAX_OAUTH_ERROR_CHARS })),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Microsoft sign-in callback',
        description:
          'Exchanges the code, verifies the Microsoft ID token, links or creates the user, sets the refresh cookie, and redirects to the SPA callback.',
      },
    }
  )
  .use((app2) =>
    DEV_AUTH_ENABLED
      ? app2
          .post(
            '/dev',
            async ({ jwt: jwt2, body, cookie, set, ip, headers, request }) => {
              assertTrustedCredentialRequest(request);
              await authRateLimit(ip, 'POST /auth/dev', DEV_AUTH_RATE_LIMIT);
              if (!devAuthSecretMatches(headers['x-dev-auth-secret'])) {
                throw new ApiError(401, 'Invalid dev auth secret', 'UNAUTHORIZED');
              }
              const existing = await findUserByEmail(body.email);
              const user = existing
                ? existing
                : (await findOrCreateGoogleUser(`dev-${crypto.randomUUID()}`, body.email, void 0))
                    .user;
              const { accessToken } = await issueTokens(jwt2, cookie, user);
              set.status = 201;
              return { user: userResponse(user), accessToken };
            },
            {
              body: t.Object({
                email: emailInputSchema,
              }),
              detail: { tags: ['Auth'], summary: 'Dev-only test sign-in (404 in production)' },
            }
          )
          .post(
            '/dev/password-user',
            async ({ body, set, ip, headers, request }) => {
              assertTrustedCredentialRequest(request);
              await authRateLimit(ip, 'POST /auth/dev/password-user', DEV_AUTH_RATE_LIMIT);
              if (!devAuthSecretMatches(headers['x-dev-auth-secret'])) {
                throw new ApiError(401, 'Invalid dev auth secret', 'UNAUTHORIZED');
              }
              const passwordHash = await hashPassword(body.password);
              const existing = await findUserByEmail(body.email);
              const user = existing
                ? existing
                : await createPasswordUser({
                    email: body.email,
                    passwordHash,
                    name: body.name,
                  });
              if (existing) {
                await setUserPassword(existing.id, passwordHash);
              }
              const verified = await markEmailVerified(user.id);
              if (!verified) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
              set.status = 201;
              return { user: userResponse(verified) };
            },
            {
              body: t.Object({
                email: emailInputSchema,
                password: t.String({ minLength: 8, maxLength: 200 }),
                name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
              }),
              detail: {
                tags: ['Auth'],
                summary: 'Dev-only verified password-user seed (404 in production)',
              },
            }
          )
      : app2
  )
  .post(
    '/refresh',
    async ({ jwt: jwt2, cookie, reqLogger, ip }) => {
      await authRateLimit(ip, '/auth/refresh', IS_PRODUCTION2 ? void 0 : { maxRequests: 500 });
      const refreshCookie = cookie[REFRESH_COOKIE_NAME];
      const tokenValue = refreshCookie?.value;
      if (!tokenValue || typeof tokenValue !== 'string') {
        throw new ApiError(401, 'No refresh token', 'AUTH_NO_REFRESH_TOKEN');
      }
      const refreshed = await refreshAuthToken(jwt2, reqLogger, tokenValue, () => {
        removeRefreshCookie(refreshCookie);
      });
      refreshCookie.set({ value: refreshed.refreshToken, ...REFRESH_COOKIE_OPTIONS });
      return { accessToken: refreshed.accessToken, user: userResponse(refreshed.user) };
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        description:
          'Rotates the refresh token (family tracking for theft detection), issues a new short-lived access token, and returns the current user profile.',
        responses: {
          200: { description: 'New access token issued; refresh token cookie rotated' },
          401: { description: 'Missing, invalid, expired, or reused refresh token' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )
  .post(
    '/mobile/refresh',
    async ({ jwt: jwt2, body, reqLogger, ip }) => {
      await authRateLimit(
        ip,
        '/auth/mobile/refresh',
        IS_PRODUCTION2 ? void 0 : { maxRequests: 500 }
      );
      if (!body.refreshToken || body.refreshToken.length === 0) {
        throw new ApiError(401, 'No refresh token', 'AUTH_NO_REFRESH_TOKEN');
      }
      const refreshed = await refreshAuthToken(jwt2, reqLogger, body.refreshToken);
      return refreshed;
    },
    {
      body: t.Object({ refreshToken: t.Optional(t.String({ maxLength: MAX_AUTH_TOKEN_CHARS })) }),
      response: {
        200: mobileRefreshAuthResponseSchema,
        401: t.Object(
          { error: t.String(), code: t.String() },
          { description: 'Missing, invalid, expired, or reused refresh token' }
        ),
        429: t.Object({ error: t.String(), code: t.String() }, { description: 'Rate limited' }),
      },
      detail: {
        tags: ['Auth'],
        summary: 'Refresh mobile auth tokens',
        description:
          'Rotates the mobile refresh token and returns a new access token, refresh token, and current user profile in the response body.',
      },
    }
  )
  .post(
    '/signout',
    async ({ cookie, reqLogger, ip }) => {
      const refreshCookie = cookie[REFRESH_COOKIE_NAME];
      try {
        await rateLimit(ip, '/auth/signout');
        await signOutWithRefreshToken(refreshCookie?.value);
        reqLogger.info({ event: 'auth.signout' }, 'user signed out');
        return new Response(null, { status: 204 });
      } finally {
        if (refreshCookie) removeRefreshCookie(refreshCookie);
      }
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Sign out',
        description: 'Revokes the current refresh token and clears the cookie.',
        responses: {
          204: { description: 'Signed out successfully' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )
  .post(
    '/mobile/signout',
    async ({ body, reqLogger, ip }) => {
      await rateLimit(ip, '/auth/mobile/signout');
      await signOutWithRefreshToken(body.refreshToken);
      reqLogger.info({ event: 'auth.mobile_signout' }, 'mobile user signed out');
      return new Response(null, { status: 204 });
    },
    {
      body: t.Object({ refreshToken: t.Optional(t.String({ maxLength: MAX_AUTH_TOKEN_CHARS })) }),
      response: {
        429: t.Object({ error: t.String(), code: t.String() }, { description: 'Rate limited' }),
      },
      detail: {
        tags: ['Auth'],
        summary: 'Sign out mobile client',
        description: 'Revokes the provided refresh token when present.',
      },
    }
  )
  .get(
    '/me',
    async ({ jwt: jwt2, headers }) => {
      const { userId } = await resolveUserId({ jwt: jwt2, headers });
      await rateLimit(userId, 'GET /auth/me', { maxRequests: 100 });
      const user = await findUserById(userId);
      if (!user) {
        throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
      }
      return userResponse(user);
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Get current user',
        description: "Returns the authenticated user's profile from the Bearer access token.",
        security: authSecurity,
        responses: {
          200: { description: 'User profile' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'User not found (deleted after token was issued)' },
        },
      },
    }
  )
  .resolve(resolveUserId)
  .patch(
    '/me',
    async ({ userId, body, reqLogger, ip }) => {
      await rateLimit(ip, '/auth/me/patch', { maxRequests: 20, failClosed: true });
      assertValidAvatarDataUrl(body.avatarUrl);
      const updated = await updateUserProfile(userId, {
        name: normalizeDisplayName(body.name),
        avatarUrl: body.avatarUrl,
      });
      reqLogger.info({ event: 'auth.profile_update', userId }, 'profile updated');
      return userResponse(updated);
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        avatarUrl: t.Optional(t.Nullable(t.String({ maxLength: MAX_AVATAR_DATA_URL_CHARS }))),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Update user profile',
        description: 'Updates name and/or avatar. Send avatarUrl: null to remove the avatar.',
        security: authSecurity,
        responses: {
          200: { description: 'Updated user profile' },
          400: { description: 'Invalid avatar format or size' },
          401: { description: 'Missing or invalid token' },
        },
      },
    }
  )
  .delete(
    '/me',
    async ({ userId, cookie, reqLogger, ip }) => {
      await rateLimit(ip, '/auth/me/delete', { maxRequests: 5, failClosed: true });
      await softDeleteUser(userId);
      const refreshCookie = cookie[REFRESH_COOKIE_NAME];
      if (refreshCookie) removeRefreshCookie(refreshCookie);
      reqLogger.info({ event: 'auth.account_deleted', userId }, 'account soft-deleted');
      return new Response(null, { status: 204 });
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Delete account',
        description:
          'Soft-deletes the user account (sets deleted_at). All refresh tokens are revoked. Data is purged after 30 days.',
        security: authSecurity,
        responses: {
          204: { description: 'Account soft-deleted' },
          401: { description: 'Missing or invalid token' },
        },
      },
    }
  );

// apps/backend/api/src/routes/programs.ts
import { Elysia as Elysia5, t as t2 } from 'elysia';

// apps/backend/api/src/services/programs.ts
import {
  eq as eq4,
  and as and4,
  lt as lt2,
  desc as desc2,
  or,
  gt,
  asc as asc2,
  sql as sql5,
} from 'drizzle-orm';

// apps/backend/api/src/services/catalog.ts
import { eq as eq2, and as and2, asc, inArray, sql as sql3 } from 'drizzle-orm';

// packages/domain/src/schemas/program-definition.ts
import { z } from 'zod/v4';
var MAX_PROGRAM_STRING_LENGTH = 1e3;
var ProgramStringSchema = z.string().max(MAX_PROGRAM_STRING_LENGTH);
var RequiredProgramStringSchema = ProgramStringSchema.min(1);
var AddWeightRuleSchema = z.strictObject({
  type: z.literal('add_weight'),
});
var DeloadPercentRuleSchema = z.strictObject({
  type: z.literal('deload_percent'),
  percent: z.number().min(1).max(99),
});
var AdvanceStageRuleSchema = z.strictObject({
  type: z.literal('advance_stage'),
});
var AddWeightResetStageRuleSchema = z.strictObject({
  type: z.literal('add_weight_reset_stage'),
  amount: z.number().positive(),
});
var NoChangeRuleSchema = z.strictObject({
  type: z.literal('no_change'),
});
var AdvanceStageAddWeightRuleSchema = z.strictObject({
  type: z.literal('advance_stage_add_weight'),
});
var UpdateTmRuleSchema = z.strictObject({
  type: z.literal('update_tm'),
  amount: z.number(),
  minAmrapReps: z.number().int().nonnegative(),
});
var DoubleProgressionRuleSchema = z
  .strictObject({
    type: z.literal('double_progression'),
    repRangeTop: z.number().int().positive(),
    repRangeBottom: z.number().int().positive(),
  })
  .refine((rule) => rule.repRangeBottom <= rule.repRangeTop, {
    message: 'repRangeBottom must be <= repRangeTop',
  });
var ProgressionRuleSchema = z.discriminatedUnion('type', [
  AddWeightRuleSchema,
  DeloadPercentRuleSchema,
  AdvanceStageRuleSchema,
  AddWeightResetStageRuleSchema,
  NoChangeRuleSchema,
  AdvanceStageAddWeightRuleSchema,
  UpdateTmRuleSchema,
  DoubleProgressionRuleSchema,
]);
var StageDefinitionSchema = z.strictObject({
  sets: z.number().int().positive(),
  reps: z.number().int().positive(),
  amrap: z.boolean().optional(),
  repsMax: z.number().int().positive().optional(),
});
var TierSchema = RequiredProgramStringSchema;
var RoleSchema = z.enum(['primary', 'secondary', 'accessory']);
var SetPrescriptionSchema = z.strictObject({
  percent: z.number().min(0).max(120),
  reps: z.number().int().positive(),
  sets: z.number().int().positive(),
});
var MAX_STAGES_PER_SLOT = 100;
var MAX_PRESCRIPTIONS_PER_SLOT = 100;
var ExerciseSlotSchema = z
  .strictObject({
    id: RequiredProgramStringSchema,
    exerciseId: RequiredProgramStringSchema,
    tier: TierSchema,
    stages: z.array(StageDefinitionSchema).min(1).max(MAX_STAGES_PER_SLOT),
    onSuccess: ProgressionRuleSchema,
    onFinalStageSuccess: ProgressionRuleSchema.optional(),
    onUndefined: ProgressionRuleSchema.optional(),
    onMidStageFail: ProgressionRuleSchema,
    onFinalStageFail: ProgressionRuleSchema,
    startWeightKey: RequiredProgramStringSchema,
    startWeightMultiplier: z.number().positive().optional(),
    startWeightOffset: z.number().int().optional(),
    trainingMaxKey: RequiredProgramStringSchema.optional(),
    tmPercent: z.number().positive().max(1).optional(),
    role: RoleSchema.optional(),
    notes: RequiredProgramStringSchema.optional(),
    prescriptions: z.array(SetPrescriptionSchema).min(1).max(MAX_PRESCRIPTIONS_PER_SLOT).optional(),
    percentOf: RequiredProgramStringSchema.optional(),
    isGpp: z.boolean().optional(),
    complexReps: RequiredProgramStringSchema.optional(),
    propagatesTo: RequiredProgramStringSchema.optional(),
    isTestSlot: z.boolean().optional(),
    isBodyweight: z.boolean().optional(),
    progressionSetIndex: z.number().int().nonnegative().optional(),
  })
  .refine(
    (slot) => {
      const usesUpdateTm = [
        slot.onSuccess,
        slot.onMidStageFail,
        slot.onFinalStageFail,
        slot.onFinalStageSuccess,
        slot.onUndefined,
      ].some((r) => r?.type === 'update_tm');
      return !usesUpdateTm || slot.trainingMaxKey !== void 0;
    },
    { message: 'trainingMaxKey is required when any progression rule uses update_tm' }
  );
var MAX_SLOTS_PER_DAY = 50;
var MAX_DAYS = 1e3;
var MAX_TOTAL_WORKOUTS = 2e3;
var MAX_TOTAL_SLOTS = 5e3;
var MAX_PROGRAM_EXERCISES = 100;
var MAX_PROGRAM_CONFIG_FIELDS = 100;
var MAX_PROGRAM_WEIGHT_INCREMENTS = 100;
var MAX_SELECT_OPTIONS = 100;
var ProgramDaySchema = z.strictObject({
  name: RequiredProgramStringSchema,
  slots: z.array(ExerciseSlotSchema).min(1).max(MAX_SLOTS_PER_DAY),
});
var WeightConfigFieldSchema = z.strictObject({
  key: RequiredProgramStringSchema,
  label: RequiredProgramStringSchema,
  type: z.literal('weight'),
  min: z.number(),
  step: z.number().positive(),
  group: RequiredProgramStringSchema.optional(),
  hint: RequiredProgramStringSchema.optional(),
  groupHint: RequiredProgramStringSchema.optional(),
});
var SelectOptionSchema = z.strictObject({
  label: RequiredProgramStringSchema,
  value: RequiredProgramStringSchema,
});
var SelectConfigFieldSchema = z.strictObject({
  key: RequiredProgramStringSchema,
  label: RequiredProgramStringSchema,
  type: z.literal('select'),
  options: z.array(SelectOptionSchema).min(1).max(MAX_SELECT_OPTIONS),
  group: RequiredProgramStringSchema.optional(),
});
var ConfigFieldSchema = z.discriminatedUnion('type', [
  WeightConfigFieldSchema,
  SelectConfigFieldSchema,
]);
var ProgramDefinitionSchema = z
  .strictObject({
    id: RequiredProgramStringSchema,
    name: RequiredProgramStringSchema,
    description: ProgramStringSchema,
    author: ProgramStringSchema,
    version: z.number().int().positive(),
    category: ProgramStringSchema,
    source: z.enum(['preset', 'custom']),
    days: z.array(ProgramDaySchema).min(1).max(MAX_DAYS),
    cycleLength: z.number().int().positive(),
    totalWorkouts: z.number().int().positive().max(MAX_TOTAL_WORKOUTS),
    workoutsPerWeek: z.number().int().positive(),
    exercises: z
      .record(ProgramStringSchema, z.strictObject({ name: RequiredProgramStringSchema }))
      .refine((exercises2) => Object.keys(exercises2).length <= MAX_PROGRAM_EXERCISES, {
        message: `exercises must have at most ${MAX_PROGRAM_EXERCISES} entries`,
      }),
    configFields: z.array(ConfigFieldSchema).max(MAX_PROGRAM_CONFIG_FIELDS),
    weightIncrements: z
      .record(ProgramStringSchema, z.number().nonnegative())
      .refine((increments) => Object.keys(increments).length <= MAX_PROGRAM_WEIGHT_INCREMENTS, {
        message: `weightIncrements must have at most ${MAX_PROGRAM_WEIGHT_INCREMENTS} entries`,
      }),
    configTitle: RequiredProgramStringSchema.optional(),
    configDescription: RequiredProgramStringSchema.optional(),
    configEditTitle: RequiredProgramStringSchema.optional(),
    configEditDescription: RequiredProgramStringSchema.optional(),
    displayMode: z.enum(['flat', 'blocks']).optional(),
  })
  .refine(
    (definition) =>
      definition.days.reduce((total, day) => total + day.slots.length, 0) <= MAX_TOTAL_SLOTS,
    { message: `days must contain at most ${MAX_TOTAL_SLOTS} slots in total` }
  );

// apps/backend/api/src/lib/result.ts
function ok(value) {
  return { ok: true, value };
}
function err(error) {
  return { ok: false, error };
}

// apps/backend/api/src/lib/definition-utils.ts
function collectExerciseIds(definition) {
  const ids = /* @__PURE__ */ new Set();
  if (!isRecord(definition)) return ids;
  const defExercises = definition['exercises'];
  if (isRecord(defExercises)) {
    for (const key of Object.keys(defExercises)) {
      ids.add(key);
    }
  }
  const days = definition['days'];
  if (!Array.isArray(days)) return ids;
  for (const day of days) {
    if (!isRecord(day)) continue;
    const slots = day['slots'];
    if (!Array.isArray(slots)) continue;
    for (const slot of slots) {
      if (!isRecord(slot)) continue;
      const exerciseId = slot['exerciseId'];
      if (typeof exerciseId === 'string') {
        ids.add(exerciseId);
      }
    }
  }
  return ids;
}

// apps/backend/api/src/lib/hydrate-program.ts
function hydrateProgramDefinition(template, exerciseRows) {
  if (!isRecord(template.definition)) {
    return err({
      code: 'INVALID_DEFINITION',
      message: `Definition JSONB for program ${template.id} is not a valid object`,
    });
  }
  const exerciseLookup = /* @__PURE__ */ new Map();
  for (const row of exerciseRows) {
    exerciseLookup.set(row.id, row.name);
  }
  const referencedIds = collectExerciseIds(template.definition);
  for (const exerciseId of referencedIds) {
    if (!exerciseLookup.has(exerciseId)) {
      return err({ code: 'MISSING_EXERCISE_REFERENCE', exerciseId });
    }
  }
  const exerciseMap = {};
  for (const exerciseId of referencedIds) {
    const name = exerciseLookup.get(exerciseId);
    if (name !== void 0) {
      exerciseMap[exerciseId] = { name };
    }
  }
  const hydrated = {
    id: template.id,
    name: template.name,
    description: template.description,
    author: template.author,
    version: template.version,
    category: template.category,
    source: template.source,
    ...template.definition,
    exercises: exerciseMap,
  };
  const parseResult = ProgramDefinitionSchema.safeParse(hydrated);
  if (!parseResult.success) {
    return err({ code: 'SCHEMA_VALIDATION_FAILED', cause: parseResult.error });
  }
  return ok(parseResult.data);
}

// packages/domain/src/generic-engine.ts
function roundToNearestHalf(value) {
  const rounded = Math.round(value * 2) / 2;
  if (!Number.isFinite(rounded) || rounded < 0) return 0;
  return rounded;
}
function roundToNearest(value, step) {
  if (step <= 0 || !Number.isFinite(step)) return roundToNearestHalf(value);
  const rounded = Math.round(value / step) * step;
  if (!Number.isFinite(rounded) || rounded < 0) return 0;
  return Math.round(rounded * 1e3) / 1e3;
}
function requireValue(value, message) {
  if (value === void 0) {
    throw new Error(message);
  }
  return value;
}
function deriveResultFromSetLogs(setLogs, rule) {
  if (setLogs === void 0 || setLogs.length === 0) return void 0;
  if (setLogs.every((s) => s.reps >= rule.repRangeTop)) return 'success';
  if (setLogs.some((s) => s.reps < rule.repRangeBottom)) return 'fail';
  return void 0;
}
function deriveResultFromSetLogsSimple(setLogs, targetReps) {
  if (setLogs === void 0 || setLogs.length === 0) return void 0;
  if (setLogs.every((s) => s.reps >= targetReps)) return 'success';
  return 'fail';
}
function deriveSlotResult(slot, slotResult, targetReps) {
  if (slotResult.setLogs === void 0 || slotResult.setLogs.length === 0) {
    return slotResult.result;
  }
  const idx = slot.progressionSetIndex;
  const selectedLog =
    idx !== void 0 && idx < slotResult.setLogs.length ? slotResult.setLogs[idx] : void 0;
  const logs = selectedLog !== void 0 ? [selectedLog] : slotResult.setLogs;
  if (slot.onSuccess.type === 'double_progression') {
    const derived2 = deriveResultFromSetLogs(logs, slot.onSuccess);
    return derived2 ?? slotResult.result;
  }
  const derived = deriveResultFromSetLogsSimple(logs, targetReps);
  return derived ?? slotResult.result;
}
var TIER_ROLE_MAP = {
  t1: 'primary',
  t2: 'secondary',
  t3: 'primary',
};
function resolveRole(explicitRole, tier) {
  if (explicitRole !== void 0) return explicitRole;
  return TIER_ROLE_MAP[tier];
}
function toSlotResult(value) {
  return value ?? {};
}
function applyRule(rule, state, increment, maxStageIdx, roundingStep) {
  switch (rule.type) {
    case 'add_weight':
      return { ...state, weight: state.weight + increment };
    case 'advance_stage':
      return { ...state, stage: Math.min(state.stage + 1, maxStageIdx) };
    case 'advance_stage_add_weight':
      return {
        ...state,
        stage: Math.min(state.stage + 1, maxStageIdx),
        weight: state.weight + increment,
      };
    case 'deload_percent':
      return {
        ...state,
        weight: roundToNearest(state.weight * (1 - rule.percent / 100), roundingStep),
        stage: 0,
      };
    case 'add_weight_reset_stage':
      return {
        ...state,
        weight: roundToNearest(state.weight + rule.amount, roundingStep),
        stage: 0,
      };
    case 'no_change':
      return { ...state };
    case 'update_tm':
      return { ...state };
    case 'double_progression':
      return { ...state, weight: state.weight + increment };
  }
  return state;
}
function applyUpdateTm(rule, slot, slotResult, tmState, slotState, state, roundingStep) {
  if (slot.trainingMaxKey === void 0) {
    throw new Error('update_tm rule requires trainingMaxKey on slot');
  }
  const amrapReps = slotResult.amrapReps;
  const currentTm = tmState[slot.trainingMaxKey] ?? 0;
  if (amrapReps !== void 0 && amrapReps >= rule.minAmrapReps) {
    tmState[slot.trainingMaxKey] = roundToNearest(currentTm + rule.amount, roundingStep);
    slotState[slot.id] = { ...state, everChanged: true };
  } else {
    slotState[slot.id] = { ...state, everChanged: state.everChanged };
  }
}
function applySlotProgression(
  slot,
  state,
  slotResult,
  resultValue,
  increment,
  tmState,
  slotState,
  roundingStep
) {
  const maxStageIdx = slot.stages.length - 1;
  if (resultValue === 'fail') {
    const rule2 = state.stage >= maxStageIdx ? slot.onFinalStageFail : slot.onMidStageFail;
    if (rule2.type === 'update_tm') {
      applyUpdateTm(rule2, slot, slotResult, tmState, slotState, state, roundingStep);
      return;
    }
    const changesState = rule2.type !== 'no_change';
    const nextState2 = applyRule(rule2, state, increment, maxStageIdx, roundingStep);
    slotState[slot.id] = { ...nextState2, everChanged: state.everChanged || changesState };
    return;
  }
  if (resultValue === 'success') {
    const rule2 =
      state.stage >= maxStageIdx && slot.onFinalStageSuccess
        ? slot.onFinalStageSuccess
        : slot.onSuccess;
    if (rule2.type === 'update_tm') {
      applyUpdateTm(rule2, slot, slotResult, tmState, slotState, state, roundingStep);
      return;
    }
    const nextState2 = applyRule(rule2, state, increment, maxStageIdx, roundingStep);
    slotState[slot.id] = { ...nextState2, everChanged: state.everChanged };
    return;
  }
  const rule = slot.onUndefined ?? slot.onSuccess;
  if (rule.type === 'update_tm') {
    applyUpdateTm(rule, slot, slotResult, tmState, slotState, state, roundingStep);
    return;
  }
  const nextState = applyRule(rule, state, increment, maxStageIdx, roundingStep);
  slotState[slot.id] = { ...nextState, everChanged: state.everChanged };
}
function configToNum(config, key) {
  const v = config[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
function computeGenericProgram(definition, config, results, options) {
  const DEFAULT_ROUNDING_STEP = 2.5;
  const roundingStep = configToNum(config, 'rounding') || DEFAULT_ROUNDING_STEP;
  const slotState = {};
  for (const day of definition.days) {
    for (const slot of day.slots) {
      if (!(slot.id in slotState)) {
        const base = configToNum(config, slot.startWeightKey);
        const multiplied =
          slot.startWeightMultiplier !== void 0
            ? roundToNearest(base * slot.startWeightMultiplier, roundingStep)
            : base;
        const offset = slot.startWeightOffset ?? 0;
        const increment = definition.weightIncrements[slot.exerciseId] ?? 0;
        const weight = roundToNearest(multiplied - offset * increment, roundingStep);
        slotState[slot.id] = { weight, stage: 0, everChanged: false };
      }
    }
  }
  const tmState = {};
  for (const day of definition.days) {
    for (const slot of day.slots) {
      if (slot.trainingMaxKey !== void 0 && !(slot.trainingMaxKey in tmState)) {
        tmState[slot.trainingMaxKey] = configToNum(config, slot.trainingMaxKey);
      }
    }
  }
  const rows = [];
  const cycleLength = definition.days.length;
  const prevWeightByExerciseId = /* @__PURE__ */ new Map();
  const rowLimit = Math.min(definition.totalWorkouts, options?.maxRows ?? definition.totalWorkouts);
  for (let i = 0; i < rowLimit; i++) {
    const day = requireValue(definition.days[i % cycleLength], `Missing day for workout ${i}`);
    const workoutResult = results[String(i)] ?? {};
    const derivedResultsBySlotId = {};
    const slots = day.slots.map((slot) => {
      const state = requireValue(slotState[slot.id], `Missing slot state for ${slot.id}`);
      const slotResult = toSlotResult(workoutResult[slot.id]);
      const exercise = requireValue(
        definition.exercises[slot.exerciseId],
        `Missing exercise definition for ${slot.exerciseId}`
      );
      const exerciseName = exercise.name;
      const role = resolveRole(slot.role, slot.tier);
      if (slot.prescriptions !== void 0 && slot.percentOf !== void 0) {
        const base1rm = configToNum(config, slot.percentOf);
        const resolvedPrescriptions = slot.prescriptions.map((p) => ({
          percent: p.percent,
          reps: p.reps,
          sets: p.sets,
          weight: roundToNearest((base1rm * p.percent) / 100, roundingStep),
        }));
        const workingSet = requireValue(
          resolvedPrescriptions[resolvedPrescriptions.length - 1],
          `Missing working set for ${slot.id}`
        );
        return {
          slotId: slot.id,
          exerciseId: slot.exerciseId,
          exerciseName,
          tier: slot.tier,
          weight: workingSet.weight,
          stage: 0,
          sets: workingSet.sets,
          reps: workingSet.reps,
          repsMax: void 0,
          isAmrap: false,
          stagesCount: 1,
          result: slotResult.result,
          amrapReps: void 0,
          rpe: void 0,
          isChanged: false,
          isDeload: false,
          role,
          notes: slot.notes,
          prescriptions: resolvedPrescriptions,
          isGpp: slot.isGpp ?? false,
          complexReps: slot.complexReps,
          propagatesTo: slot.propagatesTo,
          isTestSlot: slot.isTestSlot,
          isBodyweight: slot.isBodyweight,
          setLogs: slotResult.setLogs,
        };
      }
      if (slot.isGpp === true) {
        const gppStage = requireValue(slot.stages[0], `Missing GPP stage for ${slot.id}`);
        return {
          slotId: slot.id,
          exerciseId: slot.exerciseId,
          exerciseName,
          tier: slot.tier,
          weight: 0,
          stage: 0,
          sets: gppStage.sets,
          reps: gppStage.reps,
          repsMax: void 0,
          isAmrap: false,
          stagesCount: 1,
          result: slotResult.result,
          amrapReps: void 0,
          rpe: void 0,
          isChanged: false,
          isDeload: false,
          role,
          notes: slot.notes,
          prescriptions: void 0,
          isGpp: true,
          complexReps: slot.complexReps,
          propagatesTo: slot.propagatesTo,
          isTestSlot: slot.isTestSlot,
          isBodyweight: slot.isBodyweight,
          setLogs: slotResult.setLogs,
        };
      }
      const stageConfig = requireValue(
        slot.stages[state.stage],
        `Missing stage ${state.stage} for ${slot.id}`
      );
      const weight =
        slot.trainingMaxKey !== void 0 && slot.tmPercent !== void 0
          ? roundToNearest((tmState[slot.trainingMaxKey] ?? 0) * slot.tmPercent, roundingStep)
          : state.weight;
      const prevWeight = prevWeightByExerciseId.get(slot.exerciseId);
      const isDeload = prevWeight !== void 0 && weight > 0 && weight < prevWeight;
      if (weight > 0) {
        prevWeightByExerciseId.set(slot.exerciseId, weight);
      }
      const derivedResult = deriveSlotResult(slot, slotResult, stageConfig.reps);
      derivedResultsBySlotId[slot.id] = derivedResult;
      const amrapReps =
        stageConfig.amrap === true && slotResult.setLogs !== void 0 && slotResult.setLogs.length > 0
          ? requireValue(
              slotResult.setLogs[slotResult.setLogs.length - 1],
              `Missing set log for ${slot.id}`
            ).reps
          : slotResult.amrapReps;
      return {
        slotId: slot.id,
        exerciseId: slot.exerciseId,
        exerciseName,
        tier: slot.tier,
        weight,
        stage: state.stage,
        sets: stageConfig.sets,
        reps: stageConfig.reps,
        repsMax: stageConfig.repsMax,
        isAmrap: stageConfig.amrap === true,
        stagesCount: slot.stages.length,
        result: derivedResult,
        amrapReps,
        rpe: slotResult.rpe,
        isChanged: state.everChanged,
        isDeload,
        role,
        notes: slot.notes,
        prescriptions: void 0,
        isGpp: void 0,
        complexReps: void 0,
        propagatesTo: slot.propagatesTo,
        isTestSlot: slot.isTestSlot,
        isBodyweight: slot.isBodyweight,
        setLogs: slotResult.setLogs,
      };
    });
    rows.push({
      index: i,
      dayName: day.name,
      slots,
      isChanged: slots.some((s) => s.isChanged),
      completedAt: void 0,
    });
    for (const slot of day.slots) {
      if (slot.prescriptions !== void 0 || slot.isGpp === true) continue;
      const state = requireValue(slotState[slot.id], `Missing slot state for ${slot.id}`);
      const slotResult = toSlotResult(workoutResult[slot.id]);
      const resultValue = derivedResultsBySlotId[slot.id];
      const increment = definition.weightIncrements[slot.exerciseId] ?? 0;
      applySlotProgression(
        slot,
        state,
        slotResult,
        resultValue,
        increment,
        tmState,
        slotState,
        roundingStep
      );
    }
  }
  return rows;
}

// packages/domain/src/catalog.ts
var PROGRAM_LEVELS = ['beginner', 'intermediate', 'advanced'];

// apps/backend/api/src/lib/catalog-cache.ts
var CACHE_TTL_SECONDS = 300;
var CATALOG_LIST_KEY = 'catalog:list';
async function getCachedCatalogList() {
  const redis = getRedis();
  if (!redis) return void 0;
  try {
    const parsed = await redis.get(CATALOG_LIST_KEY);
    if (parsed === null || parsed === void 0) return void 0;
    if (!Array.isArray(parsed)) {
      logger.warn('catalog-cache: corrupt list entry, evicting');
      await redis.del(CATALOG_LIST_KEY);
      return void 0;
    }
    return parsed;
  } catch (err2) {
    logger.warn({ err: err2 }, 'catalog-cache: list get failed');
    return void 0;
  }
}
async function setCachedCatalogList(entries) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(CATALOG_LIST_KEY, entries, { ex: CACHE_TTL_SECONDS });
  } catch (err2) {
    logger.warn({ err: err2 }, 'catalog-cache: list set failed');
  }
}
function detailKey(programId) {
  return `catalog:detail:${programId}`;
}
function isProgramDefinition(value) {
  return isRecord(value) && typeof value['id'] === 'string' && Array.isArray(value['days']);
}
async function getCachedCatalogDetail(programId) {
  const redis = getRedis();
  if (!redis) return void 0;
  try {
    const parsed = await redis.get(detailKey(programId));
    if (parsed === null || parsed === void 0) return void 0;
    if (!isProgramDefinition(parsed)) {
      logger.warn({ programId }, 'catalog-cache: corrupt detail entry, evicting');
      await redis.del(detailKey(programId));
      return void 0;
    }
    return parsed;
  } catch (err2) {
    logger.warn({ err: err2, programId }, 'catalog-cache: detail get failed');
    return void 0;
  }
}
async function setCachedCatalogDetail(programId, definition) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(detailKey(programId), definition, { ex: CACHE_TTL_SECONDS });
  } catch (err2) {
    logger.warn({ err: err2, programId }, 'catalog-cache: detail set failed');
  }
}

// apps/backend/api/src/lib/singleflight.ts
var SingleflightMap = class {
  constructor() {
    this.flights = /* @__PURE__ */ new Map();
  }
  /**
   * Execute `fn` at most once per `key` concurrently.
   * If a call for the same key is already in flight, returns the existing promise.
   */
  run(key, fn) {
    const existing = this.flights.get(key);
    if (existing) return existing;
    const promise = fn().finally(() => {
      this.flights.delete(key);
    });
    this.flights.set(key, promise);
    return promise;
  }
};

// apps/backend/api/src/services/catalog.ts
var listFlight = new SingleflightMap();
var detailFlight = new SingleflightMap();
var VALID_LEVELS = new Set(PROGRAM_LEVELS);
function isValidLevel(value) {
  return VALID_LEVELS.has(value);
}
function toLevel(value) {
  return isValidLevel(value) ? value : 'intermediate';
}
function toCatalogEntry(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    author: row.author,
    category: row.category,
    level: toLevel(row.level),
    source: row.source,
    totalWorkouts: row.definition.totalWorkouts,
    workoutsPerWeek: row.definition.workoutsPerWeek,
    cycleLength: row.definition.cycleLength,
  };
}
function isCatalogEntryArray(value) {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;
  const first = value[0];
  return isRecord(first) && typeof first['id'] === 'string' && typeof first['name'] === 'string';
}
async function listPrograms() {
  const cached = await getCachedCatalogList();
  if (cached && isCatalogEntryArray(cached)) {
    return cached;
  }
  return listFlight.run('catalog:list', async () => {
    const rechecked = await getCachedCatalogList();
    if (rechecked && isCatalogEntryArray(rechecked)) return rechecked;
    const rows = await getDb()
      .select({
        id: programTemplates.id,
        name: programTemplates.name,
        description: programTemplates.description,
        author: programTemplates.author,
        category: programTemplates.category,
        level: programTemplates.level,
        source: programTemplates.source,
        definition: sql3`jsonb_build_object(
          'totalWorkouts', (${programTemplates.definition}->>'totalWorkouts')::int,
          'workoutsPerWeek', (${programTemplates.definition}->>'workoutsPerWeek')::int,
          'cycleLength', (${programTemplates.definition}->>'cycleLength')::int
        )`,
      })
      .from(programTemplates)
      .where(eq2(programTemplates.isActive, true))
      .orderBy(asc(programTemplates.name));
    const entries = rows.map(toCatalogEntry);
    void setCachedCatalogList(entries);
    return entries;
  });
}
async function hydrateStoredProgramDefinition(programId, includeInactive) {
  const visibility = includeInactive
    ? eq2(programTemplates.id, programId)
    : and2(eq2(programTemplates.id, programId), eq2(programTemplates.isActive, true));
  const [template] = await getDb().select().from(programTemplates).where(visibility).limit(1);
  if (!template) return { status: 'not_found' };
  const exerciseIds = [...collectExerciseIds(template.definition)];
  const exerciseRows =
    exerciseIds.length > 0
      ? await getDb()
          .select({ id: exercises.id, name: exercises.name })
          .from(exercises)
          .where(inArray(exercises.id, exerciseIds))
      : [];
  const result = hydrateProgramDefinition(
    {
      id: template.id,
      name: template.name,
      description: template.description,
      author: template.author,
      version: template.version,
      category: template.category,
      source: template.source,
      definition: template.definition,
    },
    exerciseRows
  );
  if (!result.ok) {
    logger.error({ programId, error: result.error }, 'catalog: hydration failed');
    return { status: 'hydration_failed', error: result.error };
  }
  return { status: 'found', definition: result.value };
}
async function getProgramDefinition(programId) {
  const cached = await getCachedCatalogDetail(programId);
  if (cached) return { status: 'found', definition: cached };
  return detailFlight.run(programId, async () => {
    const rechecked = await getCachedCatalogDetail(programId);
    if (rechecked) return { status: 'found', definition: rechecked };
    const result = await hydrateStoredProgramDefinition(programId, false);
    if (result.status === 'found') void setCachedCatalogDetail(programId, result.definition);
    return result;
  });
}
function getHistoricalProgramDefinition(programId) {
  return hydrateStoredProgramDefinition(programId, true);
}
var MAX_PREVIEW_ROWS = 10;
function previewDefinition(definition, config) {
  const resolvedConfig = {};
  for (const field of definition.configFields) {
    if (field.type === 'weight') {
      resolvedConfig[field.key] = config?.[field.key] ?? 0;
    } else if (field.type === 'select') {
      resolvedConfig[field.key] = config?.[field.key] ?? field.options[0].value;
    }
  }
  try {
    const allRows = computeGenericProgram(
      definition,
      resolvedConfig,
      {},
      { maxRows: MAX_PREVIEW_ROWS }
    );
    return allRows.slice(0, MAX_PREVIEW_ROWS);
  } catch (e) {
    logger.error({ event: 'catalog.preview.engine_error', error: e }, 'preview engine error');
    throw new ApiError(500, 'Preview computation failed', 'INTERNAL_ERROR');
  }
}

// packages/domain/src/schemas/instance.ts
import { z as z2 } from 'zod/v4';
var ResultValueSchema = z2.enum(['success', 'fail']);
var SetLogEntrySchema = z2.strictObject({
  reps: z2.number().int().min(0).max(999),
  weight: z2.number().nonnegative().optional(),
  rpe: z2.number().int().min(1).max(10).optional(),
});
var SlotResultSchema = z2.strictObject({
  result: ResultValueSchema.optional(),
  amrapReps: z2.number().int().min(0).max(999).optional(),
  rpe: z2.number().int().min(1).max(10).optional(),
  setLogs: z2.array(SetLogEntrySchema).optional(),
});
var GenericWorkoutResultSchema = z2.record(z2.string(), SlotResultSchema);
var GenericResultsSchema = z2.record(z2.string().regex(/^\d{1,3}$/), GenericWorkoutResultSchema);
var GenericUndoEntrySchema = z2.strictObject({
  i: z2.number().int().min(0),
  slotId: z2.string().min(1),
  prev: ResultValueSchema.optional(),
  prevRpe: z2.number().int().min(1).max(10).optional(),
  prevAmrapReps: z2.number().int().min(0).optional(),
  prevSetLogs: z2.array(SetLogEntrySchema).optional(),
});
var GenericUndoHistorySchema = z2.array(GenericUndoEntrySchema);
var ProgramInstanceStatusSchema = z2.enum(['active', 'completed', 'archived']);
var MAX_PROGRAM_CONFIG_KEYS = 100;
var ProgramConfigSchema = z2
  .record(z2.string(), z2.union([z2.number(), z2.string()]))
  .refine((cfg) => Object.keys(cfg).length <= MAX_PROGRAM_CONFIG_KEYS, {
    message: `config must have at most ${MAX_PROGRAM_CONFIG_KEYS} keys`,
  });
var ProgramInstanceSchema = z2.strictObject({
  id: z2.string().min(1),
  programId: z2.string().min(1),
  name: z2.string().min(1),
  config: ProgramConfigSchema,
  results: GenericResultsSchema,
  undoHistory: GenericUndoHistorySchema,
  status: ProgramInstanceStatusSchema,
  createdAt: z2.string(),
  updatedAt: z2.string(),
});
var ProgramInstanceMapSchema = z2.strictObject({
  version: z2.number().int().positive(),
  activeProgramId: z2.string().nullable(),
  instances: z2.record(z2.string(), ProgramInstanceSchema),
});
var GenericProgramDetailSchema = z2.object({
  id: z2.string(),
  programId: z2.string(),
  name: z2.string(),
  config: z2.record(z2.string(), z2.union([z2.number(), z2.string()])).catch({}),
  metadata: z2.unknown(),
  results: GenericResultsSchema.catch({}),
  undoHistory: GenericUndoHistorySchema.catch([]),
  resultTimestamps: z2.record(z2.string(), z2.string()).catch({}),
  completedDates: z2.record(z2.string(), z2.string()).catch({}),
  definitionId: z2.string().nullable().catch(null),
  customDefinition: z2.unknown(),
  status: z2.string(),
  createdAt: z2.string(),
  updatedAt: z2.string(),
});

// apps/backend/api/src/lib/data-limits.ts
var USER_DATA_LIMITS = {
  programInstances: 100,
  workoutResults: 2e4,
  undoEntries: 5e3,
  customExercises: 250,
  jsonBytes: 25 * 1024 * 1024,
};
var MAX_IMPORT_ROWS = 2e3;
var MAX_IMPORT_UNDO_ENTRIES = 50;
var MAX_IMPORT_JSON_BYTES = 750 * 1024;
var MAX_ANALYTICS_RECORDS_PER_USER = 1e4;

// apps/backend/api/src/services/data-quotas.ts
import { and as and3, count, eq as eq3, sql as sql4 } from 'drizzle-orm';
async function lockUserForDataMutation(tx, userId) {
  const [user] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq3(users.id, userId))
    .for('update')
    .limit(1);
  if (!user) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
}
function findExceededQuota(usage) {
  const keys = [
    'programInstances',
    'workoutResults',
    'undoEntries',
    'customExercises',
    'jsonBytes',
  ];
  return keys.find((key) => usage[key] > USER_DATA_LIMITS[key]);
}
async function getUserDataUsage(tx, userId) {
  const [instancesResult, resultsResult, undoResult, exerciseResult, definitionsResult] =
    await Promise.all([
      tx
        .select({
          rows: sql4`count(*)::int`,
          jsonBytes: sql4`coalesce(sum(
            octet_length(${programInstances.programConfig}::text) +
            octet_length(coalesce(${programInstances.metadata}::text, '')) +
            octet_length(coalesce(${programInstances.customDefinition}::text, ''))
          ), 0)::int`,
        })
        .from(programInstances)
        .where(eq3(programInstances.userId, userId)),
      tx
        .select({
          rows: sql4`count(*)::int`,
          jsonBytes: sql4`coalesce(sum(octet_length(coalesce(${workoutResults.setLogs}::text, ''))), 0)::int`,
        })
        .from(workoutResults)
        .innerJoin(programInstances, eq3(programInstances.id, workoutResults.instanceId))
        .where(eq3(programInstances.userId, userId)),
      tx
        .select({
          rows: sql4`count(*)::int`,
          jsonBytes: sql4`coalesce(sum(octet_length(coalesce(${undoEntries.previousSetLogs}::text, ''))), 0)::int`,
        })
        .from(undoEntries)
        .innerJoin(programInstances, eq3(programInstances.id, undoEntries.instanceId))
        .where(eq3(programInstances.userId, userId)),
      tx
        .select({ rows: count() })
        .from(exercises)
        .where(and3(eq3(exercises.createdByUserId, userId), eq3(exercises.isSystem, false))),
      tx
        .select({
          jsonBytes: sql4`coalesce(sum(octet_length(${programDefinitions.definition}::text)), 0)::int`,
        })
        .from(programDefinitions)
        .where(eq3(programDefinitions.userId, userId)),
    ]);
  const instances = instancesResult[0];
  const results = resultsResult[0];
  const undo = undoResult[0];
  const customExercises = exerciseResult[0];
  const definitions = definitionsResult[0];
  return {
    programInstances: instances?.rows ?? 0,
    workoutResults: results?.rows ?? 0,
    undoEntries: undo?.rows ?? 0,
    customExercises: customExercises?.rows ?? 0,
    jsonBytes:
      (instances?.jsonBytes ?? 0) +
      (results?.jsonBytes ?? 0) +
      (undo?.jsonBytes ?? 0) +
      (definitions?.jsonBytes ?? 0),
  };
}
async function assertUserDataQuotas(tx, userId) {
  const usage = await getUserDataUsage(tx, userId);
  const exceeded = findExceededQuota(usage);
  if (!exceeded) return;
  throw new ApiError(409, 'Account data quota exceeded', 'DATA_QUOTA_EXCEEDED', {
    details: {
      resource: exceeded,
      limit: USER_DATA_LIMITS[exceeded],
    },
  });
}

// apps/backend/api/src/services/programs.ts
var MAX_AMRAP_REPS = 99;
var MAX_SET_LOG_ITEMS = 20;
var MAX_SET_LOG_WEIGHT = 1e4;
var MAX_METADATA_BYTES = 1e4;
async function lockUserForActiveProgramMutation(tx, userId) {
  await lockUserForDataMutation(tx, userId);
}
function buildResultTimestamps(rows) {
  const timestamps = {};
  for (const row of rows) {
    const key = String(row.workoutIndex);
    const ts = row.createdAt.toISOString();
    if (!timestamps[key] || ts < timestamps[key]) {
      timestamps[key] = ts;
    }
  }
  return timestamps;
}
function isSetLogsArray(value) {
  return Array.isArray(value) && value.every((v) => typeof v === 'object' && v !== null);
}
function buildGenericResults(rows) {
  const results = {};
  for (const row of rows) {
    const indexStr = String(row.workoutIndex);
    if (!results[indexStr]) {
      results[indexStr] = {};
    }
    const setLogs = isSetLogsArray(row.setLogs) ? row.setLogs : void 0;
    results[indexStr][row.slotId] = {
      result: row.result,
      ...(row.amrapReps !== null ? { amrapReps: row.amrapReps } : {}),
      ...(row.rpe !== null ? { rpe: row.rpe } : {}),
      ...(setLogs !== void 0 ? { setLogs } : {}),
    };
  }
  return results;
}
function buildUndoHistory(rows) {
  return rows.map((row) => {
    const previousSetLogs = isSetLogsArray(row.previousSetLogs) ? row.previousSetLogs : void 0;
    return {
      i: row.workoutIndex,
      slotId: row.slotId,
      ...(row.previousResult !== null ? { prev: row.previousResult } : {}),
      ...(row.previousRpe !== null ? { prevRpe: row.previousRpe } : {}),
      ...(row.previousAmrapReps !== null ? { prevAmrapReps: row.previousAmrapReps } : {}),
      ...(previousSetLogs !== void 0 ? { prevSetLogs: previousSetLogs } : {}),
    };
  });
}
function buildCompletedDates(rows) {
  const dates = {};
  for (const row of rows) {
    if (row.completedAt === null) continue;
    const key = String(row.workoutIndex);
    if (!dates[key]) {
      dates[key] = row.completedAt.toISOString();
    }
  }
  return dates;
}
function toResponse(instance, resultRows, undoRows) {
  return {
    id: instance.id,
    programId: instance.templateId,
    name: instance.name,
    config: instance.programConfig,
    metadata: instance.metadata ?? null,
    status: instance.status,
    results: buildGenericResults(resultRows),
    undoHistory: buildUndoHistory(undoRows),
    resultTimestamps: buildResultTimestamps(resultRows),
    completedDates: buildCompletedDates(resultRows),
    definitionId: instance.definitionId ?? null,
    customDefinition: instance.customDefinition ?? null,
    createdAt: instance.createdAt.toISOString(),
    updatedAt: instance.updatedAt.toISOString(),
  };
}
async function fetchResultsAndUndo(instanceId) {
  return Promise.all([
    getDb()
      .select({
        workoutIndex: workoutResults.workoutIndex,
        slotId: workoutResults.slotId,
        result: workoutResults.result,
        amrapReps: workoutResults.amrapReps,
        rpe: workoutResults.rpe,
        setLogs: workoutResults.setLogs,
        completedAt: workoutResults.completedAt,
        createdAt: workoutResults.createdAt,
      })
      .from(workoutResults)
      .where(eq4(workoutResults.instanceId, instanceId)),
    getDb()
      .select({
        workoutIndex: undoEntries.workoutIndex,
        slotId: undoEntries.slotId,
        previousResult: undoEntries.previousResult,
        previousAmrapReps: undoEntries.previousAmrapReps,
        previousRpe: undoEntries.previousRpe,
        previousSetLogs: undoEntries.previousSetLogs,
      })
      .from(undoEntries)
      .where(eq4(undoEntries.instanceId, instanceId))
      .orderBy(undoEntries.id),
  ]);
}
async function createInstance(userId, programId, name, config) {
  const [template] = await getDb()
    .select({ id: programTemplates.id })
    .from(programTemplates)
    .where(and4(eq4(programTemplates.id, programId), eq4(programTemplates.isActive, true)))
    .limit(1);
  if (!template) {
    throw new ApiError(400, `Unknown program: ${programId}`, 'INVALID_PROGRAM');
  }
  const instance = await getDb().transaction(async (tx) => {
    await lockUserForActiveProgramMutation(tx, userId);
    await tx
      .update(programInstances)
      .set({ status: 'completed' })
      .where(and4(eq4(programInstances.userId, userId), eq4(programInstances.status, 'active')));
    const [created] = await tx
      .insert(programInstances)
      .values({
        userId,
        templateId: programId,
        name,
        programConfig: config,
        status: 'active',
      })
      .returning();
    await assertUserDataQuotas(tx, userId);
    return created;
  });
  if (!instance) {
    throw new ApiError(500, 'Failed to create program instance', 'CREATE_FAILED');
  }
  return toResponse(instance, [], []);
}
function parseCursor(cursor) {
  const separatorIndex = cursor.lastIndexOf('_');
  if (separatorIndex === -1) return void 0;
  const tsStr = cursor.substring(0, separatorIndex);
  const id = cursor.substring(separatorIndex + 1);
  const ts = new Date(tsStr);
  if (isNaN(ts.getTime())) return void 0;
  if (id.length === 0) return void 0;
  return { ts, id };
}
async function getInstances(userId, options = {}) {
  const limit = Math.min(options.limit ?? 20, 100);
  let conditions = eq4(programInstances.userId, userId);
  if (options.cursor) {
    const parsed = parseCursor(options.cursor);
    if (!parsed) {
      throw new ApiError(400, 'Invalid cursor format', 'INVALID_CURSOR');
    }
    conditions = and4(
      eq4(programInstances.userId, userId),
      or(
        lt2(programInstances.createdAt, parsed.ts),
        and4(eq4(programInstances.createdAt, parsed.ts), gt(programInstances.id, parsed.id))
      )
    );
  }
  const rows = await getDb()
    .select({
      id: programInstances.id,
      templateId: programInstances.templateId,
      name: programInstances.name,
      status: programInstances.status,
      createdAt: programInstances.createdAt,
      updatedAt: programInstances.updatedAt,
    })
    .from(programInstances)
    .where(conditions)
    .orderBy(desc2(programInstances.createdAt), asc2(programInstances.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = page[page.length - 1];
  const nextCursor = hasMore && lastRow ? `${lastRow.createdAt.toISOString()}_${lastRow.id}` : null;
  return {
    data: page.map((i) => ({
      id: i.id,
      programId: i.templateId,
      name: i.name,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    })),
    nextCursor,
  };
}
async function getInstance(userId, instanceId) {
  const [instance] = await getDb()
    .select({
      id: programInstances.id,
      userId: programInstances.userId,
      templateId: programInstances.templateId,
      definitionId: programInstances.definitionId,
      customDefinition: programInstances.customDefinition,
      name: programInstances.name,
      programConfig: programInstances.programConfig,
      metadata: programInstances.metadata,
      status: programInstances.status,
      createdAt: programInstances.createdAt,
      updatedAt: programInstances.updatedAt,
    })
    .from(programInstances)
    .where(and4(eq4(programInstances.id, instanceId), eq4(programInstances.userId, userId)))
    .limit(1);
  if (!instance) {
    throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
  }
  const [resultRows, undoRows] = await fetchResultsAndUndo(instanceId);
  return toResponse(instance, resultRows, undoRows);
}
async function updateInstance(userId, instanceId, updates) {
  const updateValues = { updatedAt: /* @__PURE__ */ new Date() };
  if (updates.name !== void 0) updateValues.name = updates.name;
  if (updates.status !== void 0) updateValues.status = updates.status;
  if (updates.config !== void 0) updateValues.programConfig = updates.config;
  const updated = await getDb().transaction(async (tx) => {
    await lockUserForDataMutation(tx, userId);
    const [row] = await tx
      .update(programInstances)
      .set(updateValues)
      .where(and4(eq4(programInstances.id, instanceId), eq4(programInstances.userId, userId)))
      .returning();
    if (!row) throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
    await assertUserDataQuotas(tx, userId);
    return row;
  });
  const [resultRows, undoRows] = await fetchResultsAndUndo(instanceId);
  return toResponse(updated, resultRows, undoRows);
}
async function updateInstanceMetadata(userId, instanceId, metadata) {
  const serialized = JSON.stringify(metadata);
  if (serialized.length > MAX_METADATA_BYTES) {
    throw new ApiError(400, 'Metadata exceeds 10KB limit', 'METADATA_TOO_LARGE');
  }
  const mergedMetadata = sql5`COALESCE(${programInstances.metadata}, '{}'::jsonb) || ${metadata}::jsonb`;
  const updated = await getDb().transaction(async (tx) => {
    await lockUserForDataMutation(tx, userId);
    const [row] = await tx
      .update(programInstances)
      .set({ metadata: mergedMetadata, updatedAt: /* @__PURE__ */ new Date() })
      .where(
        and4(
          eq4(programInstances.id, instanceId),
          eq4(programInstances.userId, userId),
          sql5`length((${mergedMetadata})::text) <= ${MAX_METADATA_BYTES}`
        )
      )
      .returning();
    if (!row) {
      const [existing] = await tx
        .select({ id: programInstances.id })
        .from(programInstances)
        .where(and4(eq4(programInstances.id, instanceId), eq4(programInstances.userId, userId)))
        .limit(1);
      if (existing) throw new ApiError(400, 'Metadata exceeds 10KB limit', 'METADATA_TOO_LARGE');
      throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
    }
    await assertUserDataQuotas(tx, userId);
    return row;
  });
  const [resultRows, undoRows] = await fetchResultsAndUndo(instanceId);
  return toResponse(updated, resultRows, undoRows);
}
async function deleteInstance(userId, instanceId) {
  await getDb().transaction(async (tx) => {
    await lockUserForDataMutation(tx, userId);
    const deleted = await tx
      .delete(programInstances)
      .where(and4(eq4(programInstances.id, instanceId), eq4(programInstances.userId, userId)))
      .returning({ id: programInstances.id });
    if (deleted.length === 0) {
      throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
    }
  });
}
function assertSetLogEntriesValid(setLogs, fieldName) {
  if (setLogs === void 0) return;
  if (setLogs.length > MAX_SET_LOG_ITEMS) {
    throw new ApiError(
      400,
      `${fieldName} cannot exceed ${MAX_SET_LOG_ITEMS} entries`,
      'INVALID_DATA'
    );
  }
  for (const setLog of setLogs) {
    const parsed = SetLogEntrySchema.safeParse(setLog);
    if (!parsed.success) {
      throw new ApiError(400, `Invalid ${fieldName} entry`, 'INVALID_DATA');
    }
    if (parsed.data.weight !== void 0 && parsed.data.weight > MAX_SET_LOG_WEIGHT) {
      throw new ApiError(
        400,
        `${fieldName}.weight cannot exceed ${MAX_SET_LOG_WEIGHT}`,
        'INVALID_DATA'
      );
    }
  }
}
async function exportInstance(userId, instanceId) {
  const instance = await getInstance(userId, instanceId);
  return {
    version: 1,
    exportDate: /* @__PURE__ */ new Date().toISOString(),
    programId: instance.programId,
    name: instance.name,
    config: instance.config,
    results: instance.results,
    undoHistory: instance.undoHistory,
    completedDates: instance.completedDates,
  };
}
function assertImportAggregateLimits(data) {
  let resultRows = 0;
  for (const slots of Object.values(data.results)) {
    for (const result of Object.values(slots)) {
      if (result.result !== void 0) resultRows += 1;
    }
  }
  const totalRows = resultRows + data.undoHistory.length;
  if (data.undoHistory.length > MAX_IMPORT_UNDO_ENTRIES || totalRows > MAX_IMPORT_ROWS) {
    throw new ApiError(413, 'Import contains too many rows', 'IMPORT_TOO_LARGE');
  }
  const jsonBytes = new TextEncoder().encode(JSON.stringify(data)).byteLength;
  if (jsonBytes > MAX_IMPORT_JSON_BYTES) {
    throw new ApiError(413, 'Import payload is too large', 'IMPORT_TOO_LARGE');
  }
}
async function importInstance(userId, data) {
  assertImportAggregateLimits(data);
  const defResult = await getProgramDefinition(data.programId);
  if (defResult.status === 'not_found') {
    throw new ApiError(400, `Unknown program: ${data.programId}`, 'INVALID_PROGRAM');
  }
  if (defResult.status === 'hydration_failed') {
    throw new ApiError(500, 'Program definition hydration failed', 'HYDRATION_FAILED');
  }
  const definition = defResult.definition;
  const configResult = ProgramInstanceSchema.shape.config.safeParse(data.config);
  if (!configResult.success) {
    throw new ApiError(400, 'Invalid config format', 'INVALID_DATA');
  }
  const config = configResult.data;
  const maxWorkoutIndex = definition.totalWorkouts - 1;
  const cycleLength = definition.days.length;
  const completedDates = data.completedDates ?? {};
  const completedDatesByWorkout = /* @__PURE__ */ new Map();
  for (const [indexStr, completedDate] of Object.entries(completedDates)) {
    const idx = Number(indexStr);
    if (
      !Number.isInteger(idx) ||
      idx < 0 ||
      idx > maxWorkoutIndex ||
      !Number.isFinite(Date.parse(completedDate)) ||
      completedDatesByWorkout.has(idx)
    ) {
      throw new ApiError(400, `Invalid completion date for workout ${indexStr}`, 'INVALID_DATA');
    }
    completedDatesByWorkout.set(idx, completedDate);
  }
  for (const [indexStr, slots] of Object.entries(data.results)) {
    const idx = Number(indexStr);
    if (!Number.isInteger(idx) || idx < 0 || idx > maxWorkoutIndex) {
      throw new ApiError(400, `Invalid workoutIndex: ${indexStr}`, 'INVALID_DATA');
    }
    const day = definition.days[idx % cycleLength];
    const validSlotIds = new Set(day.slots.map((slot) => slot.id));
    for (const [slotId, slotData] of Object.entries(slots)) {
      if (!validSlotIds.has(slotId)) {
        throw new ApiError(
          400,
          `Unknown slotId for workout ${indexStr}: ${slotId}`,
          'INVALID_DATA'
        );
      }
      if (slotData.amrapReps !== void 0 && slotData.amrapReps > MAX_AMRAP_REPS) {
        throw new ApiError(400, `amrapReps cannot exceed ${MAX_AMRAP_REPS}`, 'INVALID_DATA');
      }
      assertSetLogEntriesValid(slotData.setLogs, 'setLogs');
    }
  }
  const undoHistoryResult = GenericUndoHistorySchema.safeParse(data.undoHistory);
  if (!undoHistoryResult.success) {
    throw new ApiError(400, 'Invalid undoHistory format', 'INVALID_DATA');
  }
  for (const entry of undoHistoryResult.data) {
    if (entry.i < 0 || entry.i > maxWorkoutIndex) {
      throw new ApiError(400, `Invalid undo workoutIndex: ${entry.i}`, 'INVALID_DATA');
    }
    const day = definition.days[entry.i % cycleLength];
    const validSlotIds = new Set(day.slots.map((slot) => slot.id));
    if (!validSlotIds.has(entry.slotId)) {
      throw new ApiError(
        400,
        `Unknown undo slotId for workout ${entry.i}: ${entry.slotId}`,
        'INVALID_DATA'
      );
    }
    if (entry.prevAmrapReps !== void 0 && entry.prevAmrapReps > MAX_AMRAP_REPS) {
      throw new ApiError(400, `prevAmrapReps cannot exceed ${MAX_AMRAP_REPS}`, 'INVALID_DATA');
    }
    assertSetLogEntriesValid(entry.prevSetLogs, 'prevSetLogs');
  }
  const instanceId = await getDb().transaction(async (tx) => {
    await lockUserForActiveProgramMutation(tx, userId);
    await tx
      .update(programInstances)
      .set({ status: 'completed' })
      .where(and4(eq4(programInstances.userId, userId), eq4(programInstances.status, 'active')));
    const [instance] = await tx
      .insert(programInstances)
      .values({
        userId,
        templateId: data.programId,
        name: data.name,
        programConfig: config,
        status: 'active',
      })
      .returning();
    if (!instance) {
      throw new ApiError(500, 'Failed to create imported instance', 'IMPORT_FAILED');
    }
    const resultValues = [];
    for (const [indexStr, slots] of Object.entries(data.results)) {
      const workoutIndex = Number(indexStr);
      const day = definition.days[workoutIndex % cycleLength];
      const completedAt = day.slots.every((slot) => slots[slot.id]?.result !== void 0)
        ? new Date(completedDatesByWorkout.get(workoutIndex) ?? data.exportDate)
        : null;
      for (const [slotId, slotResult] of Object.entries(slots)) {
        if (!slotResult.result) continue;
        const slotDefinition = day.slots.find((slot) => slot.id === slotId);
        if (!slotDefinition) {
          throw new ApiError(400, `Unknown slotId: ${slotId}`, 'INVALID_DATA');
        }
        resultValues.push({
          instanceId: instance.id,
          workoutIndex,
          slotId,
          result: slotResult.result,
          amrapReps: slotResult.amrapReps ?? null,
          rpe: slotResult.rpe ?? null,
          setLogs: slotResult.setLogs ?? null,
          completedAt,
          exerciseId: slotDefinition.exerciseId,
          definitionVersion: definition.version,
        });
      }
    }
    if (resultValues.length > 0) {
      await tx.insert(workoutResults).values(resultValues);
    }
    if (data.undoHistory.length > 0) {
      const undoValues = data.undoHistory.map((entry) => ({
        instanceId: instance.id,
        workoutIndex: entry.i,
        slotId: entry.slotId,
        previousResult: entry.prev ?? null,
        previousRpe: entry.prevRpe ?? null,
        previousAmrapReps: entry.prevAmrapReps ?? null,
        previousSetLogs: entry.prevSetLogs ?? null,
        previousExerciseId:
          definition.days[entry.i % cycleLength]?.slots.find((slot) => slot.id === entry.slotId)
            ?.exerciseId ?? null,
        previousDefinitionVersion: definition.version,
      }));
      await tx.insert(undoEntries).values(undoValues);
    }
    await assertUserDataQuotas(tx, userId);
    return instance.id;
  });
  return getInstance(userId, instanceId);
}

// apps/backend/api/src/lib/program-cache.ts
var CACHE_TTL_SECONDS2 = 300;
function isProgramInstanceResponse(value) {
  return isRecord(value) && typeof value['id'] === 'string';
}
function generationKey(userId, instanceId) {
  return `program-generation:${userId}:${instanceId}`;
}
function cacheKey(userId, instanceId, generation) {
  return `program:${userId}:${instanceId}:g${generation}`;
}
async function getProgramCacheGeneration(userId, instanceId) {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    const value = await redis.get(generationKey(userId, instanceId));
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch (err2) {
    logger.warn({ err: err2, userId, instanceId }, 'program-cache: generation get failed');
    return 0;
  }
}
async function getAtGeneration(userId, instanceId, generation) {
  const redis = getRedis();
  if (!redis) return void 0;
  const key = cacheKey(userId, instanceId, generation);
  try {
    const parsed = await redis.get(key);
    if (parsed === null || parsed === void 0) return void 0;
    if (!isProgramInstanceResponse(parsed)) {
      logger.warn({ userId, instanceId, generation }, 'program-cache: corrupt entry, evicting');
      await redis.del(key);
      return void 0;
    }
    return parsed;
  } catch (err2) {
    logger.warn({ err: err2, userId, instanceId, generation }, 'program-cache: get failed');
    return void 0;
  }
}
async function getProgramCacheSnapshot(userId, instanceId) {
  const generation = await getProgramCacheGeneration(userId, instanceId);
  return { generation, value: await getAtGeneration(userId, instanceId, generation) };
}
async function setCachedInstance(userId, instanceId, response, generation) {
  const redis = getRedis();
  if (!redis) return;
  const targetGeneration = generation ?? (await getProgramCacheGeneration(userId, instanceId));
  try {
    await redis.set(cacheKey(userId, instanceId, targetGeneration), response, {
      ex: CACHE_TTL_SECONDS2,
    });
  } catch (err2) {
    logger.warn({ err: err2, userId, instanceId, targetGeneration }, 'program-cache: set failed');
  }
}
async function invalidateCachedInstance(userId, instanceId) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.incr(generationKey(userId, instanceId));
  } catch (err2) {
    logger.warn({ err: err2, userId, instanceId }, 'program-cache: invalidate failed');
  }
}

// apps/backend/api/src/routes/programs.ts
var instanceFlight = new SingleflightMap();
var MAX_PROGRAM_CURSOR_CHARS = 256;
var MAX_PROGRAM_ID_CHARS = 50;
var MAX_SLOT_ID_CHARS = 50;
var MAX_WORKOUT_INDEX_KEY_CHARS = 3;
var MAX_AMRAP_REPS2 = 99;
var MAX_SET_LOG_WEIGHT2 = 1e4;
var MAX_SET_LOG_ITEMS2 = 20;
var PROGRAM_ID_PATTERN = '^[a-z0-9-]+$';
var WORKOUT_INDEX_KEY_PATTERN = '^\\d{1,3}$';
var WORKOUT_INDEX_KEY_REGEX = /^\d{1,3}$/;
var MUTATION_RATE_LIMIT = { failClosed: true };
var IMPORT_REQUEST_RATE_LIMIT = { maxRequests: 5, windowMs: 6e4, failClosed: true };
var IMPORT_HOURLY_ROW_BUDGET = 1e4;
var IMPORT_DAILY_KIB_BUDGET = 10 * 1024;
var programConfigSchema = t2.Record(
  t2.String({ maxLength: 30 }),
  t2.Union([t2.Number({ minimum: 0, maximum: 1e4 }), t2.String({ maxLength: 100 })]),
  { maxProperties: MAX_PROGRAM_CONFIG_KEYS }
);
var programIdSchema = t2.String({
  minLength: 1,
  maxLength: MAX_PROGRAM_ID_CHARS,
  pattern: PROGRAM_ID_PATTERN,
});
var slotIdSchema = t2.String({ minLength: 1, maxLength: MAX_SLOT_ID_CHARS });
var workoutIndexKeySchema = t2.String({
  minLength: 1,
  maxLength: MAX_WORKOUT_INDEX_KEY_CHARS,
  pattern: WORKOUT_INDEX_KEY_PATTERN,
});
var setLogsSchema = t2.Array(
  t2.Object({
    reps: t2.Integer({ minimum: 0, maximum: 999 }),
    weight: t2.Optional(t2.Number({ minimum: 0, maximum: MAX_SET_LOG_WEIGHT2 })),
    rpe: t2.Optional(t2.Integer({ minimum: 1, maximum: 10 })),
  }),
  { maxItems: MAX_SET_LOG_ITEMS2 }
);
var security = [{ bearerAuth: [] }];
function getImportRateLimitCosts(data) {
  let rows = data.undoHistory.length;
  for (const slots of Object.values(data.results)) {
    for (const result of Object.values(slots)) {
      if (result.result !== void 0) rows += 1;
    }
  }
  return {
    rows: Math.max(1, rows),
    kib: Math.max(1, Math.ceil(new TextEncoder().encode(JSON.stringify(data)).byteLength / 1024)),
  };
}
async function applyImportRateLimits(userId, body) {
  const cost = getImportRateLimitCosts(body);
  await Promise.all([
    rateLimit(userId, 'POST /programs/import', IMPORT_REQUEST_RATE_LIMIT),
    rateLimit(userId, 'POST /programs/import:rows-hourly', {
      windowMs: 60 * 6e4,
      maxRequests: IMPORT_HOURLY_ROW_BUDGET,
      cost: cost.rows,
      failClosed: true,
    }),
    rateLimit(userId, 'POST /programs/import:bytes-daily', {
      windowMs: 24 * 60 * 6e4,
      maxRequests: IMPORT_DAILY_KIB_BUDGET,
      cost: cost.kib,
      failClosed: true,
    }),
  ]);
}
function assertImportPayloadKeysInBounds(data) {
  for (const [workoutIndex, slots] of Object.entries(data.results)) {
    if (
      workoutIndex.length > MAX_WORKOUT_INDEX_KEY_CHARS ||
      !WORKOUT_INDEX_KEY_REGEX.test(workoutIndex)
    ) {
      throw new ApiError(400, 'Invalid import result workout index', 'INVALID_DATA');
    }
    for (const slotId of Object.keys(slots)) {
      if (slotId.length < 1 || slotId.length > MAX_SLOT_ID_CHARS) {
        throw new ApiError(400, 'Invalid import result slotId', 'INVALID_DATA');
      }
    }
  }
  for (const entry of data.undoHistory) {
    if (entry.slotId.length < 1 || entry.slotId.length > MAX_SLOT_ID_CHARS) {
      throw new ApiError(400, 'Invalid import undo slotId', 'INVALID_DATA');
    }
  }
}
var programRoutes = new Elysia5({ prefix: '/programs' })
  .use(requestLogger)
  .use(jwtPlugin)
  .resolve(resolveUserId)
  .get(
    '/',
    async ({ userId, query }) => {
      await rateLimit(userId, 'GET /programs', { maxRequests: 100 });
      return getInstances(userId, { limit: query.limit, cursor: query.cursor });
    },
    {
      query: t2.Object({
        limit: t2.Optional(t2.Numeric({ minimum: 1, maximum: 100 })),
        cursor: t2.Optional(t2.String({ maxLength: MAX_PROGRAM_CURSOR_CHARS })),
      }),
      detail: {
        tags: ['Programs'],
        summary: 'List program instances',
        description:
          "Returns the authenticated user's program instances, newest first. Supports cursor-based pagination via the `cursor` query parameter (ISO timestamp from `nextCursor` in the previous response).",
        security,
        responses: {
          200: { description: 'Paginated list of program instances with nextCursor' },
          401: { description: 'Missing or invalid token' },
        },
      },
    }
  )
  .post(
    '/',
    async ({ userId, body, set, reqLogger }) => {
      reqLogger.info({ event: 'program.create', userId }, 'creating program instance');
      await rateLimit(userId, 'POST /programs', MUTATION_RATE_LIMIT);
      const instance = await createInstance(userId, body.programId, body.name, body.config);
      set.status = 201;
      return instance;
    },
    {
      body: t2.Object({
        programId: programIdSchema,
        name: t2.String({ minLength: 1, maxLength: 100 }),
        config: programConfigSchema,
      }),
      detail: {
        tags: ['Programs'],
        summary: 'Create a program instance',
        description:
          'Creates a new program instance for the authenticated user from the catalog. `config` holds the starting weights keyed by exercise ID.',
        security,
        responses: {
          201: { description: 'Program instance created' },
          400: { description: 'Unknown programId or invalid config' },
          401: { description: 'Missing or invalid token' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )
  .get(
    '/:id',
    async ({ userId, params }) => {
      await rateLimit(userId, 'GET /programs/:id', { maxRequests: 100 });
      const snapshot = await getProgramCacheSnapshot(userId, params.id);
      if (snapshot.value) return snapshot.value;
      return instanceFlight.run(`${userId}:${params.id}:g${snapshot.generation}`, async () => {
        const rechecked = await getProgramCacheSnapshot(userId, params.id);
        if (rechecked.value) return rechecked.value;
        const fresh = await getInstance(userId, params.id);
        await setCachedInstance(userId, params.id, fresh, rechecked.generation);
        return fresh;
      });
    },
    {
      params: t2.Object({
        id: t2.String({
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        }),
      }),
      detail: {
        tags: ['Programs'],
        summary: 'Get program instance',
        description:
          'Returns a single program instance including all recorded workout results and undo history.',
        security,
        responses: {
          200: { description: 'Program instance with results and undo history' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Program not found or not owned by user' },
        },
      },
    }
  )
  .patch(
    '/:id',
    async ({ userId, params, body, reqLogger }) => {
      reqLogger.info(
        { event: 'program.update', userId, instanceId: params.id },
        'updating program instance'
      );
      await rateLimit(userId, 'PATCH /programs', MUTATION_RATE_LIMIT);
      const result = await updateInstance(userId, params.id, body);
      await invalidateCachedInstance(userId, params.id);
      return result;
    },
    {
      params: t2.Object({
        id: t2.String({
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        }),
      }),
      body: t2.Object({
        name: t2.Optional(t2.String({ minLength: 1, maxLength: 100 })),
        status: t2.Optional(
          t2.Union([t2.Literal('active'), t2.Literal('completed'), t2.Literal('archived')])
        ),
        config: t2.Optional(programConfigSchema),
      }),
      detail: {
        tags: ['Programs'],
        summary: 'Update program instance',
        description:
          'Partially updates a program instance. Only provided fields are changed. Use `status` to archive or complete a program.',
        security,
        responses: {
          200: { description: 'Updated program instance' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Program not found or not owned by user' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )
  .patch(
    '/:id/metadata',
    async ({ userId, params, body, reqLogger }) => {
      reqLogger.info(
        { event: 'program.updateMetadata', userId, instanceId: params.id },
        'updating program metadata'
      );
      await rateLimit(userId, 'PATCH /programs/metadata', MUTATION_RATE_LIMIT);
      const result = await updateInstanceMetadata(userId, params.id, body.metadata);
      await invalidateCachedInstance(userId, params.id);
      return result;
    },
    {
      params: t2.Object({
        id: t2.String({
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        }),
      }),
      body: t2.Object({
        metadata: t2.Record(
          t2.String({ maxLength: 50 }),
          t2.Union([t2.String({ maxLength: 500 }), t2.Number(), t2.Boolean(), t2.Null()])
        ),
      }),
      detail: {
        tags: ['Programs'],
        summary: 'Update program metadata',
        description:
          'Deep-merges the provided metadata with existing metadata on the program instance. Used for graduation state, bodyweight snapshots, etc.',
        security,
        responses: {
          200: { description: 'Updated program instance with merged metadata' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Program not found or not owned by user' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )
  .delete(
    '/:id',
    async ({ userId, params, set, reqLogger }) => {
      reqLogger.info(
        { event: 'program.delete', userId, instanceId: params.id },
        'deleting program instance'
      );
      await rateLimit(userId, 'DELETE /programs', MUTATION_RATE_LIMIT);
      await deleteInstance(userId, params.id);
      await invalidateCachedInstance(userId, params.id);
      set.status = 204;
    },
    {
      params: t2.Object({
        id: t2.String({
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        }),
      }),
      detail: {
        tags: ['Programs'],
        summary: 'Delete program instance',
        description:
          'Permanently deletes the program instance and all associated workout results and undo history (cascade).',
        security,
        responses: {
          204: { description: 'Deleted successfully' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Program not found or not owned by user' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )
  .get(
    '/:id/export',
    async ({ userId, params }) => {
      await rateLimit(userId, 'GET /programs/:id/export', { maxRequests: 20 });
      return exportInstance(userId, params.id);
    },
    {
      params: t2.Object({
        id: t2.String({
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        }),
      }),
      detail: {
        tags: ['Programs'],
        summary: 'Export program instance',
        description:
          'Exports the program instance as a portable JSON document that can be imported into any GZCLP Tracker account.',
        security,
        responses: {
          200: { description: 'Exported program JSON' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Program not found or not owned by user' },
        },
      },
    }
  )
  .post(
    '/import',
    async ({ userId, body, set, reqLogger }) => {
      assertImportPayloadKeysInBounds(body);
      reqLogger.info({ event: 'program.import', userId }, 'importing program instance');
      await applyImportRateLimits(userId, body);
      const instance = await importInstance(userId, body);
      set.status = 201;
      return instance;
    },
    {
      body: t2.Object({
        version: t2.Literal(1),
        exportDate: t2.String({ format: 'date-time' }),
        programId: programIdSchema,
        name: t2.String({ minLength: 1, maxLength: 100 }),
        config: programConfigSchema,
        // Bounded to keep a single import from forcing an unbounded in-memory
        // array + one huge transaction. Outer key = workoutIndex (capped well
        // above any real program length); inner key = slotId (capped above any
        // real day's slot count). undoHistory below is bounded the same way.
        results: t2.Record(
          workoutIndexKeySchema,
          t2.Record(
            slotIdSchema,
            t2.Object({
              result: t2.Optional(t2.Union([t2.Literal('success'), t2.Literal('fail')])),
              amrapReps: t2.Optional(t2.Integer({ minimum: 0, maximum: MAX_AMRAP_REPS2 })),
              rpe: t2.Optional(t2.Integer({ minimum: 1, maximum: 10 })),
              setLogs: t2.Optional(setLogsSchema),
            }),
            { maxProperties: 50 }
          ),
          { maxProperties: 1e3 }
        ),
        undoHistory: t2.Array(
          t2.Object({
            i: t2.Integer({ minimum: 0 }),
            slotId: slotIdSchema,
            prev: t2.Optional(t2.Union([t2.Literal('success'), t2.Literal('fail')])),
            prevRpe: t2.Optional(t2.Integer({ minimum: 1, maximum: 10 })),
            prevAmrapReps: t2.Optional(t2.Integer({ minimum: 0, maximum: MAX_AMRAP_REPS2 })),
            prevSetLogs: t2.Optional(setLogsSchema),
          }),
          { maxItems: MAX_IMPORT_UNDO_ENTRIES }
        ),
        completedDates: t2.Optional(
          t2.Record(workoutIndexKeySchema, t2.String({ format: 'date-time' }), {
            maxProperties: 1e3,
          })
        ),
      }),
      detail: {
        tags: ['Programs'],
        summary: 'Import program instance',
        description:
          'Imports a previously exported program JSON. All results and undo history are validated against the program definition before import.',
        security,
        responses: {
          201: { description: 'Program instance created from import' },
          400: {
            description:
              'Invalid export data (unknown programId, invalid config, or bad workout indices)',
          },
          401: { description: 'Missing or invalid token' },
          429: { description: 'Rate limited' },
        },
      },
    }
  );

// apps/backend/api/src/routes/catalog.ts
import { Elysia as Elysia6, t as t3 } from 'elysia';
var HOUR_MS = 36e5;
var MAX_PROGRAM_ID_CHARS2 = 50;
var MAX_PREVIEW_CONFIG_KEYS = 100;
var security2 = [{ bearerAuth: [] }];
var previewConfigSchema = t3.Record(
  t3.String({ maxLength: 30 }),
  t3.Union([t3.Number({ minimum: 0, maximum: 1e4 }), t3.String({ maxLength: 100 })]),
  { maxProperties: MAX_PREVIEW_CONFIG_KEYS }
);
function parseMixedConfig(raw) {
  if (!isRecord(raw)) return void 0;
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number') out[k] = v;
    else if (typeof v === 'string') out[k] = v;
  }
  return out;
}
function validatePreviewConfig(definition, config) {
  if (config === void 0) return;
  const fieldsByKey = new Map(definition.configFields.map((field) => [field.key, field]));
  for (const [key, value] of Object.entries(config)) {
    const field = fieldsByKey.get(key);
    if (field === void 0) {
      throw new ApiError(422, `Unknown preview config field: ${key}`, 'VALIDATION_ERROR');
    }
    if (field.type === 'weight') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < field.min) {
        throw new ApiError(
          422,
          `Preview config field ${key} must be a number greater than or equal to ${field.min}`,
          'VALIDATION_ERROR'
        );
      }
      continue;
    }
    if (typeof value !== 'string' || !field.options.some((option) => option.value === value)) {
      throw new ApiError(
        422,
        `Preview config field ${key} must use one of its declared options`,
        'VALIDATION_ERROR'
      );
    }
  }
}
var catalogRoutes = new Elysia6({ prefix: '/catalog' })
  .use(requestLogger)
  .group('/preview', (app2) =>
    app2
      .use(jwtPlugin)
      .resolve(resolveUserId)
      .post(
        '/',
        async ({ userId, body }) => {
          await rateLimit(userId, 'POST /catalog/preview', {
            windowMs: HOUR_MS,
            maxRequests: 30,
            failClosed: true,
          });
          const parseResult = ProgramDefinitionSchema.safeParse(body.definition);
          if (!parseResult.success) {
            throw new ApiError(
              422,
              `Invalid program definition: ${parseResult.error.message}`,
              'VALIDATION_ERROR'
            );
          }
          const config = parseMixedConfig(body.config);
          validatePreviewConfig(parseResult.data, config);
          const rows = previewDefinition(parseResult.data, config);
          return rows;
        },
        {
          body: t3.Object({
            definition: t3.Any(),
            config: t3.Optional(previewConfigSchema),
          }),
          detail: {
            tags: ['Catalog'],
            summary: 'Preview program definition',
            description:
              'Dry-runs a program definition and returns the first 10 workout rows. Requires authentication.',
            security: security2,
            responses: {
              200: { description: 'Array of GenericWorkoutRow (max 10)' },
              401: { description: 'Missing or invalid token' },
              422: { description: 'Invalid definition payload' },
              429: { description: 'Rate limited' },
            },
          },
        }
      )
  )
  .use(requestLogger)
  .get(
    '/',
    async ({ ip, set }) => {
      await rateLimit(ip, 'GET /catalog', { maxRequests: 100 });
      const result = await listPrograms();
      set.headers['Cache-Control'] =
        'public, max-age=300, s-maxage=3600, stale-while-revalidate=60';
      return result;
    },
    {
      detail: {
        tags: ['Catalog'],
        summary: 'List program definitions',
        description:
          'Returns all available preset program definitions from the database. No authentication required.',
        responses: {
          200: { description: 'Array of catalog entries' },
        },
      },
    }
  )
  .get(
    '/:programId',
    async ({ params, ip, set }) => {
      await rateLimit(ip, 'GET /catalog/:id', { maxRequests: 100 });
      const result = await getProgramDefinition(params.programId);
      if (result.status === 'not_found') {
        throw new ApiError(404, 'Program not found', 'PROGRAM_NOT_FOUND');
      }
      if (result.status === 'hydration_failed') {
        throw new ApiError(500, 'Program definition hydration failed', 'HYDRATION_FAILED');
      }
      set.headers['Cache-Control'] = 'public, max-age=300, s-maxage=3600';
      return result.definition;
    },
    {
      params: t3.Object({
        programId: t3.String({
          minLength: 1,
          maxLength: MAX_PROGRAM_ID_CHARS2,
          pattern: '^[a-z0-9-]+$',
        }),
      }),
      detail: {
        tags: ['Catalog'],
        summary: 'Get program definition',
        description:
          'Returns a single hydrated program definition by ID (e.g. `"gzclp"`). No authentication required.',
        responses: {
          200: { description: 'Hydrated program definition' },
          404: { description: 'Unknown program ID' },
          500: { description: 'Hydration failure \u2014 corrupted program data' },
        },
      },
    }
  );

// apps/backend/api/src/routes/exercises.ts
import { Elysia as Elysia7, t as t4 } from 'elysia';

// apps/backend/api/src/services/exercises.ts
import {
  and as and5,
  asc as asc3,
  count as count2,
  eq as eq5,
  ilike,
  inArray as inArray2,
  or as or2,
} from 'drizzle-orm';

// apps/backend/api/src/lib/exercise-cache.ts
import { createHash } from 'node:crypto';
var PRESET_TTL_SECONDS = 300;
var USER_TTL_SECONDS = 120;
function isExerciseEntry(value) {
  return isRecord(value) && typeof value['id'] === 'string' && typeof value['name'] === 'string';
}
function isExerciseEntryArray(value) {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;
  return isExerciseEntry(value[0]);
}
function isPaginatedExercises(value) {
  if (!isRecord(value)) return false;
  if (typeof value['total'] !== 'number') return false;
  if (typeof value['offset'] !== 'number') return false;
  if (typeof value['limit'] !== 'number') return false;
  return isExerciseEntryArray(value['data']);
}
function buildFilterHash(filter) {
  const cleaned = {};
  for (const key of Object.keys(filter).sort()) {
    const val = filter[key];
    if (val === void 0 || val === null) continue;
    if (Array.isArray(val) && val.length === 0) continue;
    if (typeof val === 'string' && val.length === 0) continue;
    cleaned[key] = Array.isArray(val) ? [...val].sort() : val;
  }
  if (Object.keys(cleaned).length === 0) return '';
  return createHash('sha256').update(JSON.stringify(cleaned)).digest('hex');
}
function presetKey(filterHash) {
  return `exercises:preset:${filterHash}`;
}
function userKey(userId, filterHash) {
  return `exercises:user:${userId}:${filterHash}`;
}
async function getCachedExercises(userId, filterHash) {
  const redis = getRedis();
  if (!redis) return void 0;
  const key = userId ? userKey(userId, filterHash) : presetKey(filterHash);
  try {
    const parsed = await redis.get(key);
    if (parsed === null || parsed === void 0) return void 0;
    if (!isPaginatedExercises(parsed)) {
      logger.warn('exercise-cache: corrupt entry, evicting');
      await redis.del(key);
      return void 0;
    }
    return parsed;
  } catch (err2) {
    logger.warn({ err: err2 }, 'exercise-cache: get failed');
    return void 0;
  }
}
async function setCachedExercises(userId, filterHash, result) {
  const redis = getRedis();
  if (!redis) return;
  const key = userId ? userKey(userId, filterHash) : presetKey(filterHash);
  const ttl = userId ? USER_TTL_SECONDS : PRESET_TTL_SECONDS;
  try {
    await redis.set(key, result, { ex: ttl });
  } catch (err2) {
    logger.warn({ err: err2 }, 'exercise-cache: set failed');
  }
}
async function invalidateUserExercises(userId) {
  const redis = getRedis();
  if (!redis) return;
  try {
    const pattern = `exercises:user:${userId}:*`;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = String(nextCursor);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err2) {
    logger.warn({ err: err2, userId }, 'exercise-cache: invalidate failed');
  }
}

// apps/backend/api/src/lib/muscle-groups-cache.ts
var CACHE_TTL_SECONDS3 = 600;
var CACHE_KEY = 'muscle-groups:list';
function isMuscleGroupEntry(value) {
  return isRecord(value) && typeof value['id'] === 'string' && typeof value['name'] === 'string';
}
function isMuscleGroupEntryArray(value) {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;
  return isMuscleGroupEntry(value[0]);
}
async function getCachedMuscleGroups() {
  const redis = getRedis();
  if (!redis) return void 0;
  try {
    const parsed = await redis.get(CACHE_KEY);
    if (parsed === null || parsed === void 0) return void 0;
    if (!isMuscleGroupEntryArray(parsed)) {
      logger.warn('muscle-groups-cache: corrupt entry, evicting');
      await redis.del(CACHE_KEY);
      return void 0;
    }
    return parsed;
  } catch (err2) {
    logger.warn({ err: err2 }, 'muscle-groups-cache: get failed');
    return void 0;
  }
}
async function setCachedMuscleGroups(entries) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(CACHE_KEY, entries, { ex: CACHE_TTL_SECONDS3 });
  } catch (err2) {
    logger.warn({ err: err2 }, 'muscle-groups-cache: set failed');
  }
}

// apps/backend/api/src/services/exercises.ts
var exerciseFlight = new SingleflightMap();
var muscleGroupFlight = new SingleflightMap();
var DEFAULT_PAGINATION = { limit: 100, offset: 0 };
var MIN_EXERCISE_LIMIT = 1;
var MAX_EXERCISE_LIMIT = 1e3;
var MIN_EXERCISE_OFFSET = 0;
var MAX_EXERCISE_OFFSET = 1e4;
var MAX_SEARCH_QUERY_LENGTH = 100;
var MAX_FILTER_VALUES = 20;
var MAX_FILTER_VALUE_LENGTH = 80;
var MAX_CREATE_EXERCISE_ID_LENGTH = 50;
var MAX_CREATE_EXERCISE_NAME_LENGTH = 100;
var MAX_CREATE_EXERCISE_MUSCLE_GROUP_ID_LENGTH = 50;
var MAX_CREATE_EXERCISE_EQUIPMENT_LENGTH = 50;
var MAX_DISAMBIGUATION_ATTEMPTS = 5;
var DISAMBIGUATOR_LENGTH = 8;
function escapeLikePattern(raw) {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
function assertPaginationInRange(page) {
  if (
    !Number.isInteger(page.limit) ||
    page.limit < MIN_EXERCISE_LIMIT ||
    page.limit > MAX_EXERCISE_LIMIT
  ) {
    throw new ApiError(400, 'Invalid exercise limit', 'INVALID_FILTER');
  }
  if (
    !Number.isInteger(page.offset) ||
    page.offset < MIN_EXERCISE_OFFSET ||
    page.offset > MAX_EXERCISE_OFFSET
  ) {
    throw new ApiError(400, 'Invalid exercise offset', 'INVALID_FILTER');
  }
}
function assertFilterValuesInRange(values) {
  if (values === void 0) return;
  if (values.length > MAX_FILTER_VALUES) {
    throw new ApiError(400, 'Too many exercise filter values', 'INVALID_FILTER');
  }
  if (values.some((value) => value.length > MAX_FILTER_VALUE_LENGTH)) {
    throw new ApiError(400, 'Exercise filter value is too long', 'INVALID_FILTER');
  }
}
function assertFilterInRange(filter) {
  if (filter?.q !== void 0 && filter.q.length > MAX_SEARCH_QUERY_LENGTH) {
    throw new ApiError(400, 'Invalid exercise search query', 'INVALID_FILTER');
  }
  assertFilterValuesInRange(filter?.muscleGroupId);
  assertFilterValuesInRange(filter?.equipment);
  assertFilterValuesInRange(filter?.force);
  assertFilterValuesInRange(filter?.level);
  assertFilterValuesInRange(filter?.mechanic);
  assertFilterValuesInRange(filter?.category);
}
function isCreateExerciseInputInvalid(input) {
  return (
    input.id.length < 1 ||
    input.id.length > MAX_CREATE_EXERCISE_ID_LENGTH ||
    input.name.length < 1 ||
    input.name.length > MAX_CREATE_EXERCISE_NAME_LENGTH ||
    input.muscleGroupId.length < 1 ||
    input.muscleGroupId.length > MAX_CREATE_EXERCISE_MUSCLE_GROUP_ID_LENGTH ||
    (input.equipment !== void 0 && input.equipment.length > MAX_CREATE_EXERCISE_EQUIPMENT_LENGTH)
  );
}
function toExerciseEntry(row) {
  return {
    id: row.id,
    name: row.name,
    muscleGroupId: row.muscleGroupId,
    equipment: row.equipment,
    isCompound: row.isCompound,
    isPreset: row.isSystem,
    createdBy: row.createdByUserId,
    force: row.forceType ?? null,
    level: row.level ?? null,
    mechanic: row.movementMechanic ?? null,
    category: row.category ?? null,
    secondaryMuscles: row.secondaryMuscles ?? null,
  };
}
async function listExercises(userId, filter, pagination) {
  const page = pagination ?? DEFAULT_PAGINATION;
  assertPaginationInRange(page);
  assertFilterInRange(filter);
  const filterForHash = {
    ...filter,
    limit: page.limit,
    offset: page.offset,
  };
  const filterHash = buildFilterHash(filterForHash);
  const cached = await getCachedExercises(userId, filterHash);
  if (cached) return cached;
  const sfKey = `exercises:${userId ?? 'preset'}:${filterHash}`;
  return exerciseFlight.run(sfKey, async () => {
    const rechecked = await getCachedExercises(userId, filterHash);
    if (rechecked) return rechecked;
    const conditions = [
      userId
        ? or2(eq5(exercises.isSystem, true), eq5(exercises.createdByUserId, userId))
        : eq5(exercises.isSystem, true),
    ];
    if (filter?.q) {
      conditions.push(ilike(exercises.name, `%${escapeLikePattern(filter.q)}%`));
    }
    if (filter?.muscleGroupId && filter.muscleGroupId.length > 0) {
      conditions.push(inArray2(exercises.muscleGroupId, [...filter.muscleGroupId]));
    }
    if (filter?.equipment && filter.equipment.length > 0) {
      conditions.push(inArray2(exercises.equipment, [...filter.equipment]));
    }
    if (filter?.force && filter.force.length > 0) {
      conditions.push(inArray2(exercises.forceType, [...filter.force]));
    }
    if (filter?.level && filter.level.length > 0) {
      conditions.push(inArray2(exercises.level, [...filter.level]));
    }
    if (filter?.mechanic && filter.mechanic.length > 0) {
      conditions.push(inArray2(exercises.movementMechanic, [...filter.mechanic]));
    }
    if (filter?.category && filter.category.length > 0) {
      conditions.push(inArray2(exercises.category, [...filter.category]));
    }
    if (filter?.isCompound !== void 0) {
      conditions.push(eq5(exercises.isCompound, filter.isCompound));
    }
    const whereClause = and5(...conditions);
    const db = getDb();
    const [rows, [countResult]] = await Promise.all([
      db
        .select()
        .from(exercises)
        .where(whereClause)
        .orderBy(asc3(exercises.name), asc3(exercises.id))
        .limit(page.limit)
        .offset(page.offset),
      db.select({ value: count2() }).from(exercises).where(whereClause),
    ]);
    const result = {
      data: rows.map(toExerciseEntry),
      total: countResult?.value ?? 0,
      offset: page.offset,
      limit: page.limit,
    };
    void setCachedExercises(userId, filterHash, result);
    return result;
  });
}
async function listMuscleGroups() {
  const cached = await getCachedMuscleGroups();
  if (cached) return cached;
  return muscleGroupFlight.run('list', async () => {
    const rechecked = await getCachedMuscleGroups();
    if (rechecked) return rechecked;
    const rows = await getDb()
      .select({ id: muscleGroups.id, name: muscleGroups.name })
      .from(muscleGroups);
    void setCachedMuscleGroups(rows);
    return rows;
  });
}
async function createExercise(userId, input) {
  if (isCreateExerciseInputInvalid(input)) {
    return err({ code: 'INVALID_EXERCISE_INPUT' });
  }
  const result = await getDb().transaction(async (tx) => {
    await lockUserForDataMutation(tx, userId);
    const [mg] = await tx
      .select({ id: muscleGroups.id })
      .from(muscleGroups)
      .where(eq5(muscleGroups.id, input.muscleGroupId))
      .limit(1);
    if (!mg) return err({ code: 'INVALID_MUSCLE_GROUP' });
    async function insertWithId(executor, id) {
      const [row] = await executor
        .insert(exercises)
        .values({
          id,
          name: input.name,
          muscleGroupId: input.muscleGroupId,
          equipment: input.equipment ?? null,
          isCompound: input.isCompound ?? false,
          isSystem: false,
          createdByUserId: userId,
        })
        .onConflictDoNothing()
        .returning();
      return row;
    }
    const inserted = await insertWithId(tx, input.id);
    if (inserted) {
      await assertUserDataQuotas(tx, userId);
      return ok(toExerciseEntry(inserted));
    }
    const [existing] = await tx
      .select({ createdByUserId: exercises.createdByUserId, isSystem: exercises.isSystem })
      .from(exercises)
      .where(eq5(exercises.id, input.id))
      .limit(1);
    if (existing && !existing.isSystem && existing.createdByUserId === userId) {
      return err({ code: 'EXERCISE_ID_CONFLICT' });
    }
    for (let attempt = 0; attempt < MAX_DISAMBIGUATION_ATTEMPTS; attempt++) {
      const candidateId = `${input.id}-${crypto.randomUUID().slice(0, DISAMBIGUATOR_LENGTH)}`;
      const disambiguated = await insertWithId(tx, candidateId);
      if (disambiguated) {
        await assertUserDataQuotas(tx, userId);
        return ok(toExerciseEntry(disambiguated));
      }
    }
    return err({ code: 'EXERCISE_ID_CONFLICT' });
  });
  if (result.ok) void invalidateUserExercises(userId);
  return result;
}

// apps/backend/api/src/routes/exercises.ts
var security3 = [{ bearerAuth: [] }];
var MAX_FILTER_VALUES2 = 20;
var MAX_FILTER_VALUE_LENGTH2 = 80;
var MAX_FILTER_QUERY_LENGTH =
  MAX_FILTER_VALUES2 * MAX_FILTER_VALUE_LENGTH2 + MAX_FILTER_VALUES2 - 1;
var MAX_BOOLEAN_QUERY_LENGTH = 5;
var MAX_SEARCH_QUERY_LENGTH2 = 100;
var MAX_OFFSET = 1e4;
var MAX_EXERCISE_ID_CHARS = 50;
var filterQuerySchema = t4.String({ maxLength: MAX_FILTER_QUERY_LENGTH });
var graphemeSegmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
function parseCommaSeparated(value) {
  if (!value) return void 0;
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length > MAX_FILTER_VALUES2) {
    throw new ApiError(400, 'Too many filter values', 'INVALID_FILTER');
  }
  if (parts.some((part) => part.length > MAX_FILTER_VALUE_LENGTH2)) {
    throw new ApiError(400, 'Filter value is too long', 'INVALID_FILTER');
  }
  return parts.length > 0 ? parts : void 0;
}
function parseBooleanString(value) {
  if (value === void 0) return void 0;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new ApiError(400, 'Boolean filters must be "true" or "false"', 'INVALID_FILTER');
}
function slugifyExerciseName(name) {
  const normalized = name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(new RegExp('(\\p{Script=Latin})\\p{Mark}+', 'gu'), '$1')
    .normalize('NFC')
    .replace(/\s+/gu, '_')
    .replace(/[^\p{Letter}\p{Number}\p{Mark}_]/gu, '')
    .replace(/^_+|_+$/gu, '');
  if (!/[\p{Letter}\p{Number}]/u.test(normalized)) return '';
  let truncated = '';
  for (const { segment } of graphemeSegmenter.segment(normalized)) {
    if (truncated.length + segment.length > MAX_EXERCISE_ID_CHARS) break;
    truncated += segment;
  }
  return truncated;
}
async function resolveOptionalUserId({ jwt: jwtCtx, headers }) {
  const authorization = headers['authorization'];
  if (!authorization) {
    return { userId: void 0 };
  }
  const token = extractBearerToken(headers);
  return verifyAccessToken(jwtCtx, token);
}
var publicExerciseRoutes = new Elysia7()
  .use(requestLogger)
  .use(jwtPlugin)
  .get(
    '/exercises',
    async ({ jwt: jwtCtx, headers, query, set, ip }) => {
      const { userId } = await resolveOptionalUserId({ jwt: jwtCtx, headers });
      const rateLimitKey = userId ? `${userId}:${ip}` : ip;
      await rateLimit(rateLimitKey, 'GET /exercises', { maxRequests: 100 });
      const filter = {
        q: query.q || void 0,
        muscleGroupId: parseCommaSeparated(query.muscleGroupId),
        equipment: parseCommaSeparated(query.equipment),
        force: parseCommaSeparated(query.force),
        level: parseCommaSeparated(query.level),
        mechanic: parseCommaSeparated(query.mechanic),
        category: parseCommaSeparated(query.category),
        isCompound: parseBooleanString(query.isCompound),
      };
      const result = await listExercises(userId, filter, {
        limit: query.limit ?? 100,
        offset: query.offset ?? 0,
      });
      if (!userId) {
        set.headers['Cache-Control'] = 'public, max-age=300';
      }
      return result;
    },
    {
      query: t4.Object({
        q: t4.Optional(t4.String({ maxLength: MAX_SEARCH_QUERY_LENGTH2 })),
        muscleGroupId: t4.Optional(filterQuerySchema),
        equipment: t4.Optional(filterQuerySchema),
        force: t4.Optional(filterQuerySchema),
        level: t4.Optional(filterQuerySchema),
        mechanic: t4.Optional(filterQuerySchema),
        category: t4.Optional(filterQuerySchema),
        isCompound: t4.Optional(t4.String({ maxLength: MAX_BOOLEAN_QUERY_LENGTH })),
        limit: t4.Optional(t4.Numeric({ minimum: 1, maximum: 1e3 })),
        offset: t4.Optional(t4.Numeric({ minimum: 0, maximum: MAX_OFFSET })),
      }),
      detail: {
        tags: ['Exercises'],
        summary: 'List exercises',
        description:
          'Returns preset exercises for unauthenticated requests, or preset + user-created exercises when authenticated. Supports filtering by text search (q), muscle group, equipment, force, level, mechanic, category (comma-separated for multi-value), and isCompound (true/false).',
        responses: {
          200: { description: 'Array of exercises' },
        },
      },
    }
  )
  .get(
    '/muscle-groups',
    async ({ ip, set }) => {
      await rateLimit(ip, 'GET /muscle-groups', { maxRequests: 100 });
      const result = await listMuscleGroups();
      set.headers['Cache-Control'] = 'public, max-age=600';
      return result;
    },
    {
      detail: {
        tags: ['Exercises'],
        summary: 'List muscle groups',
        description: 'Returns all muscle groups. No authentication required.',
        responses: {
          200: { description: 'Array of muscle groups' },
        },
      },
    }
  );
var protectedExerciseRoutes = new Elysia7()
  .use(requestLogger)
  .use(jwtPlugin)
  .resolve(resolveUserId)
  .post(
    '/exercises',
    async ({ userId, body, set, reqLogger }) => {
      reqLogger.info({ event: 'exercise.create', userId }, 'creating exercise');
      await rateLimit(userId, 'POST /exercises', { failClosed: true });
      const slug = slugifyExerciseName(body.name);
      if (!slug) {
        throw new ApiError(
          422,
          'Exercise name must contain at least one alphanumeric character',
          'INVALID_SLUG'
        );
      }
      const result = await createExercise(userId, {
        id: slug,
        name: body.name,
        muscleGroupId: body.muscleGroupId,
        equipment: body.equipment,
        isCompound: body.isCompound,
      });
      if (!result.ok) {
        if (result.error.code === 'EXERCISE_ID_CONFLICT') {
          throw new ApiError(409, 'Exercise ID already exists', 'DUPLICATE');
        }
        if (result.error.code === 'INVALID_EXERCISE_INPUT') {
          throw new ApiError(400, 'Invalid exercise input', 'VALIDATION_ERROR');
        }
        throw new ApiError(400, 'Invalid muscle group', 'VALIDATION_ERROR');
      }
      set.status = 201;
      return result.value;
    },
    {
      body: t4.Object({
        name: t4.String({ minLength: 1, maxLength: 100 }),
        muscleGroupId: t4.String({ minLength: 1, maxLength: 50 }),
        equipment: t4.Optional(t4.String({ maxLength: 50 })),
        isCompound: t4.Optional(t4.Boolean()),
      }),
      detail: {
        tags: ['Exercises'],
        summary: 'Create exercise',
        description:
          'Creates a user-scoped exercise. The exercise ID is derived from the name (lowercase, underscored). Returns 409 if the generated ID conflicts with an existing exercise.',
        security: security3,
        responses: {
          201: { description: 'Exercise created' },
          400: { description: 'Invalid muscle group ID' },
          401: { description: 'Missing or invalid token' },
          409: { description: 'Exercise ID already exists' },
          429: { description: 'Rate limited' },
        },
      },
    }
  );
var exerciseRoutes = new Elysia7().use(publicExerciseRoutes).use(protectedExerciseRoutes);

// apps/backend/api/src/routes/results.ts
import { Elysia as Elysia8, t as t5 } from 'elysia';

// apps/backend/api/src/services/results.ts
import { eq as eq6, and as and6, desc as desc3, sql as sql6 } from 'drizzle-orm';
var MAX_UNDO_STACK = 50;
var undoSnapshotFields = {
  result: workoutResults.result,
  amrapReps: workoutResults.amrapReps,
  rpe: workoutResults.rpe,
  setLogs: workoutResults.setLogs,
  exerciseId: workoutResults.exerciseId,
  definitionVersion: workoutResults.definitionVersion,
};
function jsonValuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
async function touchInstanceTimestamp(tx, instanceId) {
  await tx
    .update(programInstances)
    .set({ updatedAt: /* @__PURE__ */ new Date() })
    .where(eq6(programInstances.id, instanceId));
}
async function trimUndoStack(tx, instanceId) {
  await tx.execute(sql6`
    DELETE FROM undo_entries
    WHERE instance_id = ${instanceId}
      AND id IN (
        SELECT id FROM undo_entries
        WHERE instance_id = ${instanceId}
        ORDER BY id DESC
        OFFSET ${sql6.raw(String(MAX_UNDO_STACK))}
      )
  `);
}
async function getOwnedInstanceContext(userId, instanceId) {
  const [instance] = await getDb()
    .select({ templateId: programInstances.templateId })
    .from(programInstances)
    .where(and6(eq6(programInstances.id, instanceId), eq6(programInstances.userId, userId)))
    .limit(1);
  if (!instance) throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
  return instance;
}
async function resolveHistoricalDefinition(programId) {
  const result = await getHistoricalProgramDefinition(programId);
  if (result.status === 'found') return result.definition;
  throw new ApiError(
    409,
    'Program definition is unavailable; results cannot be validated safely',
    'PROGRAM_DEFINITION_UNAVAILABLE'
  );
}
function resolveSlotIdentity(definition, workoutIndex, slotId) {
  if (workoutIndex < 0 || workoutIndex >= definition.totalWorkouts) {
    throw new ApiError(400, `Invalid workoutIndex: ${workoutIndex}`, 'INVALID_DATA');
  }
  const day = definition.days[workoutIndex % definition.days.length];
  const slot = day?.slots.find((candidate) => candidate.id === slotId);
  if (!day || !slot) throw new ApiError(400, `Unknown slotId: ${slotId}`, 'INVALID_DATA');
  return {
    expectedSlots: day.slots.length,
    exerciseId: slot.exerciseId,
    definitionVersion: definition.version,
  };
}
async function lockOwnedInstance(tx, userId, instanceId) {
  const [instance] = await tx
    .select({ id: programInstances.id })
    .from(programInstances)
    .where(and6(eq6(programInstances.id, instanceId), eq6(programInstances.userId, userId)))
    .for('update')
    .limit(1);
  if (!instance) throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
}
async function syncCompletedAt(tx, instanceId, workoutIndex, expectedSlots) {
  const resultRows = await tx
    .select({ id: workoutResults.id, completedAt: workoutResults.completedAt })
    .from(workoutResults)
    .where(
      and6(
        eq6(workoutResults.instanceId, instanceId),
        eq6(workoutResults.workoutIndex, workoutIndex)
      )
    );
  const isComplete = resultRows.length >= expectedSlots;
  if (isComplete) {
    const needsUpdate = resultRows.some((r) => r.completedAt === null);
    if (needsUpdate) {
      await tx
        .update(workoutResults)
        .set({ completedAt: /* @__PURE__ */ new Date() })
        .where(
          and6(
            eq6(workoutResults.instanceId, instanceId),
            eq6(workoutResults.workoutIndex, workoutIndex)
          )
        );
    }
  } else {
    const needsClear = resultRows.some((r) => r.completedAt !== null);
    if (needsClear) {
      await tx
        .update(workoutResults)
        .set({ completedAt: null })
        .where(
          and6(
            eq6(workoutResults.instanceId, instanceId),
            eq6(workoutResults.workoutIndex, workoutIndex)
          )
        );
    }
  }
}
var MAX_AMRAP_REPS3 = 99;
var MAX_RESULT_WORKOUT_INDEX = MAX_TOTAL_WORKOUTS - 1;
var MAX_SET_LOG_WEIGHT3 = 1e4;
var MAX_SET_LOG_ITEMS3 = 20;
var MAX_SLOT_ID_LENGTH = 50;
function assertWorkoutIndexInRange(workoutIndex) {
  if (
    !Number.isInteger(workoutIndex) ||
    workoutIndex < 0 ||
    workoutIndex > MAX_RESULT_WORKOUT_INDEX
  ) {
    throw new ApiError(400, `Invalid workoutIndex: ${workoutIndex}`, 'INVALID_DATA');
  }
}
function assertSlotIdValid(slotId) {
  if (slotId.length < 1 || slotId.length > MAX_SLOT_ID_LENGTH) {
    throw new ApiError(400, `Invalid slotId: ${slotId}`, 'INVALID_DATA');
  }
}
async function recordResult(userId, instanceId, input) {
  assertWorkoutIndexInRange(input.workoutIndex);
  assertSlotIdValid(input.slotId);
  if (input.amrapReps !== void 0 && input.amrapReps > MAX_AMRAP_REPS3) {
    throw new ApiError(400, `amrapReps cannot exceed ${MAX_AMRAP_REPS3}`, 'INVALID_DATA');
  }
  if (input.rpe !== void 0 && (input.rpe < 1 || input.rpe > 10)) {
    throw new ApiError(400, 'rpe must be between 1 and 10', 'INVALID_DATA');
  }
  if (input.setLogs !== void 0 && input.setLogs.length > MAX_SET_LOG_ITEMS3) {
    throw new ApiError(400, `setLogs cannot exceed ${MAX_SET_LOG_ITEMS3} entries`, 'INVALID_DATA');
  }
  for (const setLog of input.setLogs ?? []) {
    if (!SetLogEntrySchema.safeParse(setLog).success) {
      throw new ApiError(400, 'Invalid setLogs entry', 'INVALID_DATA');
    }
    if (setLog.weight !== void 0 && setLog.weight > MAX_SET_LOG_WEIGHT3) {
      throw new ApiError(
        400,
        `setLogs.weight cannot exceed ${MAX_SET_LOG_WEIGHT3}`,
        'INVALID_DATA'
      );
    }
  }
  const setLogsValue = input.setLogs ?? null;
  const context = await getOwnedInstanceContext(userId, instanceId);
  const definition = await resolveHistoricalDefinition(context.templateId);
  const identity = resolveSlotIdentity(definition, input.workoutIndex, input.slotId);
  const result = await getDb().transaction(async (tx) => {
    await lockUserForDataMutation(tx, userId);
    await lockOwnedInstance(tx, userId, instanceId);
    const [existing] = await tx
      .select()
      .from(workoutResults)
      .where(
        and6(
          eq6(workoutResults.instanceId, instanceId),
          eq6(workoutResults.workoutIndex, input.workoutIndex),
          eq6(workoutResults.slotId, input.slotId)
        )
      )
      .limit(1);
    if (
      existing &&
      existing.result === input.result &&
      existing.amrapReps === (input.amrapReps ?? null) &&
      existing.rpe === (input.rpe ?? null) &&
      existing.exerciseId === identity.exerciseId &&
      existing.definitionVersion === identity.definitionVersion &&
      jsonValuesEqual(existing.setLogs, setLogsValue)
    ) {
      return existing;
    }
    const [row] = await tx
      .insert(workoutResults)
      .values({
        instanceId,
        workoutIndex: input.workoutIndex,
        slotId: input.slotId,
        exerciseId: identity.exerciseId,
        definitionVersion: identity.definitionVersion,
        result: input.result,
        amrapReps: input.amrapReps ?? null,
        rpe: input.rpe ?? null,
        setLogs: setLogsValue,
      })
      .onConflictDoUpdate({
        target: [workoutResults.instanceId, workoutResults.workoutIndex, workoutResults.slotId],
        set: {
          exerciseId: identity.exerciseId,
          definitionVersion: identity.definitionVersion,
          result: input.result,
          amrapReps: input.amrapReps ?? null,
          rpe: input.rpe ?? null,
          setLogs: setLogsValue,
        },
      })
      .returning();
    if (!row) {
      throw new ApiError(500, 'Failed to record result', 'INSERT_FAILED');
    }
    await tx.insert(undoEntries).values({
      instanceId,
      workoutIndex: input.workoutIndex,
      slotId: input.slotId,
      previousResult: existing?.result ?? null,
      previousAmrapReps: existing?.amrapReps ?? null,
      previousRpe: existing?.rpe ?? null,
      previousSetLogs: existing?.setLogs ?? null,
      previousExerciseId: existing?.exerciseId ?? null,
      previousDefinitionVersion: existing?.definitionVersion ?? null,
    });
    await trimUndoStack(tx, instanceId);
    await syncCompletedAt(tx, instanceId, input.workoutIndex, identity.expectedSlots);
    await touchInstanceTimestamp(tx, instanceId);
    await assertUserDataQuotas(tx, userId);
    return row;
  });
  return result;
}
async function deleteResult(userId, instanceId, workoutIndex, slotId) {
  assertWorkoutIndexInRange(workoutIndex);
  assertSlotIdValid(slotId);
  const context = await getOwnedInstanceContext(userId, instanceId);
  const definition = await resolveHistoricalDefinition(context.templateId);
  const identity = resolveSlotIdentity(definition, workoutIndex, slotId);
  await getDb().transaction(async (tx) => {
    await lockUserForDataMutation(tx, userId);
    await lockOwnedInstance(tx, userId, instanceId);
    const [existing] = await tx
      .delete(workoutResults)
      .where(
        and6(
          eq6(workoutResults.instanceId, instanceId),
          eq6(workoutResults.workoutIndex, workoutIndex),
          eq6(workoutResults.slotId, slotId)
        )
      )
      .returning(undoSnapshotFields);
    if (!existing) {
      throw new ApiError(404, 'Result not found', 'RESULT_NOT_FOUND');
    }
    await tx.insert(undoEntries).values({
      instanceId,
      workoutIndex,
      slotId,
      previousResult: existing.result,
      previousAmrapReps: existing.amrapReps ?? null,
      previousRpe: existing.rpe ?? null,
      previousSetLogs: existing.setLogs ?? null,
      previousExerciseId: existing.exerciseId ?? identity.exerciseId,
      previousDefinitionVersion: existing.definitionVersion ?? identity.definitionVersion,
    });
    await trimUndoStack(tx, instanceId);
    await syncCompletedAt(tx, instanceId, workoutIndex, identity.expectedSlots);
    await touchInstanceTimestamp(tx, instanceId);
  });
}
async function undoLast(userId, instanceId) {
  const context = await getOwnedInstanceContext(userId, instanceId);
  const definition = await resolveHistoricalDefinition(context.templateId);
  const entry = await getDb().transaction(async (tx) => {
    await lockUserForDataMutation(tx, userId);
    await lockOwnedInstance(tx, userId, instanceId);
    const [found] = await tx
      .select()
      .from(undoEntries)
      .where(eq6(undoEntries.instanceId, instanceId))
      .orderBy(desc3(undoEntries.id))
      .limit(1);
    if (!found) {
      return null;
    }
    await tx.delete(undoEntries).where(eq6(undoEntries.id, found.id));
    const prevSetLogsValue = found.previousSetLogs ?? null;
    const identity = resolveSlotIdentity(definition, found.workoutIndex, found.slotId);
    if (found.previousResult === null) {
      await tx
        .delete(workoutResults)
        .where(
          and6(
            eq6(workoutResults.instanceId, instanceId),
            eq6(workoutResults.workoutIndex, found.workoutIndex),
            eq6(workoutResults.slotId, found.slotId)
          )
        );
    } else {
      await tx
        .insert(workoutResults)
        .values({
          instanceId,
          workoutIndex: found.workoutIndex,
          slotId: found.slotId,
          exerciseId: found.previousExerciseId ?? identity.exerciseId,
          definitionVersion: found.previousDefinitionVersion ?? identity.definitionVersion,
          result: found.previousResult,
          amrapReps: found.previousAmrapReps ?? null,
          rpe: found.previousRpe ?? null,
          setLogs: prevSetLogsValue,
        })
        .onConflictDoUpdate({
          target: [workoutResults.instanceId, workoutResults.workoutIndex, workoutResults.slotId],
          set: {
            exerciseId: found.previousExerciseId ?? identity.exerciseId,
            definitionVersion: found.previousDefinitionVersion ?? identity.definitionVersion,
            result: found.previousResult,
            amrapReps: found.previousAmrapReps ?? null,
            rpe: found.previousRpe ?? null,
            setLogs: prevSetLogsValue,
          },
        });
    }
    await syncCompletedAt(tx, instanceId, found.workoutIndex, identity.expectedSlots);
    await touchInstanceTimestamp(tx, instanceId);
    await assertUserDataQuotas(tx, userId);
    return found;
  });
  return entry;
}

// apps/backend/api/src/routes/results.ts
var security4 = [{ bearerAuth: [] }];
var MAX_RESULT_WORKOUT_INDEX2 = MAX_TOTAL_WORKOUTS - 1;
var MAX_AMRAP_REPS4 = 99;
var MAX_SET_LOG_WEIGHT4 = 1e4;
var resultRoutes = new Elysia8({ prefix: '/programs/:id' })
  .use(requestLogger)
  .use(jwtPlugin)
  .resolve(resolveUserId)
  .post(
    '/results',
    async ({ userId, params, body, set, reqLogger }) => {
      reqLogger.info(
        {
          event: 'result.record',
          userId,
          instanceId: params.id,
          workoutIndex: body.workoutIndex,
          slotId: body.slotId,
        },
        'recording result'
      );
      await rateLimit(userId, 'POST /programs/results', {
        maxRequests: 60,
        failClosed: true,
      });
      const result = await recordResult(userId, params.id, body);
      await invalidateCachedInstance(userId, params.id);
      set.status = 201;
      return {
        workoutIndex: result.workoutIndex,
        slotId: result.slotId,
        result: result.result,
        ...(result.amrapReps !== null ? { amrapReps: result.amrapReps } : {}),
        ...(result.rpe !== null ? { rpe: result.rpe } : {}),
        ...(result.setLogs !== null ? { setLogs: result.setLogs } : {}),
      };
    },
    {
      params: t5.Object({
        id: t5.String({
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        }),
      }),
      body: t5.Object({
        workoutIndex: t5.Integer({ minimum: 0, maximum: MAX_RESULT_WORKOUT_INDEX2 }),
        slotId: t5.String({ minLength: 1, maxLength: 50 }),
        result: t5.Union([t5.Literal('success'), t5.Literal('fail')]),
        amrapReps: t5.Optional(t5.Integer({ minimum: 0, maximum: MAX_AMRAP_REPS4 })),
        rpe: t5.Optional(t5.Integer({ minimum: 1, maximum: 10 })),
        setLogs: t5.Optional(
          t5.Array(
            t5.Object({
              reps: t5.Integer({ minimum: 0, maximum: 999 }),
              weight: t5.Optional(t5.Number({ minimum: 0, maximum: MAX_SET_LOG_WEIGHT4 })),
              rpe: t5.Optional(t5.Integer({ minimum: 1, maximum: 10 })),
            }),
            { maxItems: 20 }
          )
        ),
      }),
      detail: {
        tags: ['Results'],
        summary: 'Record a workout result',
        description:
          'Upserts a result for a given workout index and slot (tier). Automatically pushes an undo entry capturing the previous state.',
        security: security4,
        responses: {
          201: { description: 'Result recorded' },
          400: { description: 'Invalid amrapReps or bad slot ID' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Program not found or not owned by user' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )
  .delete(
    '/results/:workoutIndex/:slotId',
    async ({ userId, params, set, reqLogger }) => {
      reqLogger.info(
        {
          event: 'result.delete',
          userId,
          instanceId: params.id,
          workoutIndex: params.workoutIndex,
          slotId: params.slotId,
        },
        'deleting result'
      );
      await rateLimit(userId, 'DELETE /programs/results', {
        maxRequests: 60,
        windowMs: 6e4,
        failClosed: true,
      });
      await deleteResult(userId, params.id, params.workoutIndex, params.slotId);
      await invalidateCachedInstance(userId, params.id);
      set.status = 204;
    },
    {
      params: t5.Object({
        id: t5.String({
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        }),
        workoutIndex: t5.Numeric({ minimum: 0, maximum: MAX_RESULT_WORKOUT_INDEX2 }),
        slotId: t5.String({ minLength: 1, maxLength: 50 }),
      }),
      detail: {
        tags: ['Results'],
        summary: 'Delete a workout result',
        description:
          'Removes a recorded result and pushes an undo entry so the deletion can be reversed.',
        security: security4,
        responses: {
          204: { description: 'Result deleted' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Result or program not found' },
        },
      },
    }
  )
  .post(
    '/undo',
    async ({ userId, params, reqLogger }) => {
      reqLogger.info(
        { event: 'result.undo', userId, instanceId: params.id },
        'undoing last result action'
      );
      await rateLimit(userId, 'POST /programs/undo', { failClosed: true });
      const entry = await undoLast(userId, params.id);
      await invalidateCachedInstance(userId, params.id);
      if (!entry) {
        return { undone: null };
      }
      return {
        undone: {
          i: entry.workoutIndex,
          slotId: entry.slotId,
          ...(entry.previousResult !== null ? { prev: entry.previousResult } : {}),
          ...(entry.previousSetLogs !== null ? { prevSetLogs: entry.previousSetLogs } : {}),
        },
      };
    },
    {
      params: t5.Object({
        id: t5.String({
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        }),
      }),
      detail: {
        tags: ['Results'],
        summary: 'Undo last result action',
        description:
          'Pops the most recent undo entry (LIFO) and restores the previous result state. Returns `{ undone: null }` if nothing to undo.',
        security: security4,
        responses: {
          200: { description: 'Undo applied or null if stack was empty' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'Program not found or not owned by user' },
          429: { description: 'Rate limited' },
        },
      },
    }
  );

// apps/backend/api/src/routes/stats.ts
import { Elysia as Elysia9 } from 'elysia';
var statsRoutes = new Elysia9().use(requestLogger).get(
  '/stats/online',
  async ({ ip }) => {
    await rateLimit(ip, 'GET /stats/online', { maxRequests: 30, windowMs: 6e4 });
    const redis = getRedis();
    if (!redis) return { count: null };
    try {
      const count3 = await countOnlineUsers(redis);
      return { count: count3 };
    } catch {
      return { count: null };
    }
  },
  {
    detail: {
      tags: ['Stats'],
      summary: 'Online users count',
      description:
        'Returns the approximate number of users active in the last 60 seconds. Returns null when Redis is unavailable.',
    },
  }
);

// apps/backend/api/src/routes/insights.ts
import { Elysia as Elysia10, t as t6 } from 'elysia';

// apps/backend/api/src/services/insights.ts
import {
  eq as eq8,
  and as and8,
  inArray as inArray4,
  asc as asc4,
  ne as ne2,
  gt as gt2,
  isNull as isNull3,
  or as or3,
} from 'drizzle-orm';

// apps/backend/api/src/analytics/queries.ts
import {
  and as and7,
  desc as desc4,
  eq as eq7,
  inArray as inArray3,
  isNotNull,
  isNull as isNull2,
  ne,
  sql as sql7,
} from 'drizzle-orm';
var META_INSIGHT_TYPE = '_meta';
async function fetchLeastRecentlyComputedUsers(limit) {
  const db = getDb();
  const rows = await db
    .select({ userId: sql7`${programInstances.userId}::text` })
    .from(programInstances)
    .innerJoin(users, eq7(users.id, programInstances.userId))
    .leftJoin(userInsights, eq7(userInsights.userId, programInstances.userId))
    .where(
      and7(inArray3(programInstances.status, ['active', 'completed']), isNull2(users.deletedAt))
    )
    .groupBy(programInstances.userId)
    .orderBy(
      sql7`max(${userInsights.computedAt}) asc nulls first`,
      sql7`${programInstances.userId}::text`
    )
    .limit(limit);
  return rows;
}
async function withInsightTransaction(userId, fn) {
  return getDb().transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and7(eq7(users.id, userId), isNull2(users.deletedAt)))
      .for('update')
      .limit(1);
    if (!user) throw new Error('Analytics user is no longer active');
    return fn(tx);
  });
}
async function fetchWorkoutRecords(userId, executor = getDb()) {
  const rows = await executor
    .select({
      userId: sql7`${programInstances.userId}::text`,
      instanceId: sql7`${programInstances.id}::text`,
      programId: programInstances.templateId,
      workoutIndex: workoutResults.workoutIndex,
      exerciseId: sql7`${workoutResults.exerciseId}`,
      definitionVersion: sql7`${workoutResults.definitionVersion}`,
      weight: sql7`(${workoutResults.setLogs} -> 0 ->> 'weight')::float`,
      result: sql7`${workoutResults.result}::text`,
      rpe: sql7`${workoutResults.rpe}::float`,
      amrapReps: workoutResults.amrapReps,
      recordedAt: sql7`coalesce(${workoutResults.completedAt}, ${workoutResults.createdAt})::text`,
    })
    .from(workoutResults)
    .innerJoin(programInstances, eq7(programInstances.id, workoutResults.instanceId))
    .where(
      and7(
        eq7(programInstances.userId, userId),
        isNotNull(workoutResults.exerciseId),
        isNotNull(workoutResults.definitionVersion),
        sql7`(${workoutResults.setLogs} -> 0 ->> 'weight') is not null`
      )
    )
    .orderBy(
      desc4(sql7`coalesce(${workoutResults.completedAt}, ${workoutResults.createdAt})`),
      desc4(workoutResults.id)
    )
    .limit(MAX_ANALYTICS_RECORDS_PER_USER);
  return rows.reverse().map((row) => ({
    userId: row.userId,
    instanceId: row.instanceId,
    programId: row.programId,
    workoutIndex: row.workoutIndex,
    exerciseId: row.exerciseId,
    definitionVersion: Number(row.definitionVersion),
    weight: Number(row.weight),
    result: row.result,
    rpe: row.rpe === null ? null : Number(row.rpe),
    amrapReps: row.amrapReps,
    recordedAt: row.recordedAt,
  }));
}
async function upsertInsight(userId, insightType, exerciseId, payload, executor = getDb()) {
  await executor
    .insert(userInsights)
    .values({ userId, insightType, exerciseId, payload, computedAt: sql7`now()` })
    .onConflictDoUpdate({
      target: [userInsights.userId, userInsights.insightType, userInsights.exerciseId],
      set: { payload, computedAt: sql7`now()` },
    });
}
async function deleteComputedInsights(userId, executor) {
  await executor
    .delete(userInsights)
    .where(and7(eq7(userInsights.userId, userId), ne(userInsights.insightType, META_INSIGHT_TYPE)));
}

// apps/backend/api/src/services/insights.ts
async function getInsights(userId, types) {
  const db = getDb();
  const conditions = [
    eq8(userInsights.userId, userId),
    ne2(userInsights.insightType, META_INSIGHT_TYPE),
    // A nullable expiry means "no expiry". Never return rows whose explicit
    // validity window has elapsed, even if a delayed compute job has not yet
    // replaced them.
    or3(isNull3(userInsights.validUntil), gt2(userInsights.validUntil, /* @__PURE__ */ new Date())),
  ];
  if (types.length > 0) {
    conditions.push(inArray4(userInsights.insightType, types));
  }
  const rows = await db
    .select({
      insightType: userInsights.insightType,
      exerciseId: userInsights.exerciseId,
      payload: userInsights.payload,
      computedAt: userInsights.computedAt,
      validUntil: userInsights.validUntil,
    })
    .from(userInsights)
    .where(and8(...conditions))
    .orderBy(asc4(userInsights.insightType), asc4(userInsights.exerciseId));
  return rows;
}

// apps/backend/api/src/lib/insight-types.ts
var INSIGHT_TYPES = ['volume_trend', 'frequency', 'plateau_detection', 'load_recommendation'];
var KNOWN = new Set(INSIGHT_TYPES);
function isKnown(value) {
  return KNOWN.has(value);
}
function parseInsightTypesQuery(raw) {
  if (raw === void 0 || raw === '') return ok([]);
  const entries = raw
    .split(',', INSIGHT_TYPES.length + 1)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const invalidValues = [];
  const validValues = [];
  for (const entry of entries) {
    if (isKnown(entry)) validValues.push(entry);
    else invalidValues.push(entry);
  }
  if (invalidValues.length > 0) return err({ invalidValues });
  return ok(validValues);
}

// apps/backend/api/src/routes/insights.ts
var security5 = [{ bearerAuth: [] }];
var MAX_INSIGHT_TYPES_QUERY_LENGTH = 256;
var insightsRoutes = new Elysia10({ prefix: '/insights' })
  .use(requestLogger)
  .use(jwtPlugin)
  .resolve(resolveUserId)
  .get(
    '/',
    async ({ userId, query }) => {
      await rateLimit(userId, 'GET /insights', { maxRequests: 30 });
      const parsed = parseInsightTypesQuery(query.types);
      if (!parsed.ok) {
        throw new ApiError(400, 'Invalid insight type', 'INVALID_INSIGHT_TYPE', {
          details: {
            invalidValues: parsed.error.invalidValues,
            validValues: INSIGHT_TYPES,
          },
        });
      }
      const rows = await getInsights(userId, parsed.value);
      return {
        data: rows.map((r) => ({
          insightType: r.insightType,
          exerciseId: r.exerciseId,
          payload: r.payload,
          computedAt: r.computedAt.toISOString(),
          validUntil: r.validUntil ? r.validUntil.toISOString() : null,
        })),
      };
    },
    {
      query: t6.Object({
        types: t6.Optional(t6.String({ maxLength: MAX_INSIGHT_TYPES_QUERY_LENGTH })),
      }),
      detail: {
        tags: ['Insights'],
        summary: 'List user insights',
        description:
          'Returns pre-computed analytics insights for the authenticated user. Optionally filter by comma-separated insight types. Valid values: volume_trend, frequency, plateau_detection, load_recommendation. Unknown types return 400 with { code: "INVALID_INSIGHT_TYPE", invalidValues, validValues }.',
        security: security5,
      },
    }
  );

// apps/backend/api/src/routes/internal.ts
import { Elysia as Elysia11 } from 'elysia';
import { createHash as createHash2, timingSafeEqual as timingSafeEqual2 } from 'node:crypto';

// apps/backend/api/src/lib/readiness.ts
import { sql as sql8 } from 'drizzle-orm';
async function checkDatabase() {
  const start = Date.now();
  try {
    await getDb().execute(sql8`SELECT 1`);
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (error) {
    logger.error({ err: error }, 'Database readiness check failed');
    return { status: 'error' };
  }
}
async function checkRedis() {
  const redis = getRedis();
  if (!redis) return { status: 'disabled' };
  const start = Date.now();
  try {
    await redis.ping();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (error) {
    logger.error({ err: error }, 'Redis readiness check failed');
    return { status: 'error' };
  }
}
async function checkReadiness() {
  const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const ready = db.status === 'ok' && redis.status !== 'error';
  return {
    status: ready ? 'ready' : 'degraded',
    timestamp: /* @__PURE__ */ new Date().toISOString(),
    db,
    redis,
  };
}

// apps/backend/api/src/lib/env-validation.ts
var MIN_INTERNAL_SECRET_LENGTH = 32;
var DEFAULT_ANALYTICS_BATCH_SIZE = 50;
var MAX_ANALYTICS_BATCH_SIZE = 100;
var REQUIRED_ENV = [
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
    aliases: ['KV_REST_API_URL'],
    description:
      'Upstash Redis REST endpoint backing presence, caches, and rate limiting via the connectionless @upstash/redis client. Mandatory in production (cold-start crash if unset); satisfied by the Vercel Upstash integration variable KV_REST_API_URL. Degrades gracefully when unset in local dev.',
    example: 'https://YOUR-DB.upstash.io',
  },
  {
    name: 'UPSTASH_REDIS_REST_TOKEN',
    service: 'api',
    requiredInProd: true,
    aliases: ['KV_REST_API_TOKEN'],
    description:
      'Upstash Redis REST token, paired with UPSTASH_REDIS_REST_URL. Mandatory in production; satisfied by the Vercel Upstash integration variable KV_REST_API_TOKEN.',
    example: '<upstash-rest-token>',
  },
  {
    name: 'INTERNAL_SECRET',
    service: 'api',
    requiredInProd: true,
    description:
      'Bearer secret guarding manual /api/internal/* operations. Must contain at least 32 characters of cryptographically random material and differ from CRON_SECRET.',
    example: '<random-32-byte-hex>',
  },
  {
    name: 'CRON_SECRET',
    service: 'api',
    requiredInProd: true,
    description:
      'Required in production. Vercel Cron injects it as Authorization Bearer credentials. Must contain at least 32 characters of cryptographically random material and differ from INTERNAL_SECRET.',
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
      'Neon DIRECT (non-pooled) connection string. Used ONLY by the build-time deploy step `pnpm --filter api db:deploy` (drizzle migrations + idempotent seeds), which must run DDL serially against a direct connection, never PgBouncer. Falls back to the Vercel/Neon integration variable DATABASE_URL_UNPOOLED, then DATABASE_URL, when unset; not consumed at request time.',
    example: 'postgresql://USER:PASSWORD@HOST.neon.tech/gravity?sslmode=require',
  },
  {
    name: 'CORS_ORIGIN',
    service: 'api',
    requiredInProd: false,
    description:
      'Allowed CORS origin (or comma-separated list); also the SPA base for post-login redirects and email action links. LEAVE EMPTY for the same-origin Vercel deployment, where trusted Vercel system env supplies the origin. Set a value only for split-origin local dev.',
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
      'Explicit local-development-only opt-in for logging full verification/reset action links. Rejected in production and ignored on Vercel.',
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
      'Set to the literal string "true" only when self-hosting behind a trusted reverse proxy. Other values, including "false", do not enable X-Forwarded-For trust. Vercel is enabled separately by VERCEL=1.',
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
      'Trusted public origin used for OAuth/OIDC redirect URIs and, in same-origin deployments, email action links. Optional on Vercel because trusted VERCEL_* system env supplies the origin. Production never derives it from request Host headers. Set it to pin the canonical/custom domain; local dev falls back to the request origin or localhost.',
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
function isPresent(value) {
  return value !== void 0 && value.trim().length > 0;
}
function requiredSpecs() {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const spec of REQUIRED_ENV) {
    if (!spec.requiredInProd) continue;
    if (seen.has(spec.name)) continue;
    seen.add(spec.name);
    out.push(spec);
  }
  return out;
}
function isSpecSatisfied(spec, env) {
  if (isPresent(env[spec.name])) return true;
  return (spec.aliases ?? []).some((alias) => isPresent(env[alias]));
}
function validateEnv(env = process.env, nodeEnv = env['NODE_ENV'] ?? 'development') {
  if (nodeEnv !== 'production') return { ok: true };
  const missing = [];
  const errors = [];
  for (const spec of requiredSpecs()) {
    if (!isSpecSatisfied(spec, env)) missing.push(spec.name);
  }
  const jwt2 = env['JWT_SECRET'];
  if (isPresent(jwt2) && jwt2.length < 64) {
    errors.push(`JWT_SECRET must be at least 64 characters in production (got ${jwt2.length})`);
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
function formatValidationError(result) {
  const lines = ['Environment validation failed for NODE_ENV=production:'];
  if (result.missing.length > 0) {
    lines.push('', 'Missing required env vars:');
    for (const name of result.missing) {
      const spec = REQUIRED_ENV.find((s) => s.name === name && s.requiredInProd);
      lines.push(`  - ${name}${spec ? ` \u2014 ${spec.description}` : ''}`);
    }
  }
  if (result.errors.length > 0) {
    lines.push('', 'Constraint violations:');
    for (const err2 of result.errors) lines.push(`  - ${err2}`);
  }
  return lines.join('\n');
}

// apps/backend/api/src/services/purge.ts
import {
  lt as lt3,
  and as and9,
  isNotNull as isNotNull2,
  asc as asc5,
  inArray as inArray5,
  eq as eq9,
} from 'drizzle-orm';
var PURGE_AFTER_DAYS = 30;
var PURGE_BATCH_SIZE = 500;
var PURGE_CUTOFF_MS = PURGE_AFTER_DAYS * 24 * 60 * 60 * 1e3;
async function purgeDeletedUsers() {
  const cutoff = new Date(Date.now() - PURGE_CUTOFF_MS);
  const { deleted, deletedExercises } = await getDb().transaction(async (tx) => {
    const candidates = await tx
      .select({ id: users.id })
      .from(users)
      .where(and9(isNotNull2(users.deletedAt), lt3(users.deletedAt, cutoff)))
      .orderBy(asc5(users.deletedAt), asc5(users.id))
      .limit(PURGE_BATCH_SIZE)
      .for('update', { skipLocked: true });
    if (candidates.length === 0) {
      return { deleted: [], deletedExercises: [] };
    }
    const userIds = candidates.map(({ id }) => id);
    const deletedExercises2 = await tx
      .delete(exercises)
      .where(and9(inArray5(exercises.createdByUserId, userIds), eq9(exercises.isSystem, false)))
      .returning({ id: exercises.id });
    const deleted2 = await tx
      .delete(users)
      .where(inArray5(users.id, userIds))
      .returning({ id: users.id });
    return { deleted: deleted2, deletedExercises: deletedExercises2 };
  });
  logger.info(
    {
      purged: deleted.length,
      customExercisesPurged: deletedExercises.length,
      cutoff: cutoff.toISOString(),
      batchSize: PURGE_BATCH_SIZE,
    },
    'purge: hard-deleted soft-deleted users past grace window'
  );
  return { purged: deleted.length, cutoff: cutoff.toISOString() };
}

// apps/backend/api/src/analytics/iso-week.ts
import { getISOWeek, getISOWeekYear } from 'date-fns';
function isoWeekKey(date) {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
function parseWallClockDate(timestamp2) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(timestamp2);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}
function isoWeekKeyFromTimestamp(timestamp2) {
  const date = parseWallClockDate(timestamp2);
  if (date === null) return null;
  return isoWeekKey(date);
}

// apps/backend/api/src/analytics/pipelines/round.ts
function pyRound(value, ndigits) {
  if (!Number.isFinite(value)) return value;
  const negative = value < 0 || Object.is(value, -0);
  const precision = Math.min(100, Math.max(0, ndigits) + 20);
  const fixed = Math.abs(value).toFixed(precision);
  const rounded = roundHalfToEvenDecimal(fixed, ndigits);
  const result = Number(rounded);
  return negative ? -result : result;
}
function roundHalfToEvenDecimal(s, ndigits) {
  const [intPart, fracPart = ''] = s.split('.');
  if (ndigits >= fracPart.length) return s;
  const keptFrac = fracPart.slice(0, ndigits);
  const dropped = fracPart.slice(ndigits);
  const digits = (intPart + keptFrac).split('');
  const firstDropped = dropped.charAt(0);
  let roundUp;
  if (firstDropped > '5') {
    roundUp = true;
  } else if (firstDropped < '5') {
    roundUp = false;
  } else if (/[1-9]/.test(dropped.slice(1))) {
    roundUp = true;
  } else {
    const lastKept = digits[digits.length - 1] ?? '0';
    roundUp = (lastKept.charCodeAt(0) - 48) % 2 === 1;
  }
  if (roundUp) {
    let i = digits.length - 1;
    for (; i >= 0; i--) {
      const d = digits[i] ?? '0';
      if (d === '9') {
        digits[i] = '0';
      } else {
        digits[i] = String.fromCharCode(d.charCodeAt(0) + 1);
        break;
      }
    }
    if (i < 0) digits.unshift('1');
  }
  const intLen = digits.length - ndigits;
  const newInt = digits.slice(0, intLen).join('');
  const newFrac = digits.slice(intLen).join('');
  return ndigits > 0 ? `${newInt}.${newFrac}` : newInt;
}

// apps/backend/api/src/analytics/pipelines/volume.ts
var DEFAULT_REPS = 5;
function computeVolume(records) {
  const weekly = /* @__PURE__ */ new Map();
  for (const r of records) {
    if (r.result !== 'success') continue;
    const reps = r.amrapReps && r.amrapReps > 0 ? r.amrapReps : DEFAULT_REPS;
    const volume = r.weight * reps;
    if (r.recordedAt === null) continue;
    const weekKey = isoWeekKeyFromTimestamp(r.recordedAt);
    if (weekKey === null) continue;
    weekly.set(weekKey, (weekly.get(weekKey) ?? 0) + volume);
  }
  if (weekly.size < 3) return null;
  const weeks = [...weekly.keys()].sort();
  const volumes = weeks.map((w) => weekly.get(w) ?? 0);
  const slope = linearSlope(volumes);
  const direction = slope > 0.5 ? 'up' : slope < -0.5 ? 'down' : 'flat';
  return {
    weeks,
    volumes,
    slope: pyRound(slope, 2),
    direction,
  };
}
function linearSlope(values) {
  const n = values.length;
  if (n < 2) return 0;
  let xMean = 0;
  let yMean = 0;
  for (let i = 0; i < n; i++) {
    xMean += i;
    yMean += values[i];
  }
  xMean /= n;
  yMean /= n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den !== 0 ? num / den : 0;
}

// apps/backend/api/src/analytics/pipelines/time.ts
var MS_PER_DAY = 864e5;
function parseInstant(timestamp2) {
  let s = timestamp2.trim();
  if (!s.includes('T') && s.includes(' ')) {
    s = s.replace(' ', 'T');
  }
  s = s.replace('Z', '+00:00');
  s = s.replace(/([+-]\d{2})$/, '$1:00');
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms);
}
function wallClockDateKey(timestamp2) {
  const date = parseWallClockDate(timestamp2);
  if (date === null) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function daysBetweenDateKeys(a, b) {
  return Math.round((midnightUtc(b) - midnightUtc(a)) / MS_PER_DAY);
}
function shiftDateKey(key, deltaDays) {
  const shifted = new Date(midnightUtc(key) + deltaDays * MS_PER_DAY);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function midnightUtc(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

// apps/backend/api/src/analytics/pipelines/frequency.ts
function computeFrequency(records) {
  const dates = /* @__PURE__ */ new Set();
  for (const r of records) {
    if (r.recordedAt === null) continue;
    const key = wallClockDateKey(r.recordedAt);
    if (key !== null) dates.add(key);
  }
  if (dates.size < 3) return null;
  const sortedDates = [...dates].sort();
  const first = sortedDates[0];
  const last = sortedDates[sortedDates.length - 1];
  const totalWeeks = Math.max(1, daysBetweenDateKeys(first, last) / 7);
  const sessionsPerWeek = pyRound(sortedDates.length / totalWeeks, 2);
  const streak = currentStreak(sortedDates);
  const consistencyPct = consistencyPercentage(sortedDates, first, last);
  const workoutDates = sortedDates.length > 28 ? sortedDates.slice(-28) : sortedDates;
  return {
    sessionsPerWeek,
    currentStreak: streak,
    consistencyPct,
    totalSessions: sortedDates.length,
    workoutDates,
  };
}
function currentStreak(sortedDateKeys) {
  if (sortedDateKeys.length === 0) return 0;
  const present = new Set(sortedDateKeys);
  let streak = 0;
  let cursor = sortedDateKeys[sortedDateKeys.length - 1];
  while (present.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}
function consistencyPercentage(sortedDateKeys, first, last) {
  const totalWeeks = Math.max(1, Math.floor((daysBetweenDateKeys(first, last) + 1) / 7));
  const weeksWithSession = /* @__PURE__ */ new Set();
  for (const key of sortedDateKeys) {
    const weekKey = isoWeekKeyFromTimestamp(key);
    if (weekKey !== null) weeksWithSession.add(weekKey);
  }
  return pyRound(Math.min(100, (weeksWithSession.size / totalWeeks) * 100), 1);
}

// apps/backend/api/src/analytics/epley.ts
function epley(weight, reps) {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

// apps/backend/api/src/analytics/pipelines/sort.ts
function compareByRecordedAtThenIndex(a, b) {
  const ar = a.recordedAt ?? '';
  const br = b.recordedAt ?? '';
  if (ar < br) return -1;
  if (ar > br) return 1;
  return a.workoutIndex - b.workoutIndex;
}

// apps/backend/api/src/analytics/pipelines/e1rm.ts
var MIN_POINTS = 4;
var DEFAULT_REPS2 = 5;
function computeE1rmPerExercise(records) {
  const bySlot = /* @__PURE__ */ new Map();
  for (const r of records) {
    if (r.result !== 'success') continue;
    const slot = bySlot.get(r.exerciseId) ?? [];
    slot.push(r);
    bySlot.set(r.exerciseId, slot);
  }
  const result = /* @__PURE__ */ new Map();
  for (const [exerciseId, exerciseRecords] of bySlot) {
    const payload = buildSeries(exerciseRecords);
    if (payload !== null) result.set(exerciseId, payload);
  }
  return result;
}
function buildSeries(records) {
  if (records.length < MIN_POINTS) return null;
  const sorted = [...records].sort(compareByRecordedAtThenIndex);
  const dates = [];
  const e1rms = [];
  for (const r of sorted) {
    const reps = r.amrapReps && r.amrapReps > 0 ? r.amrapReps : DEFAULT_REPS2;
    dates.push(formatDate(r.recordedAt, r.workoutIndex));
    e1rms.push(pyRound(epley(r.weight, reps), 1));
  }
  return {
    dates,
    e1rms,
    currentMax: Math.max(...e1rms),
  };
}
function formatDate(timestamp2, workoutIndex) {
  if (timestamp2 !== null) {
    const key = wallClockDateKey(timestamp2);
    if (key !== null) return key;
  }
  return `#${workoutIndex + 1}`;
}

// apps/backend/api/src/analytics/pipelines/summary.ts
var DEFAULT_REPS3 = 5;
function computeSummaryPerExercise(records) {
  const bySlot = /* @__PURE__ */ new Map();
  for (const r of records) {
    const slot = bySlot.get(r.exerciseId) ?? [];
    slot.push(r);
    bySlot.set(r.exerciseId, slot);
  }
  const result = /* @__PURE__ */ new Map();
  for (const [exerciseId, exerciseRecords] of bySlot) {
    result.set(exerciseId, summarise(exerciseRecords));
  }
  return result;
}
function summarise(records) {
  const totalSets = records.length;
  let successSets = 0;
  let totalVolume = 0;
  const rpeValues = [];
  for (const r of records) {
    if (r.result === 'success') {
      successSets += 1;
      const reps = r.amrapReps && r.amrapReps > 0 ? r.amrapReps : DEFAULT_REPS3;
      totalVolume += r.weight * reps;
    }
    if (r.rpe !== null) rpeValues.push(r.rpe);
  }
  const successRate = totalSets ? pyRound((successSets / totalSets) * 100, 1) : 0;
  const avgRpe =
    rpeValues.length > 0
      ? pyRound(rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length, 1)
      : null;
  return {
    totalSets,
    successSets,
    successRate,
    totalVolume: pyRound(totalVolume, 1),
    avgRpe,
  };
}

// apps/backend/api/src/analytics/stats.ts
var LANCZOS_G = 7;
var LANCZOS_COEF = [
  0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406,
  12.507343278686905, -0.13857109526572012, 9984369578019572e-21, 15056327351493116e-23,
];
function logGamma(x) {
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const z3 = x - 1;
  let a = LANCZOS_COEF[0];
  const t7 = z3 + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS_G + 2; i++) {
    a += LANCZOS_COEF[i] / (z3 + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (z3 + 0.5) * Math.log(t7) - t7 + Math.log(a);
}
var BETACF_MAXIT = 300;
var BETACF_EPS = 3e-14;
var BETACF_FPMIN = 1e-300;
function betaContinuedFraction(a, b, x) {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < BETACF_FPMIN) d = BETACF_FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= BETACF_MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < BETACF_FPMIN) d = BETACF_FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < BETACF_FPMIN) c = BETACF_FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < BETACF_FPMIN) d = BETACF_FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < BETACF_FPMIN) c = BETACF_FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < BETACF_EPS) break;
  }
  return h;
}
function regularizedIncompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const front = Math.exp(lbeta);
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}
function studentTCdf(t7, df) {
  if (!Number.isFinite(t7)) return t7 > 0 ? 1 : 0;
  if (df <= 0) return Number.NaN;
  const x = df / (df + t7 * t7);
  const half = 0.5 * regularizedIncompleteBeta(x, df / 2, 0.5);
  return t7 > 0 ? 1 - half : half;
}
function studentTQuantile(p, df) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  if (df <= 0) return Number.NaN;
  const upper = p > 0.5;
  const target = upper ? p : 1 - p;
  let lo = 0;
  let hi = 1;
  while (studentTCdf(hi, df) < target && hi < 1e12) {
    hi *= 2;
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (studentTCdf(mid, df) < target) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const t7 = (lo + hi) / 2;
  return upper ? t7 : -t7;
}
var LINREGRESS_TINY = 1e-20;
function linregress(x, y) {
  const n = x.length;
  if (n !== y.length) {
    throw new Error(`linregress: x and y length mismatch (${n} vs ${y.length})`);
  }
  if (n < 2) {
    throw new Error('linregress: need at least two points');
  }
  let xMean = 0;
  let yMean = 0;
  for (let i = 0; i < n; i++) {
    xMean += x[i];
    yMean += y[i];
  }
  xMean /= n;
  yMean /= n;
  let ssxm = 0;
  let ssym = 0;
  let ssxym = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - xMean;
    const dy = y[i] - yMean;
    ssxm += dx * dx;
    ssym += dy * dy;
    ssxym += dx * dy;
  }
  ssxm /= n;
  ssym /= n;
  ssxym /= n;
  const slope = ssxm === 0 ? Number.NaN : ssxym / ssxm;
  const intercept = yMean - slope * xMean;
  const rDen = Math.sqrt(ssxm * ssym);
  let r;
  if (rDen === 0) {
    r = 0;
  } else {
    r = ssxym / rDen;
    if (r > 1) r = 1;
    else if (r < -1) r = -1;
  }
  let pValue;
  let stderr;
  if (n === 2) {
    pValue = 1;
    stderr = 0;
  } else {
    const df = n - 2;
    const t7 = r * Math.sqrt(df / ((1 - r + LINREGRESS_TINY) * (1 + r + LINREGRESS_TINY)));
    pValue = 2 * studentTCdf(-Math.abs(t7), df);
    stderr = Math.sqrt(((1 - r * r) * ssym) / ssxm / df);
  }
  return { slope, intercept, rValue: r, rSquared: r * r, pValue, stderr, n };
}

// apps/backend/api/src/analytics/pipelines/plateau.ts
var MIN_POINTS2 = 8;
var WEEKS_BACK = 8;
var PLATEAU_SLOPE_THRESHOLD = 0.1;
var PLATEAU_PVALUE_THRESHOLD = 0.1;
var MAX_CONFIDENCE = 0.95;
var MS_PER_WEEK = 7 * 864e5;
function computePlateauPerExercise(records) {
  const cutoff = Date.now() - WEEKS_BACK * MS_PER_WEEK;
  const bySlot = /* @__PURE__ */ new Map();
  for (const r of records) {
    if (r.result !== 'success' || r.recordedAt === null) continue;
    const instant = parseInstant(r.recordedAt);
    if (instant === null || instant.getTime() < cutoff) continue;
    const slot = bySlot.get(r.exerciseId) ?? [];
    slot.push(r);
    bySlot.set(r.exerciseId, slot);
  }
  const result = /* @__PURE__ */ new Map();
  for (const [exerciseId, exerciseRecords] of bySlot) {
    const payload = analyzeSlot(exerciseRecords);
    if (payload !== null) result.set(exerciseId, payload);
  }
  return result;
}
function analyzeSlot(records) {
  if (records.length < MIN_POINTS2) return null;
  const byWeek = /* @__PURE__ */ new Map();
  for (const r of records) {
    if (r.recordedAt === null) continue;
    const weekKey = isoWeekKeyFromTimestamp(r.recordedAt);
    if (weekKey === null) continue;
    const bucket = byWeek.get(weekKey) ?? [];
    bucket.push(r.weight);
    byWeek.set(weekKey, bucket);
  }
  if (byWeek.size < 2) return null;
  const weeks = [...byWeek.keys()].sort();
  const weights = weeks.map((w) => Math.max(...(byWeek.get(w) ?? [])));
  const xs = weeks.map((_, i) => i);
  const reg = linregress(xs, weights);
  const slope = reg.slope;
  const degenerate = slope === 0 && populationStd(weights) === 0;
  const pValue = degenerate ? 0 : reg.pValue;
  const rSquared = degenerate ? 0 : reg.rSquared;
  const isPlateau =
    slope < PLATEAU_SLOPE_THRESHOLD && (degenerate || pValue > PLATEAU_PVALUE_THRESHOLD);
  let confidence;
  if (!isPlateau) {
    confidence = 0;
  } else if (degenerate) {
    confidence = MAX_CONFIDENCE;
  } else {
    confidence = Math.min(1 - pValue, MAX_CONFIDENCE);
  }
  return {
    isPlateauing: isPlateau,
    confidence: pyRound(confidence, 3),
    slope: pyRound(slope, 3),
    pValue: pyRound(pValue, 4),
    rSquared: pyRound(rSquared, 3),
    weeksAnalyzed: weeks.length,
    currentWeight: weights[weights.length - 1],
  };
}
function populationStd(values) {
  const n = values.length;
  let mean = 0;
  for (const v of values) mean += v;
  mean /= n;
  let sumSq = 0;
  for (const v of values) {
    const d = v - mean;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / n);
}

// apps/backend/api/src/analytics/pipelines/forecast.ts
var MIN_WEEKS = 6;
var R2_THRESHOLD = 0.5;
var DEFAULT_REPS4 = 5;
var FALLBACK_T_CRIT = 1.96;
function computeForecastPerExercise(records) {
  const bySlot = /* @__PURE__ */ new Map();
  for (const r of records) {
    if (r.result !== 'success') continue;
    const slot = bySlot.get(r.exerciseId) ?? [];
    slot.push(r);
    bySlot.set(r.exerciseId, slot);
  }
  const result = /* @__PURE__ */ new Map();
  for (const [exerciseId, exerciseRecords] of bySlot) {
    const payload = forecastSlot(exerciseRecords);
    if (payload !== null) result.set(exerciseId, payload);
  }
  return result;
}
function forecastSlot(records) {
  const byWeek = /* @__PURE__ */ new Map();
  for (const r of records) {
    if (r.recordedAt === null) continue;
    if (parseInstant(r.recordedAt) === null) continue;
    const weekKey = isoWeekKeyFromTimestamp(r.recordedAt);
    if (weekKey === null) continue;
    const reps = r.amrapReps && r.amrapReps > 0 ? r.amrapReps : DEFAULT_REPS4;
    const bucket = byWeek.get(weekKey) ?? [];
    bucket.push(epley(r.weight, reps));
    byWeek.set(weekKey, bucket);
  }
  if (byWeek.size < MIN_WEEKS) return null;
  const weeks = [...byWeek.keys()].sort().slice(-16);
  const e1rms = weeks.map((w) => Math.max(...(byWeek.get(w) ?? [])));
  const n = weeks.length;
  const xs = weeks.map((_, i) => i);
  const reg = linregress(xs, e1rms);
  const rSquared = reg.rSquared;
  if (rSquared < R2_THRESHOLD) return null;
  const { slope, intercept } = reg;
  if (!Number.isFinite(slope) || !Number.isFinite(intercept)) return null;
  const forecast2w = intercept + slope * (n + 1);
  const forecast4w = intercept + slope * (n + 3);
  let xMean = 0;
  for (const x of xs) xMean += x;
  xMean /= n;
  let ssxx = 0;
  for (const x of xs) ssxx += (x - xMean) ** 2;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const resid = e1rms[i] - (intercept + slope * xs[i]);
    sse += resid * resid;
  }
  const mse = n > 2 ? sse / (n - 2) : 0;
  const tCrit = n > 2 ? studentTQuantile(0.975, n - 2) : FALLBACK_T_CRIT;
  const band = (xNew) => {
    if (ssxx === 0 || mse === 0) return 0;
    const sePred = Math.sqrt(mse * (1 + 1 / n + (xNew - xMean) ** 2 / ssxx));
    return tCrit * sePred;
  };
  return {
    weeks,
    e1rms: e1rms.map((v) => pyRound(v, 1)),
    slope: pyRound(slope, 3),
    rSquared: pyRound(rSquared, 3),
    forecast2w: pyRound(Math.max(forecast2w, 0), 1),
    forecast4w: pyRound(Math.max(forecast4w, 0), 1),
    band2w: pyRound(band(n + 1), 1),
    band4w: pyRound(band(n + 3), 1),
  };
}

// apps/backend/api/src/analytics/logistic.ts
var DEFAULT_C = 1;
var DEFAULT_MAX_ITER = 200;
var DEFAULT_TOL = 1e-10;
function sigmoid(z3) {
  if (z3 >= 0) {
    return 1 / (1 + Math.exp(-z3));
  }
  const e = Math.exp(z3);
  return e / (1 + e);
}
function distinctClassCount(y) {
  return new Set(y).size;
}
function standardizeColumns(X) {
  const n = X.length;
  if (n === 0) {
    return { scaled: [], mean: [], std: [] };
  }
  const d = X[0].length;
  const mean = new Array(d).fill(0);
  for (const row of X) {
    for (let j = 0; j < d; j++) mean[j] += row[j];
  }
  for (let j = 0; j < d; j++) mean[j] /= n;
  const std = new Array(d).fill(0);
  for (const row of X) {
    for (let j = 0; j < d; j++) {
      const dj = row[j] - mean[j];
      std[j] += dj * dj;
    }
  }
  for (let j = 0; j < d; j++) {
    std[j] = Math.sqrt(std[j] / n);
    if (std[j] === 0) std[j] = 1;
  }
  const scaled = X.map((row) => row.map((v, j) => (v - mean[j]) / std[j]));
  return { scaled, mean, std };
}
function applyStandardization(x, s) {
  return x.map((v, j) => (v - s.mean[j]) / s.std[j]);
}
function linearScore(beta, row, d) {
  let eta = beta[d];
  for (let j = 0; j < d; j++) eta += beta[j] * row[j];
  return eta;
}
function accumulateSample(g, H, row, d, size, resid, w) {
  for (let j = 0; j < size; j++) {
    const aj = j < d ? row[j] : 1;
    g[j] += resid * aj;
    const Hj = H[j];
    for (let k = j; k < size; k++) {
      const ak = k < d ? row[k] : 1;
      Hj[k] += w * aj * ak;
    }
  }
}
function mirrorUpperTriangle(H, size) {
  for (let j = 0; j < size; j++) {
    for (let k = j + 1; k < size; k++) {
      H[k][j] = H[j][k];
    }
  }
}
function buildGradientHessian(X, y, beta, d, size, lambda) {
  const g = new Array(size).fill(0);
  const H = Array.from({ length: size }, () => new Array(size).fill(0));
  for (let i = 0; i < X.length; i++) {
    const row = X[i];
    const p = sigmoid(linearScore(beta, row, d));
    accumulateSample(g, H, row, d, size, p - y[i], p * (1 - p));
  }
  for (let j = 0; j < d; j++) {
    g[j] += lambda * beta[j];
    H[j][j] += lambda;
  }
  mirrorUpperTriangle(H, size);
  return { g, H };
}
function pivotRowFor(A, col, size) {
  let pivotRow = col;
  let pivotMag = Math.abs(A[col][col]);
  for (let r = col + 1; r < size; r++) {
    const mag = Math.abs(A[r][col]);
    if (mag > pivotMag) {
      pivotMag = mag;
      pivotRow = r;
    }
  }
  return pivotRow;
}
function eliminateColumn(A, b, col, size) {
  const pivot = A[col][col];
  if (pivot === 0) return;
  for (let r = col + 1; r < size; r++) {
    const factor = A[r][col] / pivot;
    if (factor === 0) continue;
    const Ar = A[r];
    const Acol = A[col];
    for (let c = col; c < size; c++) Ar[c] -= factor * Acol[c];
    b[r] -= factor * b[col];
  }
}
function solveLinearSystem(A, b, size) {
  for (let col = 0; col < size; col++) {
    const pivotRow = pivotRowFor(A, col, size);
    if (pivotRow !== col) {
      const tmpA = A[col];
      A[col] = A[pivotRow];
      A[pivotRow] = tmpA;
      const tmpB = b[col];
      b[col] = b[pivotRow];
      b[pivotRow] = tmpB;
    }
    eliminateColumn(A, b, col, size);
  }
  const z3 = new Array(size).fill(0);
  for (let i = size - 1; i >= 0; i--) {
    let sum = b[i];
    for (let c = i + 1; c < size; c++) sum -= A[i][c] * z3[c];
    const diag = A[i][i];
    z3[i] = diag === 0 ? 0 : sum / diag;
  }
  return z3;
}
function fitLogisticRegression(X, y, options = {}) {
  const C = options.C ?? DEFAULT_C;
  const maxIter = options.maxIter ?? DEFAULT_MAX_ITER;
  const tol = options.tol ?? DEFAULT_TOL;
  const n = X.length;
  if (n === 0) throw new Error('fitLogisticRegression: empty training set');
  const d = X[0].length;
  const size = d + 1;
  const lambda = 1 / C;
  const beta = new Array(size).fill(0);
  let iterations = 0;
  let converged = false;
  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    const { g, H } = buildGradientHessian(X, y, beta, d, size, lambda);
    const delta = solveLinearSystem(H, g, size);
    let maxStep = 0;
    for (let j = 0; j < size; j++) {
      beta[j] -= delta[j];
      const mag = Math.abs(delta[j]);
      if (mag > maxStep) maxStep = mag;
    }
    if (maxStep < tol) {
      converged = true;
      break;
    }
  }
  return {
    weights: beta.slice(0, d),
    intercept: beta[d],
    iterations,
    converged,
  };
}
function predictProba(model, x) {
  let z3 = model.intercept;
  for (let j = 0; j < model.weights.length; j++) {
    z3 += model.weights[j] * x[j];
  }
  return sigmoid(z3);
}
function standardizeTrainPredict(X, y, queries, options = {}) {
  const { scaled, mean, std } = standardizeColumns(X);
  const standardization = { mean, std };
  const model = fitLogisticRegression(scaled, y, options);
  const probabilities = queries.map((q) =>
    predictProba(model, applyStandardization(q, standardization))
  );
  return { model, standardization, probabilities };
}

// apps/backend/api/src/analytics/pipelines/recommendation.ts
var MIN_RPE_SESSIONS = 10;
var SUCCESS_PROB_THRESHOLD = 0.7;
var INCREMENT_KG = 2.5;
var DEFAULT_REPS5 = 5;
var MS_PER_WEEK2 = 7 * 864e5;
var MS_PER_DAY2 = 864e5;
function computeRecommendationPerExercise(records) {
  const bySlot = /* @__PURE__ */ new Map();
  for (const r of records) {
    const slot = bySlot.get(r.exerciseId) ?? [];
    slot.push(r);
    bySlot.set(r.exerciseId, slot);
  }
  const result = /* @__PURE__ */ new Map();
  for (const [exerciseId, exerciseRecords] of bySlot) {
    const payload = recommendSlot(exerciseRecords);
    if (payload !== null) result.set(exerciseId, payload);
  }
  return result;
}
function recommendSlot(records) {
  if (records.length === 0) return null;
  const sorted = [...records].sort(compareByRecordedAtThenIndex);
  const currentWeight = sorted[sorted.length - 1].weight;
  const currentDate = sorted[sorted.length - 1].recordedAt;
  const rpeRecords = sorted.filter((r) => r.rpe !== null);
  if (rpeRecords.length >= MIN_RPE_SESSIONS) {
    return mlRecommendation(sorted, rpeRecords, currentWeight, currentDate);
  }
  return fallbackRecommendation(sorted, currentWeight);
}
function mlRecommendation(allRecords, rpeRecords, currentWeight, currentDate) {
  const weightOutcomes = /* @__PURE__ */ new Map();
  for (const r of allRecords) {
    const bucket = weightOutcomes.get(r.weight) ?? [];
    bucket.push(r.result === 'success' ? 1 : 0);
    weightOutcomes.set(r.weight, bucket);
  }
  const successRate = (w) => {
    const outcomes = weightOutcomes.get(w);
    if (!outcomes || outcomes.length === 0) return 0.5;
    return outcomes.reduce((a, b) => a + b, 0) / outcomes.length;
  };
  const volumeLastWeek = volumeForDate(allRecords, currentDate);
  const daysSince = daysSinceLast(allRecords, currentDate);
  const features = [];
  const labels = [];
  for (const r of rpeRecords) {
    features.push([
      r.weight,
      successRate(r.weight),
      r.rpe ?? 0,
      volumeForDate(allRecords, r.recordedAt),
      daysSinceFor(allRecords, r.recordedAt),
    ]);
    labels.push(r.result === 'success' ? 1 : 0);
  }
  if (distinctClassCount(labels) < 2) {
    return fallbackRecommendation(allRecords, currentWeight);
  }
  const srCurrent = successRate(currentWeight);
  const srNext = successRate(currentWeight + INCREMENT_KG);
  const xCurrent = [currentWeight, srCurrent, 5, volumeLastWeek, daysSince];
  const xNext = [currentWeight + INCREMENT_KG, srNext, 5, volumeLastWeek, daysSince];
  const { probabilities } = standardizeTrainPredict(features, labels, [xCurrent, xNext]);
  const probCurrent = probabilities[0];
  const probNext = probabilities[1];
  const recommend = probNext >= SUCCESS_PROB_THRESHOLD;
  const recommendedWeight = recommend ? currentWeight + INCREMENT_KG : currentWeight;
  const confidence = recommend ? probNext : probCurrent;
  return {
    currentWeight,
    recommendedWeight,
    shouldIncrement: recommend,
    confidence: pyRound(Math.min(confidence, 0.99), 3),
    method: 'logistic_regression',
  };
}
function fallbackRecommendation(records, currentWeight) {
  const lastThree = records.slice(-3);
  const allSuccess = lastThree.length >= 3 && lastThree.every((r) => r.result === 'success');
  return {
    currentWeight,
    recommendedWeight: allSuccess ? currentWeight + INCREMENT_KG : currentWeight,
    shouldIncrement: allSuccess,
    confidence: allSuccess ? 0.7 : 0.5,
    method: 'consecutive_success',
  };
}
function volumeForDate(records, refDate) {
  if (!refDate) return 0;
  const ref = parseInstant(refDate);
  if (ref === null) return 0;
  return volumeInWindow(records, new Date(ref.getTime() - MS_PER_WEEK2), ref);
}
function volumeInWindow(records, start, end) {
  let total = 0;
  for (const r of records) {
    if (r.recordedAt === null || r.result !== 'success') continue;
    const dt = parseInstant(r.recordedAt);
    if (dt === null) continue;
    if (dt >= start && dt < end) {
      const reps = r.amrapReps && r.amrapReps > 0 ? r.amrapReps : DEFAULT_REPS5;
      total += r.weight * reps;
    }
  }
  return total;
}
function daysSinceLast(records, currentDate) {
  if (!currentDate) return 7;
  const now = parseInstant(currentDate);
  if (now === null) return 7;
  for (let i = records.length - 2; i >= 0; i--) {
    const dt = parseValidInstant(records[i]);
    if (dt === null) continue;
    return Math.max(0, Math.floor((now.getTime() - dt.getTime()) / MS_PER_DAY2));
  }
  return 7;
}
function daysSinceFor(records, refDate) {
  if (!refDate) return 7;
  const ref = parseInstant(refDate);
  if (ref === null) return 7;
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (r.recordedAt === null || r.recordedAt >= refDate) continue;
    const dt = parseInstant(r.recordedAt);
    if (dt === null) continue;
    return Math.max(0, Math.floor((ref.getTime() - dt.getTime()) / MS_PER_DAY2));
  }
  return 7;
}
function parseValidInstant(record) {
  if (record.recordedAt === null) return null;
  return parseInstant(record.recordedAt);
}

// apps/backend/api/src/analytics/compute.ts
async function computeUser(userId) {
  await withInsightTransaction(userId, async (tx) => {
    const records = await fetchWorkoutRecords(userId, tx);
    await deleteComputedInsights(userId, tx);
    if (records.length > 0) {
      const volume = computeVolume(records);
      if (volume !== null) await upsertInsight(userId, 'volume_trend', null, volume, tx);
      const frequency = computeFrequency(records);
      if (frequency !== null) await upsertInsight(userId, 'frequency', null, frequency, tx);
      for (const [exerciseId, payload] of computeE1rmPerExercise(records)) {
        await upsertInsight(userId, 'e1rm_progression', exerciseId, payload, tx);
      }
      for (const [exerciseId, payload] of computeSummaryPerExercise(records)) {
        await upsertInsight(userId, 'exercise_summary', exerciseId, payload, tx);
      }
      for (const [exerciseId, payload] of computePlateauPerExercise(records)) {
        await upsertInsight(userId, 'plateau_detection', exerciseId, payload, tx);
      }
      for (const [exerciseId, payload] of computeForecastPerExercise(records)) {
        await upsertInsight(userId, 'e1rm_forecast', exerciseId, payload, tx);
      }
      for (const [exerciseId, payload] of computeRecommendationPerExercise(records)) {
        await upsertInsight(userId, 'load_recommendation', exerciseId, payload, tx);
      }
    }
    await upsertInsight(userId, META_INSIGHT_TYPE, null, {}, tx);
  });
}

// apps/backend/api/src/routes/internal.ts
var INTERNAL_RATE_LIMIT = { windowMs: 6e4, maxRequests: 30, failClosed: true };
function safeEqual(a, b) {
  const aDigest = createHash2('sha256').update(a, 'utf8').digest();
  const bDigest = createHash2('sha256').update(b, 'utf8').digest();
  return timingSafeEqual2(aDigest, bDigest);
}
function extractPresentedSecret(headers) {
  const auth = headers.get('authorization');
  if (auth) {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (match?.[1]) return match[1];
  }
  return headers.get('x-internal-secret') ?? void 0;
}
function assertInternalSecret(headers) {
  const internalSecret = normalizeSecret(process.env['INTERNAL_SECRET']);
  const cronSecret = normalizeSecret(process.env['CRON_SECRET']);
  if (!internalSecret && !cronSecret) {
    logger.error(
      'internal route rejected: neither INTERNAL_SECRET nor CRON_SECRET is configured (fail closed)'
    );
    throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');
  }
  const presented = extractPresentedSecret(headers);
  const matches =
    presented !== void 0 &&
    presented.length > 0 &&
    ((internalSecret !== void 0 && safeEqual(presented, internalSecret)) ||
      (cronSecret !== void 0 && safeEqual(presented, cronSecret)));
  if (!matches) {
    throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');
  }
}
function normalizeSecret(raw) {
  if (raw === void 0) return void 0;
  return raw.trim().length > 0 ? raw : void 0;
}
function resolveBatchSize() {
  const raw = Number(process.env['ANALYTICS_BATCH_SIZE']);
  if (!Number.isInteger(raw) || raw < 1) return DEFAULT_ANALYTICS_BATCH_SIZE;
  return Math.min(raw, MAX_ANALYTICS_BATCH_SIZE);
}
async function readinessHandler() {
  const result = await checkReadiness();
  if (result.status !== 'ready') {
    throw new ApiError(503, 'Service dependencies are unavailable', 'NOT_READY');
  }
  return result;
}
async function cleanupTokensHandler() {
  const deleted = await cleanupExpiredTokens();
  logger.info({ deleted }, 'internal: cleaned up expired authentication tokens');
  return { deleted };
}
async function purgeUsersHandler() {
  return purgeDeletedUsers();
}
async function analyticsComputeHandler() {
  const batchSize = resolveBatchSize();
  const users2 = await fetchLeastRecentlyComputedUsers(batchSize);
  let processed = 0;
  let errors = 0;
  for (const user of users2) {
    try {
      await computeUser(user.userId);
      processed += 1;
    } catch (error) {
      logger.error({ err: error, userId: user.userId }, 'internal: analytics compute failed');
      errors += 1;
    }
  }
  logger.info({ processed, errors, batchSize }, 'internal: analytics compute batch done');
  return { processed, errors, batchSize };
}
async function maintenanceHandler() {
  const [tokens, users2] = await Promise.all([cleanupTokensHandler(), purgeUsersHandler()]);
  logger.info({ tokens, users: users2 }, 'internal: daily maintenance done');
  return { tokens, users: users2 };
}
var internalRoutes = new Elysia11({ prefix: '/internal' })
  .use(requestLogger)
  .onBeforeHandle(async ({ request, ip }) => {
    await rateLimit(ip, 'INTERNAL /api/internal/*', INTERNAL_RATE_LIMIT);
    assertInternalSecret(request.headers);
  })
  .get('/readiness', readinessHandler)
  .get('/cleanup-tokens', cleanupTokensHandler)
  .post('/cleanup-tokens', cleanupTokensHandler)
  .get('/purge-users', purgeUsersHandler)
  .post('/purge-users', purgeUsersHandler)
  .get('/analytics/compute', analyticsComputeHandler)
  .post('/analytics/compute', analyticsComputeHandler)
  .get('/maintenance', maintenanceHandler)
  .post('/maintenance', maintenanceHandler);

// apps/backend/api/src/create-app.ts
var MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024;
async function bufferUndeclaredRequestBodyWithinLimit(request) {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const bytes = Number(contentLength);
    if (Number.isFinite(bytes) && bytes > MAX_REQUEST_BODY_BYTES) {
      throw new ApiError(413, 'Request body too large', 'PAYLOAD_TOO_LARGE');
    }
    return;
  }
  const reader = request.body?.getReader();
  if (!reader) return;
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      throw new ApiError(413, 'Request body too large', 'PAYLOAD_TOO_LARGE');
    }
    chunks.push(value);
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: body.buffer,
    redirect: request.redirect,
    signal: request.signal,
  });
}
function shouldDisableHttpCache(request) {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname.startsWith('/api/auth/')) return true;
  if (url.pathname.startsWith('/api/internal/')) return true;
  if (request.headers.has('authorization')) return true;
  return false;
}
function applySecurityHeaders(set, request, csp, permissionsPolicy) {
  set.headers['x-content-type-options'] = 'nosniff';
  set.headers['x-frame-options'] = 'DENY';
  set.headers['referrer-policy'] = 'strict-origin-when-cross-origin';
  set.headers['content-security-policy'] = csp;
  if (process.env['NODE_ENV'] === 'production') {
    set.headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains; preload';
  }
  set.headers['permissions-policy'] = permissionsPolicy;
  if (shouldDisableHttpCache(request)) {
    set.headers['cache-control'] = 'no-store';
  }
}
function publicServerErrorMessage(statusCode) {
  if (statusCode === 502) return 'Upstream service error';
  if (statusCode === 503) return 'Service unavailable';
  return 'Internal server error';
}
function createApp(options) {
  const { corsOrigins, csp, permissionsPolicy } = options;
  const envResult = validateEnv();
  if (!envResult.ok) {
    throw new Error(formatValidationError(envResult));
  }
  const app2 = new Elysia12()
    .onRequest(async (context) => {
      const bufferedRequest = await bufferUndeclaredRequestBodyWithinLimit(context.request);
      if (bufferedRequest) context.request = bufferedRequest;
    })
    .use(
      cors({
        origin: corsOrigins,
        credentials: true,
        // Cache preflight response for 24h. Browsers cap (Chrome=2h, Firefox=24h),
        // but without this the @elysiajs/cors default is 5s, forcing a fresh OPTIONS
        // round trip for nearly every API call.
        maxAge: 86400,
      })
    )
    .use(swaggerPlugin)
    .onAfterHandle(({ set, request }) => {
      applySecurityHeaders(set, request, csp, permissionsPolicy);
    })
    .use(requestLogger)
    .onError(({ code, error, set, request, reqLogger, startMs }) => {
      applySecurityHeaders(set, request, csp, permissionsPolicy);
      const log = reqLogger ?? logger;
      const latencyMs = startMs != null ? Date.now() - startMs : void 0;
      if (error instanceof ApiError) {
        set.status = error.statusCode;
        if (error.headers) {
          for (const [key, value] of Object.entries(error.headers)) {
            set.headers[key] = value;
          }
        }
        const level = error.statusCode >= 500 ? 'error' : 'warn';
        log[level](
          { status: error.statusCode, code: error.code, latencyMs },
          error.statusCode >= 500 ? 'API request failed' : error.message
        );
        if (error.statusCode >= 500) {
          captureException2(error);
          keepAlive(flushSentry());
          return { error: publicServerErrorMessage(error.statusCode), code: error.code };
        }
        return { error: error.message, code: error.code, ...(error.details ?? {}) };
      }
      if (code === 'NOT_FOUND') {
        set.status = 404;
        log.warn({ status: 404, latencyMs }, 'not found');
        return { error: 'Not found', code: 'NOT_FOUND' };
      }
      if (code === 'VALIDATION') {
        set.status = 400;
        log.warn({ status: 400, latencyMs }, 'validation error');
        return { error: 'Validation failed', code: 'VALIDATION_ERROR' };
      }
      if (code === 'PARSE') {
        set.status = 400;
        log.warn({ status: 400, latencyMs }, 'parse error');
        return { error: 'Invalid request body', code: 'PARSE_ERROR' };
      }
      log.error({ err: error, code, status: 500, latencyMs }, 'unhandled error');
      captureException2(error);
      keepAlive(flushSentry());
      set.status = 500;
      return { error: 'Internal server error', code: 'INTERNAL_ERROR' };
    })
    .use(
      new Elysia12({ prefix: '/api' })
        .use(authRoutes)
        .use(programRoutes)
        .use(catalogRoutes)
        .use(exerciseRoutes)
        .use(resultRoutes)
        .use(statsRoutes)
        .use(insightsRoutes)
        .use(internalRoutes)
        .get(
          '/health',
          ({ set }) => {
            set.headers['cache-control'] = 'public, max-age=0, s-maxage=10';
            return { status: 'ok', timestamp: /* @__PURE__ */ new Date().toISOString() };
          },
          {
            detail: {
              tags: ['System'],
              summary: 'Public liveness check',
              description:
                'Cheap in-memory liveness check. Use the protected internal readiness route to probe Postgres and Redis.',
              responses: {
                200: { description: 'API process is alive' },
              },
            },
          }
        )
    );
  return app2;
}

// apps/backend/api/src/lib/node-gateway.ts
import { randomUUID as randomUUID2 } from 'node:crypto';

// apps/backend/api/src/lib/node-request-body.ts
var PayloadTooLargeError = class extends Error {
  constructor() {
    super('Payload too large');
    this.name = 'PayloadTooLargeError';
  }
};
function declaredBodyTooLarge(contentLength, maxBytes) {
  if (!contentLength) return false;
  const length = Number(contentLength);
  return Number.isSafeInteger(length) && length > maxBytes;
}
function readLimitedBody(stream, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    const cleanup = () => {
      stream.removeListener('data', onData);
      stream.removeListener('end', onEnd);
      stream.removeListener('error', onError);
    };
    const onData = (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > maxBytes) {
        cleanup();
        stream.pause();
        reject(new PayloadTooLargeError());
        return;
      }
      chunks.push(buffer);
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks, totalBytes));
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    stream.on('data', onData);
    stream.on('end', onEnd);
    stream.on('error', onError);
  });
}

// apps/backend/api/src/lib/node-gateway.ts
var MAX_GATEWAY_BODY_BYTES = 1048576;
var MAX_NON_STREAMING_RESPONSE_BYTES = 1048576;
var NonStreamingResponseTooLargeError = class extends Error {};
function setFallbackHeaders(res, requestId) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-request-id', requestId);
}
function sendJson(res, status, body, requestId) {
  if (res.headersSent || res.writableEnded) return;
  res.statusCode = status;
  setFallbackHeaders(res, requestId);
  res.end(JSON.stringify(body));
}
function applyWebResponseHeaders(res, response) {
  res.statusCode = response.status;
  const cookies = response.headers.getSetCookie();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    res.setHeader(key, value);
  });
  if (cookies.length > 0) res.setHeader('set-cookie', cookies);
}
function waitForDrain(res) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      res.off('drain', onDrain);
      res.off('error', onError);
      res.off('close', onClose);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onClose = () => {
      cleanup();
      reject(new Error('Node response closed during backpressure'));
    };
    res.once('drain', onDrain);
    res.once('error', onError);
    res.once('close', onClose);
  });
}
async function writeFallbackResponse(res, response) {
  const declaredLength = response.headers.get('content-length');
  if (declaredBodyTooLarge(declaredLength ?? void 0, MAX_NON_STREAMING_RESPONSE_BYTES)) {
    throw new NonStreamingResponseTooLargeError();
  }
  const body = new Uint8Array(await response.arrayBuffer());
  if (body.byteLength > MAX_NON_STREAMING_RESPONSE_BYTES) {
    throw new NonStreamingResponseTooLargeError();
  }
  applyWebResponseHeaders(res, response);
  res.end(body);
}
async function writeWebResponse(res, response) {
  if (!response.body) {
    applyWebResponseHeaders(res, response);
    res.end();
    return;
  }
  const stream = response.body;
  if (typeof stream.getReader !== 'function') {
    await writeFallbackResponse(res, response);
    return;
  }
  const reader = stream.getReader();
  let started = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!started) {
        applyWebResponseHeaders(res, response);
        started = true;
      }
      if (value.byteLength > 0 && !res.write(value)) await waitForDrain(res);
    }
    if (!started) applyWebResponseHeaders(res, response);
    res.end();
  } catch (error) {
    await reader.cancel(error).catch(() => void 0);
    if (res.headersSent) res.destroy(error instanceof Error ? error : void 0);
    throw error;
  } finally {
    reader.releaseLock();
  }
}
function webRequestFromNode(req, method, body) {
  const url = `https://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === void 0) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }
  const requestBody = body === void 0 ? void 0 : Uint8Array.from(body).buffer;
  return new Request(url, {
    method,
    headers,
    ...(requestBody !== void 0 ? { body: requestBody } : {}),
  });
}
function createNodeGateway(appFetch) {
  return async function nodeGateway(req, res) {
    const requestId = randomUUID2();
    try {
      const method = (req.method ?? 'GET').toUpperCase();
      const hasBody = method !== 'GET' && method !== 'HEAD';
      let body;
      if (hasBody) {
        const contentLength = Array.isArray(req.headers['content-length'])
          ? req.headers['content-length'][0]
          : req.headers['content-length'];
        if (declaredBodyTooLarge(contentLength, MAX_GATEWAY_BODY_BYTES)) {
          sendJson(res, 413, { error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' }, requestId);
          return;
        }
        body = await readLimitedBody(req, MAX_GATEWAY_BODY_BYTES);
      }
      const response = await appFetch(webRequestFromNode(req, method, body));
      await writeWebResponse(res, response);
    } catch (error) {
      if (error instanceof NonStreamingResponseTooLargeError) {
        sendJson(
          res,
          502,
          { error: 'Upstream response too large', code: 'RESPONSE_TOO_LARGE' },
          requestId
        );
        return;
      }
      if (error instanceof PayloadTooLargeError) {
        sendJson(res, 413, { error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' }, requestId);
        return;
      }
      logger.error({ err: error, requestId }, 'node gateway request failed');
      sendJson(res, 500, { error: 'Internal server error', code: 'INTERNAL_ERROR' }, requestId);
    }
  };
}

// apps/backend/api/src/vercel-handler.ts
var app = createApp(buildAppOptions());
var vercel_handler_default = createNodeGateway((request) => app.fetch(request));
export { vercel_handler_default as default };
