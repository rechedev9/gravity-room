import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// 4.2 — Route and rendering (REQ-ROUTE-001, REQ-ROUTE-003, REQ-ROUTE-004,
//        REQ-ROUTE-007, REQ-ROUTE-008)
// ---------------------------------------------------------------------------

test.describe('Program preview — route and rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/programs/gzclp');
  });

  test('renders the program name', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'GZCLP' })).toBeVisible({ timeout: 10_000 });
  });

  test('renders the program dossier and decision metadata', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'GZCLP' })).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText('Dossier')).toBeVisible();
    await expect(page.getByText('sesiones', { exact: true })).toBeVisible();
    await expect(page.getByText('días / semana', { exact: true })).toBeVisible();
  });

  test('stats tab is not visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'GZCLP' })).toBeVisible({ timeout: 10_000 });

    // Verify no stats-related UI is present
    await expect(page.getByText('Estadísticas')).not.toBeVisible();
    await expect(page.getByRole('tab', { name: /estad/i })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4.3 — Interactivity (REQ-ROUTE-005, REQ-ROUTE-006, REQ-ROUTE-009)
// ---------------------------------------------------------------------------

test.describe('Program preview — interactivity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/programs/gzclp');
    // Wait for the tracker to be fully loaded
    await expect(page.getByRole('heading', { name: 'GZCLP' })).toBeVisible({ timeout: 10_000 });
  });

  test('day navigation works (next and prev)', async ({ page }) => {
    // Verify we start at Day 1
    await expect(page.getByText('Día 1').first()).toBeVisible();

    // Click "Siguiente día" (Next) button
    const nextBtn = page.getByRole('button', { name: 'Siguiente día' });
    await nextBtn.click();

    // Now on Day 2
    await expect(page.getByText('Día 2').first()).toBeVisible();

    // Click "Día anterior" (Prev) button
    const prevBtn = page.getByRole('button', { name: 'Día anterior' });
    await prevBtn.click();

    // Back to Day 1
    await expect(page.getByText('Día 1').first()).toBeVisible();
  });

  test('cycle cards select their first workout', async ({ page }) => {
    const secondWeek = page.getByRole('button', { name: /Semana 2/i });
    await secondWeek.click();

    await expect(secondWeek).toHaveAttribute('aria-pressed', 'true');
  });

  test('account CTA is visible for unauthenticated users', async ({ page }) => {
    await expect(page.getByRole('link', { name: /crear cuenta/i }).first()).toBeVisible();
  });

  test('preview does not expose fake result controls', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Marcar .+ éxito/ })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Marcar .+ fallo/ })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4.4 — Landing page links (REQ-LANDING-001, REQ-LANDING-002)
// ---------------------------------------------------------------------------

test.describe('Program preview — landing page links', () => {
  test('catalog cards have links to /programs/:id', async ({ page }) => {
    await page.goto('/');
    await page.locator('#programs').scrollIntoViewIfNeeded();

    // Wait for catalog to load
    await expect(page.getByText('5/3/1 for Beginners', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });

    const previewLink = page
      .locator('a[href="/programs/531-for-beginners"]')
      .filter({ has: page.getByText('5/3/1 for Beginners') })
      .first();
    await expect(previewLink).toBeVisible();
  });

  test('clicking a catalog card navigates to the preview page', async ({ page }) => {
    await page.goto('/');
    await page.locator('#programs').scrollIntoViewIfNeeded();

    // Wait for catalog to load
    await expect(page.getByText('5/3/1 for Beginners', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });

    const previewLink = page
      .locator('a[href="/programs/531-for-beginners"]')
      .filter({ has: page.getByText('5/3/1 for Beginners') })
      .first();
    await previewLink.click();

    // Should navigate to the preview page
    await expect(page).toHaveURL(/\/programs\/531-for-beginners/);

    // Preview page should render the program
    await expect(page.getByText('Día 1').first()).toBeVisible({ timeout: 10_000 });
  });
});
