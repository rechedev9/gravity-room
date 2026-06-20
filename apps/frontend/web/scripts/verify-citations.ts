// apps/frontend/web/scripts/verify-citations.ts
import { EXERCISE_ARTICLES } from '../src/features/exercise-wiki/content/registry';

async function doiResolves(doi: string): Promise<boolean> {
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: { 'User-Agent': 'gravity-room-citation-check/1.0 (mailto:luis.reche@agentero.com)' },
  });
  return res.status === 200;
}

async function pmidResolves(pmid: string): Promise<boolean> {
  const res = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`
  );
  if (res.status !== 200) return false;
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
      citationFailures++;
    } else {
      console.error(`✓ ${a.exerciseId}: ${r.doi ?? r.pmid}`);
    }
  }
  if (UNREVIEWED.has(a.reviewedBy)) {
    console.error(`✗ ${a.exerciseId}: not reviewed (reviewedBy="${a.reviewedBy}")`);
    unreviewed++;
  }
}

if (citationFailures > 0 || unreviewed > 0) {
  console.error(`\n${citationFailures} citation failure(s), ${unreviewed} unreviewed article(s).`);
  process.exit(1);
}
console.error('\nAll citations resolved and all articles reviewed.');
