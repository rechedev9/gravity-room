/**
 * redis.ts unit tests — credential resolution, lazy singleton construction,
 * and the production fail-fast.
 *
 * The module caches the client and a warned-once flag in module scope and runs
 * assertRedisConfigured() at import time, so every test loads a fresh copy via
 * vi.resetModules + dynamic import with the env stubbed first. The
 * @upstash/redis constructor is mocked so no real client is ever built.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — @upstash/redis constructor spy + logger warn spy
// ---------------------------------------------------------------------------

const { redisCtorSpy, mockWarn } = vi.hoisted(() => ({
  redisCtorSpy: vi.fn<(config: { url: string; token: string }) => void>(() => undefined),
  mockWarn: vi.fn((): void => undefined),
}));

vi.mock('@upstash/redis', () => {
  class Redis {
    constructor(config: { url: string; token: string }) {
      redisCtorSpy(config);
    }
  }
  return { Redis };
});

vi.mock('./logger', () => ({
  logger: {
    warn: mockWarn,
    info: vi.fn(() => undefined),
    error: vi.fn(() => undefined),
    debug: vi.fn(() => undefined),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RedisModule = typeof import('./redis');

/** Fresh module copy so the cached client / warned flag do not leak. */
async function loadRedisModule(): Promise<RedisModule> {
  vi.resetModules();
  return import('./redis');
}

const UPSTASH_URL = 'https://upstash.example.upstash.io';
const UPSTASH_TOKEN = 'upstash-token';
const KV_URL = 'https://kv.example.upstash.io';
const KV_TOKEN = 'kv-token';

beforeEach(() => {
  redisCtorSpy.mockClear();
  mockWarn.mockClear();
  // Deterministic credential state regardless of the runner's real env.
  vi.stubEnv('UPSTASH_REDIS_REST_URL', undefined);
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', undefined);
  vi.stubEnv('KV_REST_API_URL', undefined);
  vi.stubEnv('KV_REST_API_TOKEN', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// getRedis — development (non-production) behavior
// ---------------------------------------------------------------------------

describe('getRedis', () => {
  it('returns undefined in dev without credentials and warns only once', async () => {
    // Arrange
    const mod = await loadRedisModule();

    // Act
    const first = mod.getRedis();
    const second = mod.getRedis();

    // Assert — degraded mode, no client construction, single warn
    expect(first).toBeUndefined();
    expect(second).toBeUndefined();
    expect(redisCtorSpy).not.toHaveBeenCalled();
    expect(mockWarn).toHaveBeenCalledTimes(1);
  });

  it('builds the client from the canonical UPSTASH_REDIS_REST_* vars', async () => {
    // Arrange
    vi.stubEnv('UPSTASH_REDIS_REST_URL', UPSTASH_URL);
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', UPSTASH_TOKEN);
    const mod = await loadRedisModule();

    // Act
    const client = mod.getRedis();

    // Assert
    expect(client).toBeDefined();
    expect(redisCtorSpy).toHaveBeenCalledTimes(1);
    expect(redisCtorSpy).toHaveBeenCalledWith({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
  });

  it('caches the client: repeat calls return the same instance, constructed once', async () => {
    // Arrange
    vi.stubEnv('UPSTASH_REDIS_REST_URL', UPSTASH_URL);
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', UPSTASH_TOKEN);
    const mod = await loadRedisModule();

    // Act
    const first = mod.getRedis();
    const second = mod.getRedis();

    // Assert
    expect(first).toBeDefined();
    expect(second).toBe(first);
    expect(redisCtorSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to the Vercel-injected KV_REST_API_* vars', async () => {
    // Arrange — only the KV names are present
    vi.stubEnv('KV_REST_API_URL', KV_URL);
    vi.stubEnv('KV_REST_API_TOKEN', KV_TOKEN);
    const mod = await loadRedisModule();

    // Act
    const client = mod.getRedis();

    // Assert
    expect(client).toBeDefined();
    expect(redisCtorSpy).toHaveBeenCalledWith({ url: KV_URL, token: KV_TOKEN });
  });

  it('prefers the canonical UPSTASH vars when both name pairs are set', async () => {
    // Arrange
    vi.stubEnv('UPSTASH_REDIS_REST_URL', UPSTASH_URL);
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', UPSTASH_TOKEN);
    vi.stubEnv('KV_REST_API_URL', KV_URL);
    vi.stubEnv('KV_REST_API_TOKEN', KV_TOKEN);
    const mod = await loadRedisModule();

    // Act
    mod.getRedis();

    // Assert
    expect(redisCtorSpy).toHaveBeenCalledWith({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
  });

  it('returns undefined when only the URL is set (token missing)', async () => {
    // Arrange
    vi.stubEnv('UPSTASH_REDIS_REST_URL', UPSTASH_URL);
    const mod = await loadRedisModule();

    // Act / Assert
    expect(mod.getRedis()).toBeUndefined();
    expect(redisCtorSpy).not.toHaveBeenCalled();
  });

  it('reads the env lazily: credentials populated after import are picked up', async () => {
    // Arrange — import first, wire the env afterwards (late-populated env)
    const mod = await loadRedisModule();
    expect(mod.getRedis()).toBeUndefined();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', UPSTASH_URL);
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', UPSTASH_TOKEN);

    // Act / Assert
    expect(mod.getRedis()).toBeDefined();
    expect(redisCtorSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// assertRedisConfigured — production fail-fast
// ---------------------------------------------------------------------------

describe('assertRedisConfigured', () => {
  it('makes the module throw at import time in production without credentials', async () => {
    // Arrange
    vi.stubEnv('NODE_ENV', 'production');

    // Act / Assert — assertRedisConfigured() runs at module init
    await expect(loadRedisModule()).rejects.toThrow(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN'
    );
  });

  it('imports cleanly in production when credentials are present', async () => {
    // Arrange
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', UPSTASH_URL);
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', UPSTASH_TOKEN);

    // Act
    const mod = await loadRedisModule();

    // Assert
    expect(mod.getRedis()).toBeDefined();
  });

  it('imports cleanly in production with only the KV fallback credentials', async () => {
    // Arrange
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('KV_REST_API_URL', KV_URL);
    vi.stubEnv('KV_REST_API_TOKEN', KV_TOKEN);

    // Act / Assert
    await expect(loadRedisModule()).resolves.toBeDefined();
  });

  it('does not throw outside production without credentials', async () => {
    // Arrange — NODE_ENV=test under vitest
    const mod = await loadRedisModule();

    // Act / Assert
    expect(() => mod.assertRedisConfigured()).not.toThrow();
  });

  it('re-checks the env at call time (throws if production loses its creds)', async () => {
    // Arrange — import succeeds with creds, then the env is cleared
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', UPSTASH_URL);
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', UPSTASH_TOKEN);
    const mod = await loadRedisModule();
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', undefined);

    // Act / Assert
    expect(() => mod.assertRedisConfigured()).toThrow('required in production');
  });
});
