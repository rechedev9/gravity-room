/**
 * Objective bundle-size report for the web production build.
 *
 * Usage (from repo root or web package):
 *   pnpm --filter web perf:baseline
 *
 * Writes:
 *   - stdout table (via console.warn — allowed by eslint)
 *   - apps/frontend/web/test-results/perf/bundle-report.{json,md}
 *
 * Exit code 1 only when hard budgets fail (recharts on entry, oversized entry).
 */
import { createGzip } from 'node:zlib';
import {
  createReadStream,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';

const WEB_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(WEB_ROOT, 'dist');
const ASSETS = join(DIST, 'assets');
const OUT_DIR = join(WEB_ROOT, 'test-results', 'perf');

/**
 * Hard budgets — fail the script when breached.
 * "Eager" = index.html module script + every modulepreload (critical path).
 * Calibrated after prerender preload sanitization (entry graph only on `/` base).
 */
const BUDGETS = {
  /** Eager JS raw size (pre-gzip). */
  eagerRawBytesMax: 650_000,
  /** Eager JS gzip. */
  eagerGzipBytesMax: 220_000,
  /** Total JS gzip across all assets. */
  totalJsGzipBytesMax: 1_200_000,
  /**
   * Max extra modulepreloads beyond the Vite entry graph on /login.html.
   * Guards against cross-route preload leaks from prerender.
   */
  loginExtraPreloadMax: 8,
} as const;

interface ChunkRow {
  readonly name: string;
  readonly rawBytes: number;
  readonly gzipBytes: number;
  readonly isEager: boolean;
  readonly looksLikeRecharts: boolean;
  readonly looksLikeMotion: boolean;
  readonly looksLikeI18nLocale: boolean;
}

async function gzipSize(path: string): Promise<number> {
  let total = 0;
  const counter = new Writable({
    write(chunk: Buffer, _enc, cb) {
      total += chunk.length;
      cb();
    },
  });
  await pipeline(createReadStream(path), createGzip({ level: 9 }), counter);
  return total;
}

function isEagerChunk(name: string, indexHtml: string): boolean {
  // Critical path = main module script + every modulepreload in index.html.
  return indexHtml.includes(name);
}

function log(line: string): void {
  // Scripts are CLI tools; warn is the allowed channel under the web eslint config.
  console.warn(line);
}

async function main(): Promise<void> {
  if (!existsSync(ASSETS)) {
    console.error(`[bundle:report] missing ${ASSETS} — run build:no-prerender first`);
    process.exit(2);
  }

  const indexHtml = existsSync(join(DIST, 'index.html'))
    ? readFileSync(join(DIST, 'index.html'), 'utf8')
    : '';
  const loginHtml = existsSync(join(DIST, 'login.html'))
    ? readFileSync(join(DIST, 'login.html'), 'utf8')
    : '';

  const files = readdirSync(ASSETS).filter((f) => f.endsWith('.js'));
  const rows: ChunkRow[] = [];

  for (const file of files) {
    const path = join(ASSETS, file);
    const rawBytes = statSync(path).size;
    const gzipBytes = await gzipSize(path);
    const lower = file.toLowerCase();
    rows.push({
      name: file,
      rawBytes,
      gzipBytes,
      isEager: isEagerChunk(file, indexHtml),
      looksLikeRecharts: /recharts|chart-theme|line-chart|volume-trend|cartesianchart/.test(lower),
      // Tiny misnamed stubs (~0.5 KB of jsx-runtime) are not real motion weight.
      looksLikeMotion: /vendor-motion|framer-motion/.test(lower) && gzipBytes >= 4_096,
      looksLikeI18nLocale: /translation-/.test(lower),
    });
  }

  rows.sort((a, b) => b.gzipBytes - a.gzipBytes);

  const eagerChunks = rows.filter((r) => r.isEager);
  const eagerGzip = eagerChunks.reduce((s, r) => s + r.gzipBytes, 0);
  const eagerRaw = eagerChunks.reduce((s, r) => s + r.rawBytes, 0);
  const totalJsGzip = rows.reduce((s, r) => s + r.gzipBytes, 0);
  const totalJsRaw = rows.reduce((s, r) => s + r.rawBytes, 0);

  const rechartsOnEager = eagerChunks.some((r) => r.looksLikeRecharts);
  const motionOnEager = eagerChunks.some((r) => r.looksLikeMotion);
  const localeChunks = rows.filter((r) => r.looksLikeI18nLocale);
  const localeOnEager = eagerChunks.some((r) => r.looksLikeI18nLocale);

  // Cross-route leak check: /login must not preload landing chunks.
  const loginPreloadHrefs = [...loginHtml.matchAll(/\bhref=["']([^"']+\.js)["']/g)].map(
    (m) => m[1] ?? ''
  );
  const loginHasLandingLeak = loginPreloadHrefs.some((h) => /landing/i.test(h));
  const loginPreloadCount = loginPreloadHrefs.filter((h) => h.includes('/assets/')).length;

  const report = {
    capturedAt: new Date().toISOString(),
    totals: {
      jsFiles: rows.length,
      totalJsRawBytes: totalJsRaw,
      totalJsGzipBytes: totalJsGzip,
      eagerRawBytes: eagerRaw,
      eagerGzipBytes: eagerGzip,
      eagerChunkNames: eagerChunks.map((r) => r.name),
      loginPreloadCount,
    },
    flags: {
      rechartsOnEager,
      motionOnEager,
      localeOnEager,
      localeChunkCount: localeChunks.length,
      loginHasLandingLeak,
    },
    budgets: BUDGETS,
    topChunks: rows.slice(0, 25).map((r) => ({
      name: r.name,
      rawBytes: r.rawBytes,
      gzipBytes: r.gzipBytes,
      isEager: r.isEager,
    })),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = join(OUT_DIR, 'bundle-report.json');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md: string[] = [
    `# Bundle report`,
    ``,
    `Captured: ${report.capturedAt}`,
    ``,
    `## Totals`,
    ``,
    `| Metric | Value |`,
    `| ------ | ----- |`,
    `| JS files | ${rows.length} |`,
    `| Total JS raw | ${fmt(totalJsRaw)} |`,
    `| Total JS gzip | ${fmt(totalJsGzip)} |`,
    `| Eager raw | ${fmt(eagerRaw)} |`,
    `| Eager gzip | ${fmt(eagerGzip)} |`,
    `| recharts on eager | ${rechartsOnEager ? 'YES ⚠️' : 'no ✓'} |`,
    `| motion on eager | ${motionOnEager ? 'YES ⚠️' : 'no ✓'} |`,
    `| locale JSON on eager | ${localeOnEager ? 'YES ⚠️' : 'no ✓'} |`,
    `| locale async chunks | ${localeChunks.length} |`,
    `| login landing leak | ${loginHasLandingLeak ? 'YES ⚠️' : 'no ✓'} |`,
    `| login preload count | ${loginPreloadCount} |`,
    ``,
    `## Top chunks (gzip)`,
    ``,
    `| Chunk | gzip | raw | eager |`,
    `| ----- | ---- | --- | ----- |`,
    ...rows
      .slice(0, 25)
      .map(
        (r) =>
          `| \`${basename(r.name)}\` | ${fmt(r.gzipBytes)} | ${fmt(r.rawBytes)} | ${r.isEager ? 'yes' : ''} |`
      ),
    ``,
  ];
  writeFileSync(join(OUT_DIR, 'bundle-report.md'), md.join('\n'), 'utf8');

  log('');
  log('=== Web bundle report ===');
  log(`Eager gzip: ${fmt(eagerGzip)}  (budget ${fmt(BUDGETS.eagerGzipBytesMax)})`);
  log(`Total JS gzip: ${fmt(totalJsGzip)}  (budget ${fmt(BUDGETS.totalJsGzipBytesMax)})`);
  log(`recharts on eager: ${rechartsOnEager ? 'FAIL' : 'ok'}`);
  log(`motion on eager: ${motionOnEager ? 'warn' : 'ok'}`);
  log(
    `locale on eager: ${localeOnEager ? 'warn' : 'ok'} (${localeChunks.length} async locale chunks)`
  );
  log(`login landing leak: ${loginHasLandingLeak ? 'FAIL' : 'ok'} (${loginPreloadCount} preloads)`);
  log('');
  log('Top 10 by gzip:');
  for (const r of rows.slice(0, 10)) {
    log(`  ${fmt(r.gzipBytes).padStart(10)}  ${r.isEager ? '[eager] ' : '        '}${r.name}`);
  }
  log('');
  log(`Wrote ${jsonPath}`);

  let failed = false;
  if (rechartsOnEager) {
    console.error('BUDGET FAIL: recharts appears in eager modulepreload graph');
    failed = true;
  }
  if (eagerGzip > BUDGETS.eagerGzipBytesMax) {
    console.error(`BUDGET FAIL: eager gzip ${eagerGzip} > ${BUDGETS.eagerGzipBytesMax}`);
    failed = true;
  }
  if (eagerRaw > BUDGETS.eagerRawBytesMax) {
    console.error(`BUDGET FAIL: eager raw ${eagerRaw} > ${BUDGETS.eagerRawBytesMax}`);
    failed = true;
  }
  if (totalJsGzip > BUDGETS.totalJsGzipBytesMax) {
    console.error(`BUDGET FAIL: total JS gzip ${totalJsGzip} > ${BUDGETS.totalJsGzipBytesMax}`);
    failed = true;
  }
  if (loginHasLandingLeak) {
    console.error('BUDGET FAIL: /login.html modulepreloads include landing chunks');
    failed = true;
  }
  if (loginHtml && loginPreloadCount > BUDGETS.loginExtraPreloadMax + 20) {
    // Entry graph is ~16; login may add a few. Fail only on egregious bloat.
    console.error(
      `BUDGET FAIL: login preload count ${loginPreloadCount} looks like a cross-route leak`
    );
    failed = true;
  }

  process.exit(failed ? 1 : 0);
}

function fmt(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

void main();
