import { describe, expect, it } from 'vitest';
import { PUBLIC_API_CACHE_PATTERN, PWA_REGISTER_TYPE } from './pwa-config';

describe('PWA update policy', () => {
  it('keeps a new worker waiting for explicit user confirmation', () => {
    expect(PWA_REGISTER_TYPE).toBe('prompt');
  });
});

describe('public API runtime-cache policy', () => {
  it.each([
    '/api/catalog/',
    '/api/catalog/gzclp',
    '/api/muscle-groups',
    '/api/stats/online?source=pwa',
  ])('allows user-independent endpoint %s', (url) => {
    expect(PUBLIC_API_CACHE_PATTERN.test(url)).toBe(true);
  });

  it.each([
    '/api/exercises',
    '/api/exercises?q=squat',
    '/api/auth/me',
    '/api/programs/',
    '/api/insights/',
  ])('rejects endpoint that may contain account data: %s', (url) => {
    expect(PUBLIC_API_CACHE_PATTERN.test(url)).toBe(false);
  });
});
