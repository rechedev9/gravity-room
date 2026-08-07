import { describe, expect, it } from 'vitest';
import { buildSitemapXml } from '../../scripts/generate-sitemap';
import { SITE_ORIGIN, sitemapEntries, type SitemapEntry } from '../../scripts/seo-config';
import { EXERCISE_ARTICLES } from '../features/exercise-wiki/content/registry';

describe('SEO sitemap configuration', () => {
  const entries = sitemapEntries();

  it.each([
    ['/', '/en'],
    ['/programas', '/en/programs'],
    ['/programas/gzclp-vs-stronglifts', '/en/programs/gzclp-vs-stronglifts'],
    ['/programas/progresion-automatica', '/en/programs/automatic-progression'],
    ['/ejercicios', '/en/exercises'],
  ])('publishes reciprocal hreflang for %s and %s', (esPath, enPath) => {
    for (const path of [esPath, enPath]) {
      const entry = entries.find((candidate) => candidate.path === path);
      expect(entry?.alternates).toEqual([
        { hreflang: 'es', href: `${SITE_ORIGIN}${esPath}` },
        { hreflang: 'en', href: `${SITE_ORIGIN}${enPath}` },
        { hreflang: 'x-default', href: `${SITE_ORIGIN}${enPath}` },
      ]);
    }
  });

  it('uses reviewed article dates instead of deployment dates', () => {
    for (const article of EXERCISE_ARTICLES) {
      const paths = [`/ejercicios/${article.slug.es}`, `/en/exercises/${article.slug.en}`];
      for (const path of paths) {
        expect(entries.find((entry) => entry.path === path)?.lastmod).toBe(article.reviewedAt);
      }
    }
    expect(entries.find((entry) => entry.path === '/')?.lastmod).toBeUndefined();
  });
});

describe('buildSitemapXml', () => {
  const entry: SitemapEntry = {
    path: '/guide?a=1&b=2',
    priority: '0.8',
    changefreq: 'monthly',
    lastmod: '2026-08-07',
    alternates: [{ hreflang: 'en', href: 'https://gravityroom.app/en/guide?a=1&b=2' }],
  };

  it('serializes hreflang, verified lastmod, and escaped URLs', () => {
    const xml = buildSitemapXml([entry]);

    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain('<loc>https://gravityroom.app/guide?a=1&amp;b=2</loc>');
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="en" href="https://gravityroom.app/en/guide?a=1&amp;b=2" />'
    );
    expect(xml).toContain('<lastmod>2026-08-07</lastmod>');
    expect(xml.indexOf('<lastmod>')).toBeLessThan(xml.indexOf('<xhtml:link'));
    expect(xml.indexOf('<changefreq>')).toBeLessThan(xml.indexOf('<xhtml:link'));
    expect(xml.indexOf('<priority>')).toBeLessThan(xml.indexOf('<xhtml:link'));
  });
});
