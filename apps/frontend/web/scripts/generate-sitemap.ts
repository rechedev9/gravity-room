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
import { SITE_ORIGIN, INDEXNOW_KEY, sitemapEntries } from './seo-config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '../public');

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const lastmod = today();
  const entries = sitemapEntries();

  const body = entries
    .map((e) =>
      [
        '  <url>',
        `    <loc>${SITE_ORIGIN}${e.path}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${e.changefreq}</changefreq>`,
        `    <priority>${e.priority}</priority>`,
        '  </url>',
      ].join('\n')
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

  await writeFile(resolve(PUBLIC_DIR, 'sitemap.xml'), xml, 'utf8');
  await writeFile(resolve(PUBLIC_DIR, `${INDEXNOW_KEY}.txt`), `${INDEXNOW_KEY}\n`, 'utf8');

  console.error(
    `[sitemap] wrote ${entries.length} URLs (lastmod ${lastmod}) + IndexNow key ${INDEXNOW_KEY}.txt`
  );
}

await main();
