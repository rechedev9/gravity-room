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
});
