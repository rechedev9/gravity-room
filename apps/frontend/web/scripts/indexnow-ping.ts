/**
 * Notify IndexNow (Bing / ChatGPT Search / Copilot funnel) that the site's
 * indexable URLs may have changed. Run AFTER a successful deploy, once the new
 * sitemap is live.
 *
 * Dependency-free on purpose: it fetches the LIVE sitemap and submits those
 * URLs, so it needs no workspace install in the deploy job. Best-effort — it
 * never exits non-zero, so an IndexNow hiccup can't fail a deploy.
 *
 * Google does not support IndexNow; this targets Bing-backed engines only.
 */

// Make this a module so top-level await is allowed (no other imports).
export {};

// Keep in sync with INDEXNOW_KEY in scripts/seo-config.ts (duplicated so this
// script stays dependency-free).
const SITE_ORIGIN = 'https://gravityroom.app';
const INDEXNOW_KEY = 'a3f8e1c97b6d452e8f0a1b2c3d4e5f60';

async function main(): Promise<void> {
  let urlList: string[] = [];
  try {
    const res = await fetch(`${SITE_ORIGIN}/sitemap.xml`, {
      headers: { Accept: 'application/xml' },
    });
    if (!res.ok) throw new Error(`sitemap fetch ${res.status}`);
    const xml = await res.text();
    urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  } catch (err) {
    console.error(`[indexnow] could not read live sitemap (${String(err)}); skipping`);
    return;
  }

  if (urlList.length === 0) {
    console.error('[indexnow] live sitemap had no URLs; skipping');
    return;
  }

  const payload = {
    host: new URL(SITE_ORIGIN).host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`,
    urlList,
  };

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    console.error(`[indexnow] submitted ${urlList.length} URLs -> ${res.status} ${res.statusText}`);
  } catch (err) {
    console.error(`[indexnow] submit failed (best-effort, ignoring): ${String(err)}`);
  }
}

await main();
