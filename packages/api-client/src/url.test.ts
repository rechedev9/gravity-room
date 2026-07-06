import { describe, expect, it } from 'vitest';
import { buildApiUrl } from './url.js';

describe('buildApiUrl', () => {
  it('joins base and path normally', () => {
    expect(buildApiUrl('http://localhost:3001', '/auth/me')).toBe('http://localhost:3001/auth/me');
  });

  it('strips trailing slash from baseUrl', () => {
    expect(buildApiUrl('http://localhost:3001/', '/auth/me')).toBe('http://localhost:3001/auth/me');
  });

  it('adds leading slash to path when missing', () => {
    expect(buildApiUrl('http://localhost:3001', 'auth/me')).toBe('http://localhost:3001/auth/me');
  });

  it('handles both normalizations at once', () => {
    expect(buildApiUrl('http://localhost:3001/', 'auth/me')).toBe('http://localhost:3001/auth/me');
  });

  it('works with https and custom domains', () => {
    expect(buildApiUrl('https://api.gravityroom.app', '/health')).toBe(
      'https://api.gravityroom.app/health'
    );
  });

  it('preserves query strings in path', () => {
    expect(buildApiUrl('http://localhost:3001', '/exercises?q=squat')).toBe(
      'http://localhost:3001/exercises?q=squat'
    );
  });

  it('returns a relative path for an empty base (same-origin production, VITE_API_URL="")', () => {
    expect(buildApiUrl('', '/auth/me')).toBe('/auth/me');
  });

  it('adds the leading slash when the base is empty and the path has none', () => {
    expect(buildApiUrl('', 'auth/me')).toBe('/auth/me');
  });

  it('strips a trailing slash from an https base', () => {
    expect(buildApiUrl('https://gravityroom.app/', '/auth/me')).toBe(
      'https://gravityroom.app/auth/me'
    );
  });

  it('strips only ONE trailing slash from the base (current behavior)', () => {
    // The regex /\/$/ is not global, so a base ending in multiple slashes keeps
    // all but the last one and the joined URL contains a double slash.
    expect(buildApiUrl('http://localhost:3001//', '/auth/me')).toBe(
      'http://localhost:3001//auth/me'
    );
    expect(buildApiUrl('http://localhost:3001///', 'auth/me')).toBe(
      'http://localhost:3001///auth/me'
    );
  });
});
