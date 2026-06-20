/**
 * Single source of truth for the public URL surface used by SEO tooling
 * (sitemap generation + IndexNow). Derives indexable program URLs from the
 * shared `PROGRAM_CATALOG` so the sitemap can never drift from the catalog
 * (the previous hand-maintained sitemap.xml had stale `lastmod` and was
 * missing/over-listing programs).
 */
import { PROGRAM_CATALOG } from '@gzclp/domain/catalog';

export const SITE_ORIGIN = 'https://gravityroom.app';

/**
 * IndexNow key. The key file is served at `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`
 * (written by generate-sitemap.ts). IndexNow pushes URL changes to Bing — and
 * therefore to ChatGPT Search / Copilot, which draw on Bing's index — without
 * waiting for a crawl. Google does not use IndexNow.
 *
 * NOTE: scripts/indexnow-ping.ts intentionally duplicates this value so it can
 * run dependency-free in the deploy job; keep the two in sync if rotated.
 */
export const INDEXNOW_KEY = 'a3f8e1c97b6d452e8f0a1b2c3d4e5f60';

export interface SitemapEntry {
  readonly path: string;
  readonly priority: string;
  readonly changefreq: string;
}

// Indexable static routes. `/login` is intentionally excluded (noindex), as are
// `/app/*` (auth-gated) and `/presentacion` (static deck).
const STATIC_ENTRIES: readonly SitemapEntry[] = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/en', priority: '1.0', changefreq: 'weekly' },
  { path: '/privacy', priority: '0.3', changefreq: 'monthly' },
  { path: '/cookies', priority: '0.3', changefreq: 'monthly' },
];

/** All indexable entries: static routes + every ACTIVE catalog program. */
export function sitemapEntries(): readonly SitemapEntry[] {
  const programs: readonly SitemapEntry[] = PROGRAM_CATALOG.filter((p) => p.isActive).map((p) => ({
    path: `/programs/${p.id}`,
    priority: '0.7',
    changefreq: 'monthly',
  }));
  return [...STATIC_ENTRIES, ...programs];
}

/** Absolute URLs for every indexable entry. */
export function indexableUrls(): readonly string[] {
  return sitemapEntries().map((e) => `${SITE_ORIGIN}${e.path}`);
}
