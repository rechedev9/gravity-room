import { describe, expect, it } from 'bun:test';
import { buildApiUrl } from './url.js';

describe('buildApiUrl', () => {
  it('joins base and path normally', () => {
    expect(buildApiUrl('http://localhost:3001', '/auth/me')).toBe(
      'http://localhost:3001/auth/me'
    );
  });

  it('strips trailing slash from baseUrl', () => {
    expect(buildApiUrl('http://localhost:3001/', '/auth/me')).toBe(
      'http://localhost:3001/auth/me'
    );
  });

  it('adds leading slash to path when missing', () => {
    expect(buildApiUrl('http://localhost:3001', 'auth/me')).toBe(
      'http://localhost:3001/auth/me'
    );
  });

  it('handles both normalizations at once', () => {
    expect(buildApiUrl('http://localhost:3001/', 'auth/me')).toBe(
      'http://localhost:3001/auth/me'
    );
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
});
