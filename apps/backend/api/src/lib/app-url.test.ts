import { describe, it, expect, afterEach } from 'vitest';
import { getWebBaseUrl, getApiBaseUrl } from './app-url';

const ORIGINAL_CORS = process.env['CORS_ORIGIN'];
const ORIGINAL_API = process.env['API_PUBLIC_URL'];
const ORIGINAL_NODE_ENV = process.env['NODE_ENV'];
const ORIGINAL_VERCEL = process.env['VERCEL'];
const ORIGINAL_VERCEL_ENV = process.env['VERCEL_ENV'];
const ORIGINAL_VERCEL_URL = process.env['VERCEL_URL'];
const ORIGINAL_VERCEL_PRODUCTION_URL = process.env['VERCEL_PROJECT_PRODUCTION_URL'];

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore('CORS_ORIGIN', ORIGINAL_CORS);
  restore('API_PUBLIC_URL', ORIGINAL_API);
  restore('NODE_ENV', ORIGINAL_NODE_ENV);
  restore('VERCEL', ORIGINAL_VERCEL);
  restore('VERCEL_ENV', ORIGINAL_VERCEL_ENV);
  restore('VERCEL_URL', ORIGINAL_VERCEL_URL);
  restore('VERCEL_PROJECT_PRODUCTION_URL', ORIGINAL_VERCEL_PRODUCTION_URL);
});

/** Minimal Request stand-in carrying only the headers the helpers read. */
function reqWith(headers: Record<string, string>): Request {
  return new Request('http://internal/', { headers });
}

describe('getWebBaseUrl', () => {
  it('prefers CORS_ORIGIN (first entry) when set', () => {
    process.env['CORS_ORIGIN'] = 'http://localhost:5173,https://other';
    expect(getWebBaseUrl(reqWith({ host: 'gravityroom.app' }))).toBe('http://localhost:5173');
  });

  it('derives the origin from the request host when CORS_ORIGIN is empty', () => {
    delete process.env['CORS_ORIGIN'];
    expect(getWebBaseUrl(reqWith({ host: 'gravityroom.app', 'x-forwarded-proto': 'https' }))).toBe(
      'https://gravityroom.app'
    );
  });

  it('uses the Vite origin for requests received by the local API', () => {
    delete process.env['CORS_ORIGIN'];
    process.env['NODE_ENV'] = 'development';

    expect(getWebBaseUrl(reqWith({ host: 'localhost:3001', 'x-forwarded-proto': 'http' }))).toBe(
      'http://localhost:5173'
    );
  });

  it('prefers x-forwarded-host over host', () => {
    delete process.env['CORS_ORIGIN'];
    expect(
      getWebBaseUrl(reqWith({ host: 'internal:3001', 'x-forwarded-host': 'gravityroom.app' }))
    ).toBe('https://gravityroom.app');
  });

  it('defaults the scheme to https when x-forwarded-proto is absent', () => {
    delete process.env['CORS_ORIGIN'];
    expect(getWebBaseUrl(reqWith({ host: 'gravityroom.app' }))).toBe('https://gravityroom.app');
  });

  it('falls back to localhost when neither env nor request is available', () => {
    delete process.env['CORS_ORIGIN'];
    expect(getWebBaseUrl()).toBe('http://localhost:5173');
  });

  it('does not trust request host headers in production', () => {
    delete process.env['CORS_ORIGIN'];
    delete process.env['API_PUBLIC_URL'];
    delete process.env['VERCEL'];
    process.env['NODE_ENV'] = 'production';

    expect(() =>
      getWebBaseUrl(reqWith({ host: 'attacker.example', 'x-forwarded-host': 'attacker.example' }))
    ).toThrow(/trusted public origin/);
  });

  it('uses the trusted Vercel production URL instead of request headers', () => {
    delete process.env['CORS_ORIGIN'];
    delete process.env['API_PUBLIC_URL'];
    process.env['NODE_ENV'] = 'production';
    process.env['VERCEL'] = '1';
    process.env['VERCEL_ENV'] = 'production';
    process.env['VERCEL_PROJECT_PRODUCTION_URL'] = 'gravityroom.app';

    expect(getWebBaseUrl(reqWith({ host: 'attacker.example' }))).toBe('https://gravityroom.app');
  });
});

describe('getApiBaseUrl', () => {
  it('prefers API_PUBLIC_URL when set (trailing slash trimmed)', () => {
    process.env['API_PUBLIC_URL'] = 'https://gravityroom.app/';
    expect(getApiBaseUrl(reqWith({ host: 'other.example' }))).toBe('https://gravityroom.app');
  });

  it('derives the origin from the request host when API_PUBLIC_URL is unset', () => {
    delete process.env['API_PUBLIC_URL'];
    expect(getApiBaseUrl(reqWith({ host: 'gravityroom.app', 'x-forwarded-proto': 'https' }))).toBe(
      'https://gravityroom.app'
    );
  });

  it('falls back to localhost:3001 when neither env nor request is available', () => {
    delete process.env['API_PUBLIC_URL'];
    expect(getApiBaseUrl()).toBe('http://localhost:3001');
  });

  it('rejects request-derived API origins in production', () => {
    delete process.env['API_PUBLIC_URL'];
    delete process.env['VERCEL'];
    process.env['NODE_ENV'] = 'production';

    expect(() => getApiBaseUrl(reqWith({ host: 'attacker.example' }))).toThrow(
      /trusted public origin/
    );
  });

  it('rejects configured URLs containing credentials or paths', () => {
    process.env['API_PUBLIC_URL'] = 'https://user:pass@example.com/api';
    expect(() => getApiBaseUrl()).toThrow(/without credentials or a path/);
  });
});
