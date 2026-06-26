import { describe, expect, it } from 'vitest';
import { sitemapEntries } from '../../../scripts/seo-config';
import { EXERCISE_ARTICLES } from './content/registry';

// Regression guard: the sitemap is config-driven (scripts/seo-config.ts) and the
// build-time prerender only renders URLs present in it. A wiki route missing here
// silently 404s in production (it builds fine, but the page is never prerendered).
describe('sitemap covers the exercise wiki', () => {
  const paths = new Set(sitemapEntries().map((e) => e.path));

  it('includes both wiki index pages', () => {
    expect(paths.has('/ejercicios')).toBe(true);
    expect(paths.has('/en/exercises')).toBe(true);
  });

  it('includes every article in both languages', () => {
    for (const a of EXERCISE_ARTICLES) {
      expect(paths.has(`/ejercicios/${a.slug.es}`)).toBe(true);
      expect(paths.has(`/en/exercises/${a.slug.en}`)).toBe(true);
    }
  });
});
