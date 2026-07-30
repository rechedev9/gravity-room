import { test, expect } from '@playwright/test';
import { guestWithProgram } from './helpers/seed';

/**
 * Visual / UX polish gates from the tracker audit:
 * secondary edit CTA, dense set table, min progress fill, custom RPE listbox,
 * and brand-aligned classic-light accent (gold family, not indigo).
 */

test.describe('Tracker visual polish', () => {
  test.beforeEach(async ({ page }) => {
    await guestWithProgram(page, 'GZCLP');
  });

  test('weights pill edit is secondary (rule border) and overflow is readable', async ({
    page,
  }) => {
    const pill = page.getByTestId('weights-pill');
    await expect(pill).toBeVisible();
    // Spanish locale: "+2 más" (not a bare "+2")
    await expect(pill).toContainText(/\+\d+\s+más/i);

    const edit = page.getByTestId('weights-pill-edit');
    await expect(edit).toBeVisible();
    await expect(edit).toHaveCSS('border-color', /.*/);
    // Gold accent border must not be used on this secondary control.
    const className = (await edit.getAttribute('class')) ?? '';
    expect(className).toContain('border-rule');
    expect(className).not.toContain('border-accent');
    expect(className).not.toContain('text-accent');
  });

  test('set tables are width-capped with fixed layout for dense columns', async ({ page }) => {
    const table = page.getByTestId('slot-set-table').first();
    await expect(table).toBeVisible();
    const box = await table.boundingBox();
    expect(box).not.toBeNull();
    // max-w-[20rem] ≈ 320px; allow a little headroom for zoom/subpixel.
    expect(box!.width).toBeLessThanOrEqual(340);

    const tableLayout = await table.evaluate((el) => getComputedStyle(el).tableLayout);
    expect(tableLayout).toBe('fixed');
  });

  test('progress fill is still visible when only one workout is done', async ({ page }) => {
    // Confirm all sets of day 1 so progress becomes 1/90.
    for (let i = 0; i < 20; i++) {
      const next = page.locator('button[aria-label^="Confirmar serie"]:not([disabled])').first();
      if ((await next.count()) === 0) break;
      await next.click();
      // Dismiss rest timer if it appears.
      const skip = page.getByRole('button', { name: /saltar|omitir|continuar/i }).first();
      if (await skip.isVisible({ timeout: 200 }).catch(() => false)) {
        await skip.click().catch(() => {});
      }
    }

    const bar = page.getByRole('progressbar').first();
    await expect(bar).toContainText(/1\/\d+/);
    const fillWidth = await bar.locator('[data-fill]').evaluate((el) => {
      return parseFloat((el as HTMLElement).style.width);
    });
    // Must be the min-visible floor (4%), not the true 1%.
    expect(fillWidth).toBeGreaterThanOrEqual(4);
  });

  test('RPE uses a custom listbox after completing a primary lift', async ({ page }) => {
    // Complete T1 Sentadilla sets (5) so the footer RPE appears.
    for (let i = 0; i < 5; i++) {
      const next = page.locator('button[aria-label^="Confirmar serie"]:not([disabled])').first();
      await expect(next).toBeVisible({ timeout: 5_000 });
      await next.click();
      const skip = page.getByRole('button', { name: /saltar|omitir|continuar/i }).first();
      if (await skip.isVisible({ timeout: 200 }).catch(() => false)) {
        await skip.click().catch(() => {});
      }
    }

    const trigger = page.getByTestId('rpe-select-trigger').first();
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    expect(await page.locator('select[data-rpe-input]').count()).toBe(0);

    await trigger.click();
    await expect(page.getByTestId('rpe-select-listbox')).toBeVisible();
    await page.getByTestId('rpe-option-8').click();
    await expect(trigger).toContainText(/RPE 8/);
  });

  test('classic-light accent is warm gold, not cool indigo', async ({ page }) => {
    // Locale is es-ES; compact sidebar selector uses aria-label "Claro".
    await page.locator('[data-theme-option="classic-light"]').click();
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
      .toBe('classic-light');

    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim()
    );
    // oklch(L C H) — hue should sit in the warm gold band (~70–90), not ~265.
    const hueMatch = accent.match(/oklch\([^)]*\s([0-9.]+)\s*\)/i);
    expect(hueMatch, `accent token: ${accent}`).toBeTruthy();
    const hue = Number(hueMatch![1]);
    expect(hue).toBeGreaterThanOrEqual(70);
    expect(hue).toBeLessThanOrEqual(95);
  });
});
