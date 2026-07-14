import { describe, expect, it } from 'vitest';
import { sitemapEntries } from '../../../scripts/seo-config';

describe('sitemap covers the bilingual program guide cluster', () => {
  const paths = new Set(sitemapEntries().map((entry) => entry.path));

  it.each([
    '/programas',
    '/en/programs',
    '/programas/gzclp-vs-stronglifts',
    '/en/programs/gzclp-vs-stronglifts',
    '/programas/progresion-automatica',
    '/en/programs/automatic-progression',
  ])('includes %s for prerender and discovery', (path) => {
    expect(paths.has(path)).toBe(true);
  });
});
