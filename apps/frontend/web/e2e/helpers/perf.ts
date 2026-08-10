import type { CDPSession, Page } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export interface NavigationMetrics {
  readonly path: string;
  readonly ttfbMs: number;
  readonly domContentLoadedMs: number;
  readonly loadMs: number;
  readonly fcpMs: number | null;
  readonly lcpMs: number | null;
  readonly transferSizeBytes: number;
}

export interface InteractionMetrics {
  readonly name: string;
  readonly durationMs: number;
}

export interface HeapMetrics {
  readonly jsHeapUsedSize: number;
  readonly jsHeapTotalSize: number;
  readonly nodes: number;
  readonly jsEventListeners: number;
}

export interface PerfReport {
  readonly capturedAt: string;
  readonly navigations: NavigationMetrics[];
  readonly interactions: InteractionMetrics[];
  readonly heaps: Array<{ readonly label: string } & HeapMetrics>;
  readonly extras: Record<string, number | string | boolean | null>;
}

const report: PerfReport = {
  capturedAt: new Date().toISOString(),
  navigations: [],
  interactions: [],
  heaps: [],
  extras: {},
};

/** Soft budgets — fail only on egregious regressions; print the rest for iteration. */
export const PERF_BUDGETS = {
  landingFcpMs: 3_000,
  landingLcpMs: 4_000,
  trackerReadyMs: 8_000,
  markSetMs: 800,
  historyDomRowsMax: 50,
} as const;

export async function measureNavigation(
  page: Page,
  path: string,
  opts?: { readonly waitUntil?: 'commit' | 'domcontentloaded' | 'load' | 'networkidle' }
): Promise<NavigationMetrics> {
  // Install observers before navigation so buffered paint/LCP entries are not missed
  // on fast prerendered routes.
  await page.addInitScript(() => {
    const w = window as Window & {
      __grPerf?: { fcp: number | null; lcp: number | null };
    };
    w.__grPerf = { fcp: null, lcp: null };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            w.__grPerf = { ...w.__grPerf!, fcp: entry.startTime };
          }
        }
      }).observe({ type: 'paint', buffered: true });
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          w.__grPerf = { ...w.__grPerf!, lcp: last.startTime };
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // Older engines without paint timing — nav timing still recorded.
    }
  });

  await page.goto(path, { waitUntil: opts?.waitUntil ?? 'load' });
  // Give the browser a frame to finalize LCP on static/prerendered HTML.
  await page.waitForTimeout(250);

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    const paints = performance.getEntriesByType('paint');
    const paintFcp = paints.find((p) => p.name === 'first-contentful-paint')?.startTime ?? null;
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    const paintLcp =
      lcpEntries.length > 0 ? (lcpEntries[lcpEntries.length - 1]?.startTime ?? null) : null;

    const w = window as Window & {
      __grPerf?: { fcp: number | null; lcp: number | null };
    };
    const observed = w.__grPerf;

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const transferSizeBytes = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);

    return {
      ttfbMs: nav ? Math.max(0, nav.responseStart - nav.requestStart) : 0,
      domContentLoadedMs: nav ? Math.max(0, nav.domContentLoadedEventEnd - nav.startTime) : 0,
      loadMs: nav ? Math.max(0, nav.loadEventEnd - nav.startTime) : 0,
      fcpMs: observed?.fcp ?? paintFcp,
      lcpMs: observed?.lcp ?? paintLcp,
      transferSizeBytes,
    };
  });

  const row: NavigationMetrics = { path, ...metrics };
  report.navigations.push(row);
  return row;
}

export async function measureInteraction(
  page: Page,
  name: string,
  run: () => Promise<void>
): Promise<InteractionMetrics> {
  const t0 = await page.evaluate(() => performance.now());
  await run();
  const t1 = await page.evaluate(() => performance.now());
  const row: InteractionMetrics = { name, durationMs: t1 - t0 };
  report.interactions.push(row);
  return row;
}

export async function cdpHeapMetrics(page: Page, label: string): Promise<HeapMetrics> {
  const client: CDPSession = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  const { metrics } = await client.send('Performance.getMetrics');
  const map = Object.fromEntries(metrics.map((m) => [m.name, m.value]));
  const row: HeapMetrics = {
    jsHeapUsedSize: map['JSHeapUsedSize'] ?? 0,
    jsHeapTotalSize: map['JSHeapTotalSize'] ?? 0,
    nodes: map['Nodes'] ?? 0,
    jsEventListeners: map['JSEventListeners'] ?? 0,
  };
  report.heaps.push({ label, ...row });
  await client.detach();
  return row;
}

export function recordExtra(key: string, value: number | string | boolean | null): void {
  report.extras[key] = value;
}

export function getPerfReport(): PerfReport {
  return {
    ...report,
    navigations: [...report.navigations],
    interactions: [...report.interactions],
    heaps: [...report.heaps],
    extras: { ...report.extras },
  };
}

/** Write JSON + human table under apps/frontend/web/test-results/perf/. */
export function flushPerfReport(filename = 'perf-report.json'): string {
  // Playwright loads helpers as CJS — avoid import.meta. package.json lives at cwd.
  const outDir = resolve(process.cwd(), 'test-results/perf');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, filename);
  const payload = getPerfReport();
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  // Also emit a compact markdown table next to it for quick PR comments.
  const mdPath = resolve(outDir, filename.replace(/\.json$/, '.md'));
  const lines: string[] = [
    `# Perf report`,
    ``,
    `Captured: ${payload.capturedAt}`,
    ``,
    `## Navigations`,
    ``,
    `| Path | TTFB | DCL | Load | FCP | LCP | Transfer |`,
    `| ---- | ---- | --- | ---- | --- | --- | -------- |`,
    ...payload.navigations.map(
      (n) =>
        `| \`${n.path}\` | ${fmt(n.ttfbMs)} | ${fmt(n.domContentLoadedMs)} | ${fmt(n.loadMs)} | ${fmt(n.fcpMs)} | ${fmt(n.lcpMs)} | ${fmtBytes(n.transferSizeBytes)} |`
    ),
    ``,
    `## Interactions`,
    ``,
    `| Name | Duration |`,
    `| ---- | -------- |`,
    ...payload.interactions.map((i) => `| ${i.name} | ${fmt(i.durationMs)} |`),
    ``,
    `## Heap (CDP)`,
    ``,
    `| Label | JSHeapUsed | Nodes | Listeners |`,
    `| ----- | ---------- | ----- | --------- |`,
    ...payload.heaps.map(
      (h) =>
        `| ${h.label} | ${fmtBytes(h.jsHeapUsedSize)} | ${Math.round(h.nodes)} | ${Math.round(h.jsEventListeners)} |`
    ),
    ``,
    `## Extras`,
    ``,
    ...Object.entries(payload.extras).map(([k, v]) => `- **${k}**: \`${String(v)}\``),
    ``,
  ];
  writeFileSync(mdPath, lines.join('\n'), 'utf8');
  console.warn(`[perf] wrote ${outPath}`);
  console.warn(`[perf] wrote ${mdPath}`);
  return outPath;
}

function fmt(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return '—';
  return `${Math.round(ms)} ms`;
}

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
