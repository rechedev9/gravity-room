/**
 * Single source of truth for the public URL surface used by SEO tooling
 * (sitemap generation + IndexNow + prerender hreflang hygiene). Derives
 * indexable program URLs from the shared `PROGRAM_CATALOG` so the sitemap can
 * never drift from the catalog.
 */
import { PROGRAM_CATALOG } from '@gzclp/domain/catalog';
import { EXERCISE_ARTICLES } from '../src/features/exercise-wiki/content/registry';

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

export interface HreflangAlternate {
  readonly hreflang: 'es' | 'en' | 'x-default' | string;
  readonly href: string;
}

/** @deprecated Prefer HreflangAlternate — kept as alias for sitemap callers. */
export type SitemapAlternate = HreflangAlternate;

export interface SitemapEntry {
  readonly path: string;
  readonly priority: string;
  readonly changefreq: string;
  /**
   * Only publish dates backed by page content. Search engines may ignore the
   * entire signal when every deployment stamps every URL with today's date.
   */
  readonly lastmod?: string;
  /** Language alternates for this URL; omitted for single-URL pages. */
  readonly alternates?: readonly HreflangAlternate[];
}

function pairAlternates(esPath: string, enPath: string): readonly HreflangAlternate[] {
  return [
    { hreflang: 'es', href: `${SITE_ORIGIN}${esPath}` },
    { hreflang: 'en', href: `${SITE_ORIGIN}${enPath}` },
    { hreflang: 'x-default', href: `${SITE_ORIGIN}${enPath}` },
  ];
}

function localizedEntries(
  esPath: string,
  enPath: string,
  priority: string,
  changefreq: string,
  lastmod?: string
): readonly SitemapEntry[] {
  const alternates = pairAlternates(esPath, enPath);
  const shared = {
    priority,
    changefreq,
    alternates,
    ...(lastmod !== undefined ? { lastmod } : {}),
  };
  return [
    { path: esPath, ...shared },
    { path: enPath, ...shared },
  ];
}

// Indexable static routes. `/login` is intentionally excluded (noindex), as are
// `/app/*` (auth-gated) and `/presentacion` (static deck).
const STATIC_ENTRIES: readonly SitemapEntry[] = [
  ...localizedEntries('/', '/en', '1.0', 'weekly'),
  { path: '/privacy', priority: '0.3', changefreq: 'monthly' },
  { path: '/cookies', priority: '0.3', changefreq: 'monthly' },
  ...localizedEntries('/programas', '/en/programs', '0.9', 'weekly'),
  ...localizedEntries(
    '/programas/gzclp-vs-stronglifts',
    '/en/programs/gzclp-vs-stronglifts',
    '0.8',
    'monthly'
  ),
  ...localizedEntries(
    '/programas/progresion-automatica',
    '/en/programs/automatic-progression',
    '0.8',
    'monthly'
  ),
];

// Exercise-wiki index pages (es + en). Article detail URLs are derived from the
// wiki registry below so the sitemap can never drift from the published articles.
const WIKI_INDEX_ENTRIES: readonly SitemapEntry[] = [
  ...localizedEntries('/ejercicios', '/en/exercises', '0.8', 'weekly'),
  ...localizedEntries('/ejercicios/versus', '/en/exercises/versus', '0.7', 'weekly'),
];

/** All indexable entries: static routes + active catalog programs + the wiki. */
export function sitemapEntries(): readonly SitemapEntry[] {
  const programs: readonly SitemapEntry[] = PROGRAM_CATALOG.filter((p) => p.isActive).map((p) => ({
    path: `/programs/${p.id}`,
    priority: '0.7',
    changefreq: 'monthly',
  }));
  const wikiArticles: readonly SitemapEntry[] = EXERCISE_ARTICLES.flatMap((article) =>
    localizedEntries(
      `/ejercicios/${article.slug.es}`,
      `/en/exercises/${article.slug.en}`,
      '0.7',
      'monthly',
      article.reviewedAt
    )
  );
  return [...STATIC_ENTRIES, ...programs, ...WIKI_INDEX_ENTRIES, ...wikiArticles];
}

/** Absolute URLs for every indexable entry. */
export function indexableUrls(): readonly string[] {
  return sitemapEntries().map((e) => `${SITE_ORIGIN}${e.path}`);
}

/**
 * Expected hreflang set for a public path during prerender hygiene.
 * Returns an empty array when the path must have ZERO hreflang tags
 * (single-URL program/legal pages).
 */
export function expectedHreflangForPath(path: string): readonly HreflangAlternate[] {
  const normalized = path === '' ? '/' : path.startsWith('/') ? path : `/${path}`;
  const entry = sitemapEntries().find((e) => e.path === normalized);
  return entry?.alternates ?? [];
}

/** Active catalog programs for llms.txt generation. */
export function activeProgramLinks(): readonly { readonly id: string; readonly name: string }[] {
  return PROGRAM_CATALOG.filter((p) => p.isActive).map((p) => ({ id: p.id, name: p.name }));
}
