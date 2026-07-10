import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCorsOrigins } from './app-config';

describe('parseCorsOrigins', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the Vite dev server origin outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(parseCorsOrigins(undefined)).toBe('http://localhost:5173');
  });

  it('allows no cross-origin requests by default in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(parseCorsOrigins(undefined)).toEqual([]);
  });

  it('parses and trims an explicit comma-separated allow-list', () => {
    expect(parseCorsOrigins(' http://localhost:5173, https://preview.example.com ')).toEqual([
      'http://localhost:5173',
      'https://preview.example.com',
    ]);
  });

  it('rejects malformed origins', () => {
    expect(() => parseCorsOrigins('not a url')).toThrow('CORS_ORIGIN contains invalid URL');
  });

  it.each([
    'javascript://example.com',
    'https://user:password@example.com',
    'https://example.com/path',
    'https://example.com?redirect=evil',
    'https://example.com/#fragment',
  ])('rejects values that are URLs but not HTTP origins: %s', (value) => {
    expect(() => parseCorsOrigins(value)).toThrow('CORS_ORIGIN must contain http(s) origins only');
  });
});
