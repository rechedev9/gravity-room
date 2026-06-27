import { describe, expect, it } from 'vitest';
import { REQUIRED_ENV, formatValidationError, validateEnv } from './env-validation';

function fullProdEnv(): Record<string, string> {
  const env: Record<string, string> = { NODE_ENV: 'production' };
  for (const spec of REQUIRED_ENV) {
    if (!spec.requiredInProd) continue;
    // Use a 64-char value to satisfy JWT_SECRET min-length too.
    env[spec.name] = 'x'.repeat(64);
  }
  return env;
}

describe('validateEnv', () => {
  it('returns ok=true in development even when env is empty', () => {
    const result = validateEnv({}, 'development');
    expect(result).toEqual({ ok: true });
  });

  it('returns ok=true in test even when env is empty', () => {
    expect(validateEnv({}, 'test')).toEqual({ ok: true });
  });

  it('flags every required-in-prod var as missing when production env is empty', () => {
    const result = validateEnv({}, 'production');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');

    const expected = Array.from(
      new Set(REQUIRED_ENV.filter((s) => s.requiredInProd).map((s) => s.name))
    );
    expect(result.missing.sort()).toEqual(expected.sort());
  });

  it('returns ok=true when every required-in-prod var is present', () => {
    expect(validateEnv(fullProdEnv(), 'production')).toEqual({ ok: true });
  });

  it('treats whitespace-only values as missing', () => {
    const env = fullProdEnv();
    env['UPSTASH_REDIS_REST_URL'] = '   ';
    env['DATABASE_URL'] = '\t\n';
    const result = validateEnv(env, 'production');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.missing).toContain('UPSTASH_REDIS_REST_URL');
    expect(result.missing).toContain('DATABASE_URL');
  });

  it('accepts the Vercel Upstash KV_* aliases in place of UPSTASH_REDIS_REST_*', () => {
    const env = fullProdEnv();
    delete env['UPSTASH_REDIS_REST_URL'];
    delete env['UPSTASH_REDIS_REST_TOKEN'];
    env['KV_REST_API_URL'] = 'https://example.upstash.io';
    env['KV_REST_API_TOKEN'] = 'x'.repeat(40);
    expect(validateEnv(env, 'production')).toEqual({ ok: true });
  });

  it('still flags UPSTASH_REDIS_REST_URL when neither it nor its KV_* alias is set', () => {
    const env = fullProdEnv();
    delete env['UPSTASH_REDIS_REST_URL'];
    const result = validateEnv(env, 'production');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.missing).toContain('UPSTASH_REDIS_REST_URL');
  });

  it('does not flag vars that are in REQUIRED_ENV but not required-in-prod', () => {
    const env = fullProdEnv();
    // Sanity: at least one optional var exists.
    const optional = REQUIRED_ENV.filter((s) => !s.requiredInProd);
    expect(optional.length).toBeGreaterThan(0);
    // None of the optional vars are set, yet validation must still pass.
    for (const spec of optional) delete env[spec.name];
    expect(validateEnv(env, 'production')).toEqual({ ok: true });
  });

  it('flags JWT_SECRET shorter than 64 chars in production', () => {
    const env = fullProdEnv();
    env['JWT_SECRET'] = 'x'.repeat(32);
    const result = validateEnv(env, 'production');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
  });

  it('flags non-integer PORT in production', () => {
    const env = fullProdEnv();
    env['PORT'] = 'not-a-number';
    const result = validateEnv(env, 'production');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors.some((e) => e.includes('PORT'))).toBe(true);
  });

  it('defaults nodeEnv to env.NODE_ENV when not passed explicitly', () => {
    expect(validateEnv({ NODE_ENV: 'production' }).ok).toBe(false);
    expect(validateEnv({ NODE_ENV: 'development' }).ok).toBe(true);
  });
});

describe('formatValidationError', () => {
  it('includes missing var names and their descriptions', () => {
    const msg = formatValidationError({
      ok: false,
      missing: ['CRON_SECRET'],
      errors: [],
    });
    expect(msg).toContain('CRON_SECRET');
    expect(msg).toContain('Vercel Cron');
  });

  it('includes constraint errors when present', () => {
    const msg = formatValidationError({
      ok: false,
      missing: [],
      errors: ['JWT_SECRET must be at least 64 characters in production (got 32)'],
    });
    expect(msg).toContain('JWT_SECRET');
    expect(msg).toContain('Constraint violations');
  });
});
