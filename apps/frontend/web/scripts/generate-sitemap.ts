/**
 * Generate public/sitemap.xml from the shared catalog and write the IndexNow
 * key file. Runs FIRST in the `build` script (before `vite build` copies
 * public/ into dist/, and before prerender.ts reads the sitemap to know which
 * routes to snapshot).
 *
 * Why generated, not hand-written: the previous sitemap.xml drifted from the
 * catalog (stale lastmod; active programs missing). Deriving it from
 * PROGRAM_CATALOG keeps it correct automatically.
 */
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_ORIGIN, INDEXNOW_KEY, sitemapEntries, type SitemapEntry } from './seo-config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '../public');

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildSitemapXml(entries: readonly SitemapEntry[]): string {
  const body = entries
    .map((e) =>
      [
        '  <url>',
        `    <loc>${escapeXml(`${SITE_ORIGIN}${e.path}`)}</loc>`,
        ...(e.lastmod !== undefined ? [`    <lastmod>${escapeXml(e.lastmod)}</lastmod>`] : []),
        `    <changefreq>${e.changefreq}</changefreq>`,
        `    <priority>${e.priority}</priority>`,
        ...(e.alternates ?? []).map(
          (alternate) =>
            `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.href)}" />`
        ),
        '  </url>',
      ].join('\n')
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

async function main(): Promise<void> {
  const entries = sitemapEntries();
  const xml = buildSitemapXml(entries);

  await writeFile(resolve(PUBLIC_DIR, 'sitemap.xml'), xml, 'utf8');
  await writeFile(resolve(PUBLIC_DIR, `${INDEXNOW_KEY}.txt`), `${INDEXNOW_KEY}\n`, 'utf8');

  console.error(
    `[sitemap] wrote ${entries.length} URLs (${entries.filter((entry) => entry.lastmod !== undefined).length} with verified lastmod) + IndexNow key ${INDEXNOW_KEY}.txt`
  );
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
