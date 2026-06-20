// apps/frontend/web/scripts/verify-citations.ts
import { EXERCISE_ARTICLES } from '../src/features/exercise-wiki/content/registry';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Crossref and PubMed rate-limit unauthenticated callers (PubMed ~3 req/s).
// Retry transient failures (429 / 5xx / network) with backoff so the gate only
// fails closed on a citation that genuinely does not resolve — never on a hiccup.
async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response | null> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(url, init);
      if (res.status === 200) return res;
      if (res.status !== 429 && res.status < 500) return res; // 404 etc — definitive
    } catch {
      // network error — fall through to backoff and retry
    }
    await sleep(800 * (attempt + 1));
  }
  return null;
}

async function doiResolves(doi: string): Promise<boolean> {
  const res = await fetchWithRetry(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: { 'User-Agent': 'gravity-room-citation-check/1.0 (mailto:luis.reche@agentero.com)' },
  });
  return res?.status === 200;
}

async function pmidResolves(pmid: string): Promise<boolean> {
  const res = await fetchWithRetry(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`
  );
  if (res === null || res.status !== 200) return false;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const json = (await res.json()) as { result?: Record<string, unknown> };
  return json.result?.[pmid] !== undefined;
}

// Sentinel values an article carries until a human signs off its factual review.
const UNREVIEWED = new Set(['PLACEHOLDER', 'PENDING']);

let citationFailures = 0;
let unreviewed = 0;
for (const a of EXERCISE_ARTICLES) {
  // Always verify citations resolve — even for not-yet-reviewed articles, so
  // a fabricated DOI is caught the moment the content lands.
  for (const r of a.references) {
    const ok = r.doi !== undefined ? await doiResolves(r.doi) : await pmidResolves(r.pmid ?? '');
    if (!ok) {
      console.error(`✗ ${a.exerciseId}: unresolved ${r.doi ?? r.pmid} — "${r.title}"`);
      citationFailures += 1;
    } else {
      console.error(`✓ ${a.exerciseId}: ${r.doi ?? r.pmid}`);
    }
    // Pace requests to stay under PubMed's ~3 req/s unauthenticated rate limit.
    await sleep(350);
  }
  if (UNREVIEWED.has(a.reviewedBy)) {
    console.error(`✗ ${a.exerciseId}: not reviewed (reviewedBy="${a.reviewedBy}")`);
    unreviewed += 1;
  }
}

if (citationFailures > 0 || unreviewed > 0) {
  console.error(`\n${citationFailures} citation failure(s), ${unreviewed} unreviewed article(s).`);
  process.exit(1);
}
console.error('\nAll citations resolved and all articles reviewed.');
