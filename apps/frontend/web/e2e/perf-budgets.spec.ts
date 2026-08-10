/**
 * Objective frontend performance harness.
 *
 * Run: `pnpm --filter web e2e:perf`
 * Artifacts: `apps/frontend/web/test-results/perf/perf-report.{json,md}`
 *
 * Budgets are soft upper bounds (local + CI variance). Always check the written
 * report when iterating; tighten numbers only after a stable baseline.
 */
import { test, expect } from '@playwright/test';
import { buildSuccessResults } from './helpers/fixtures';
import {
  expandDayControls,
  navigateToTracker,
  seedProgram,
  tierOutcomeButton,
  tierUndoButton,
} from './helpers/seed';
import {
  PERF_BUDGETS,
  cdpHeapMetrics,
  flushPerfReport,
  measureInteraction,
  measureNavigation,
  recordExtra,
} from './helpers/perf';

test.describe.configure({ mode: 'serial' });

test.describe('Frontend perf budgets', () => {
  test.afterAll(() => {
    flushPerfReport();
  });

  test('landing cold navigation metrics', async ({ page }) => {
    // Mobile-ish viewport matches PERF-BASELINE lab conditions (without CPU/network
    // throttle — Playwright does not enable DevTools throttling by default).
    await page.setViewportSize({ width: 390, height: 844 });
    const nav = await measureNavigation(page, '/');
    await cdpHeapMetrics(page, 'landing-after-load');

    // Prefer FCP/LCP; fall back to DCL when paint timing is unavailable so the
    // harness still produces a comparable number for iteration.
    const paintOrDcl = nav.fcpMs ?? nav.domContentLoadedMs;
    expect(paintOrDcl).toBeGreaterThan(0);
    expect(paintOrDcl).toBeLessThan(PERF_BUDGETS.landingFcpMs);
    if (nav.lcpMs !== null) {
      expect(nav.lcpMs).toBeLessThan(PERF_BUDGETS.landingLcpMs);
    }
    recordExtra('landing_fcp_ms', nav.fcpMs);
    recordExtra('landing_lcp_ms', nav.lcpMs);
    recordExtra('landing_dcl_ms', Math.round(nav.domContentLoadedMs));
    recordExtra('landing_load_ms', Math.round(nav.loadMs));
    recordExtra('landing_transfer_bytes', nav.transferSizeBytes);
  });

  test('tracker ready + mark-set interaction', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // Fresh program so day 1 T1 is the first pending action (compact view).
    await seedProgram(page);

    const ready = await measureInteraction(page, 'tracker-ready', async () => {
      await navigateToTracker(page);
    });
    await cdpHeapMetrics(page, 'tracker-ready');
    expect(ready.durationMs).toBeLessThan(PERF_BUDGETS.trackerReadyMs);
    recordExtra('tracker_ready_ms', Math.round(ready.durationMs));

    // Default tracker view is detailed/set-first; switch to compact for whole-tier mark.
    await expandDayControls(page);
    const compactBtn = page.getByRole('button', { name: 'Cambiar a vista compacta' });
    if (await compactBtn.isVisible().catch(() => false)) {
      await compactBtn.click();
    }

    const mark = await measureInteraction(page, 'mark-t1-success', async () => {
      const btn = tierOutcomeButton(page, 'T1', 'éxito');
      await expect(btn).toBeVisible({ timeout: 10_000 });
      await btn.click();
      await expect(tierUndoButton(page, 'T1', 'éxito')).toBeVisible({ timeout: 5_000 });
    });
    expect(mark.durationMs).toBeLessThan(PERF_BUDGETS.markSetMs);
    recordExtra('mark_set_ms', Math.round(mark.durationMs));
  });

  test('history list virtualizes long completed history', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // 60 completed days → HistoryView virtualizes (threshold 40).
    await seedProgram(page, { results: buildSuccessResults(60) });
    await navigateToTracker(page);
    await expandDayControls(page);

    await page.getByRole('button', { name: 'Historial real', pressed: false }).click();
    await expect(page.getByTestId('history-microcopy')).toBeVisible({ timeout: 10_000 });

    const list = page.getByTestId('history-list');
    await expect(list).toBeVisible();
    const virtualized = await list.getAttribute('data-virtualized');
    recordExtra('history_virtualized', virtualized === 'true');
    expect(virtualized).toBe('true');

    const rowCount = await page.getByTestId('history-row').count();
    recordExtra('history_dom_rows', rowCount);
    expect(rowCount).toBeLessThan(PERF_BUDGETS.historyDomRowsMax);
    expect(rowCount).toBeGreaterThan(0);

    // Off-screen content is reachable via scroll (virtual window moves).
    await list.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect
      .poll(async () => page.getByTestId('history-row').count(), { timeout: 2_000 })
      .toBeLessThan(PERF_BUDGETS.historyDomRowsMax);

    const afterScroll = await page.getByTestId('history-row').count();
    recordExtra('history_dom_rows_after_scroll', afterScroll);
    await cdpHeapMetrics(page, 'history-virtualized');
  });
});
