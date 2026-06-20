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

let failures = 0;
for (const a of EXERCISE_ARTICLES) {
  if (a.reviewedBy === 'PLACEHOLDER') {
    console.error(`✗ ${a.exerciseId}: still PLACEHOLDER (not reviewed)`);
    failures++;
    continue;
  }
  for (const r of a.references) {
    const ok = r.doi !== undefined ? await doiResolves(r.doi) : await pmidResolves(r.pmid ?? '');
    if (!ok) {
      console.error(`✗ ${a.exerciseId}: unresolved ${r.doi ?? r.pmid} — "${r.title}"`);
      failures++;
    } else {
      console.error(`✓ ${a.exerciseId}: ${r.doi ?? r.pmid}`);
    }
  }
}
if (failures > 0) {
  console.error(`\n${failures} citation failure(s).`);
  process.exit(1);
}
console.error('\nAll citations resolved.');
