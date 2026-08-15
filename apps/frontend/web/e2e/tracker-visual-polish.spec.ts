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

  test('chrome weight summary is readable and its edit control stays secondary', async ({
    page,
  }) => {
    const summary = page.getByTestId('session-chrome-weights');
    await expect(summary).toBeVisible();
    // Spanish locale: "+2 más" (not a bare "+2")
    await expect(summary).toContainText(/\+\d+\s+más/i);

    const edit = page.getByTestId('session-chrome-edit-weights');
    await expect(edit).toBeVisible();
    // Gold accent border must not be used on this secondary control.
    const className = (await edit.getAttribute('class')) ?? '';
    expect(className).toContain('border-rule');
    expect(className).not.toContain('border-accent');
    expect(className).not.toContain('text-accent');
  });

  test('session chrome is the only band above the exercises', async ({ page }) => {
    await expect(page.getByTestId('session-chrome')).toBeVisible();
    // No separate weights pill, day pill or Programa/Estadísticas tablist survives.
    await expect(page.getByTestId('weights-pill')).toHaveCount(0);
    await expect(page.getByRole('tablist')).toHaveCount(0);
    const box = await page.getByTestId('session-chrome').boundingBox();
    expect(box?.height).toBeLessThanOrEqual(120);
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

  test('desktop exercises use the available width without stretching set tables', async ({
    page,
  }) => {
    const grid = page.getByTestId('detailed-day-grid');
    const columns = await grid.evaluate((el) =>
      getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean)
    );
    expect(columns).toHaveLength(3);

    const table = page.getByTestId('slot-set-table').first();
    const box = await table.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(340);
  });

  test('week navigation stays compact and follows the selected workout', async ({ page }) => {
    await page.getByRole('button', { name: /cambiar día/i }).click();
    const weekSelect = page.getByRole('combobox', { name: /elegir semana del programa/i });
    await expect(weekSelect).toBeVisible();
    await expect(page.getByRole('button', { name: /semana anterior/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /semana siguiente/i })).toBeVisible();
    const panel = await page.getByTestId('tracker-day-navigation-panel').boundingBox();
    expect(panel?.height).toBeLessThanOrEqual(310);
    await expect(page.getByRole('button', { name: /vista compacta/i })).toBeVisible();

    const nextDay = page.getByRole('button', { name: /siguiente día/i });
    await nextDay.click();
    await nextDay.click();
    await nextDay.click();

    await expect(weekSelect).toHaveValue('1');
    await expect(weekSelect.locator('option:checked')).toContainText(/SEM 2|WK 2/i);
  });

  test('mobile chrome keeps one progress surface and a compact weight summary', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('progressbar')).toHaveCount(1);
    await expect(page.getByTestId('session-chrome-weights')).toContainText(/\+\d+\s+más/i);
  });

  test('day progress fills as lifts are resolved', async ({ page }) => {
    const bar = page.getByRole('progressbar').first();
    await expect(bar).toContainText(/0\/\d+/);

    // Confirm every set of day 1.
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

    const fillWidth = await bar.locator('[data-fill]').evaluate((el) => {
      return parseFloat((el as HTMLElement).style.width);
    });
    expect(fillWidth).toBe(100);
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

  test('theme selector shows short labels and edit weights surfaces recalc callout', async ({
    page,
  }) => {
    // Compact selector shows the two available themes: Oro / Claro.
    await expect(page.locator('[data-theme-option="gold"]')).toContainText(/oro/i);
    await expect(page.locator('[data-theme-option="classic-light"]')).toContainText(/claro/i);
    await expect(page.locator('[data-theme-option="classic-dark"]')).toHaveCount(0);

    await page.getByTestId('session-chrome-edit-weights').click();
    await expect(page.getByTestId('setup-recalc-callout')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('setup-recalc-callout')).toContainText(/rec[aá]lculo/i);
  });

  test('discovery content no longer sits under the exercises', async ({ page }) => {
    // Finish every confirmable set on day 1.
    for (let i = 0; i < 20; i++) {
      const next = page.locator('button[aria-label^="Confirmar serie"]:not([disabled])').first();
      if ((await next.count()) === 0) break;
      await next.click();
      const skip = page.getByRole('button', { name: /saltar|omitir|continuar/i }).first();
      if (await skip.isVisible({ timeout: 150 }).catch(() => false)) {
        await skip.click().catch(() => {});
      }
    }
    await expect(page.getByRole('progressbar').first()).toContainText(/(\d+)\//);
    // Neither the Sensei tip nor the "about this program" block belongs in a session.
    await expect(page.getByLabel('Consejo del Sensei')).toHaveCount(0);
    await expect(page.getByText(/acerca de/i)).toHaveCount(0);
  });
});
