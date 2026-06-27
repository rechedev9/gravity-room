import { describe, it, expect, afterEach } from 'vitest';
import { getWebBaseUrl, getApiBaseUrl } from './app-url';

const ORIGINAL_CORS = process.env['CORS_ORIGIN'];
const ORIGINAL_API = process.env['API_PUBLIC_URL'];

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore('CORS_ORIGIN', ORIGINAL_CORS);
  restore('API_PUBLIC_URL', ORIGINAL_API);
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
});
