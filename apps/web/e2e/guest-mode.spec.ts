import { test, expect } from '@playwright/test';
import { enterGuestMode, programCard, dismissCookieBannerIfPresent } from './helpers/seed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Enter guest mode and start a GZCLP program from the catalog. */
async function startGuestProgram(page: import('@playwright/test').Page): Promise<void> {
  await enterGuestMode(page);
  await expect(page.getByText('GZCLP')).toBeVisible({ timeout: 10_000 });
  // Guest cards have "Iniciar Programa" button (not "Ver Programa" link)
  await programCard(page, 'GZCLP').getByRole('button', { name: 'Iniciar Programa' }).click();
  await expect(page.getByText('Pesos Iniciales (kg)')).toBeVisible({ timeout: 10_000 });
}

/** Start a guest GZCLP program and generate it with default weights. */
async function generateGuestProgram(page: import('@playwright/test').Page): Promise<void> {
  await startGuestProgram(page);
  await page.getByRole('button', { name: 'Generar Programa' }).click();
  await expect(page.getByText('Día 1', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
}

// ===========================================================================
// REQ-GUI-001: Guest entry button on login page
// ===========================================================================

test.describe('Guest entry (REQ-GUI-001, REQ-GUI-007)', () => {
  test('login page shows "Probar sin cuenta" button', async ({ page }) => {
    await page.goto('/login');

    const btn = page.getByRole('button', { name: 'Probar sin cuenta' });
    await expect(btn).toBeVisible();
  });

  test('"Probar sin cuenta" button appears below the auth card', async ({ page }) => {
    await page.goto('/login');

    // Auth card label appears first, guest button below
    await expect(page.getByText('Autenticar')).toBeVisible();
    const btn = page.getByRole('button', { name: 'Probar sin cuenta' });
    await expect(btn).toBeVisible();
  });

  test('clicking "Probar sin cuenta" navigates to /app', async ({ page }) => {
    await enterGuestMode(page);

    expect(page.url()).toContain('/app');
  });
});

// ===========================================================================
// REQ-GUI-002: Persistent guest banner
// ===========================================================================

test.describe('Guest banner (REQ-GUI-002)', () => {
  test('banner is visible on dashboard', async ({ page }) => {
    await enterGuestMode(page);

    await expect(page.getByRole('status').filter({ hasText: 'Modo invitado' })).toBeVisible();
  });

  test('banner is visible on tracker', async ({ page }) => {
    await generateGuestProgram(page);

    await expect(page.getByRole('status').filter({ hasText: 'Modo invitado' })).toBeVisible();
  });

  test('banner has "Crear Cuenta" CTA', async ({ page }) => {
    await enterGuestMode(page);

    const banner = page.getByRole('status').filter({ hasText: 'Modo invitado' });
    await expect(banner.getByRole('button', { name: /crear cuenta/i })).toBeVisible();
  });

  test('banner not visible for unauthenticated non-guest', async ({ page }) => {
    await page.goto('/app');
    // Wait for page to settle
    await expect(page.getByText('Elegir un Programa')).toBeVisible({ timeout: 10_000 });
    // No guest banner
    await expect(page.getByRole('status').filter({ hasText: 'Modo invitado' })).not.toBeVisible();
  });
});

// ===========================================================================
// REQ-GUI-003, REQ-GUI-008: Guest sidebar CTA
// ===========================================================================

test.describe('Guest sidebar CTA (REQ-GUI-003, REQ-GUI-008)', () => {
  test('sidebar shows "Crear Cuenta" button for guests', async ({ page }) => {
    await enterGuestMode(page);

    const nav = page.getByRole('navigation').first();
    await expect(nav.getByRole('button', { name: /crear cuenta/i })).toBeVisible();
  });

  test('clicking sidebar "Crear Cuenta" exits guest mode and goes to /login', async ({ page }) => {
    await enterGuestMode(page);
    await dismissCookieBannerIfPresent(page);

    const nav = page.getByRole('navigation').first();
    await nav.getByRole('button', { name: /crear cuenta/i }).click();

    await page.waitForURL('**/login**', { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('clicking banner "Crear Cuenta" exits guest mode and goes to /login', async ({ page }) => {
    await enterGuestMode(page);

    const banner = page.getByRole('status').filter({ hasText: 'Modo invitado' });
    await banner.getByRole('button', { name: /crear cuenta/i }).click();

    await page.waitForURL('**/login**', { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('sidebar shows "Iniciar Sesión" for non-guest unauthenticated', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByText('Elegir un Programa')).toBeVisible({ timeout: 10_000 });

    const nav = page.getByRole('navigation').first();
    await expect(nav.getByRole('link', { name: /iniciar sesión/i })).toBeVisible();
    // No "Crear Cuenta" button
    await expect(nav.getByRole('button', { name: /crear cuenta/i })).not.toBeVisible();
  });
});

// ===========================================================================
// REQ-GUI-004, REQ-GUI-005, REQ-GUI-006: Blocked actions
// ===========================================================================

test.describe('Blocked guest actions (REQ-GUI-004, REQ-GUI-005, REQ-GUI-006)', () => {
  test('stats tab is visually disabled and shows toast on click', async ({ page }) => {
    await generateGuestProgram(page);

    // Stats tab should be visible
    const statsTab = page.getByRole('tab', { name: /estad/i });
    await expect(statsTab).toBeVisible();

    // Click the stats tab
    await statsTab.click();

    // Toast should appear
    await expect(page.getByText(/crea una cuenta/i).last()).toBeVisible({ timeout: 5_000 });
  });
});

// ===========================================================================
// REQ-GROUT-001, REQ-GROUT-006: Auth guard bypass & app entry
// ===========================================================================

test.describe('Guest routing (REQ-GROUT-001, REQ-GROUT-006)', () => {
  test('guest can access /app without redirect to /login', async ({ page }) => {
    await enterGuestMode(page);

    expect(page.url()).toContain('/app');
    await expect(page.getByText('GZCLP')).toBeVisible({ timeout: 10_000 });
  });

  test('non-guest unauthenticated at /app sees dashboard with "Iniciar Sesión"', async ({
    page,
  }) => {
    await page.goto('/app');
    // App renders dashboard (no auth required for dashboard)
    await expect(page.getByText('Elegir un Programa')).toBeVisible({ timeout: 10_000 });
    // Sidebar shows "Iniciar Sesión", not "Crear Cuenta"
    await expect(
      page
        .getByRole('navigation')
        .first()
        .getByRole('link', { name: /iniciar sesión/i })
    ).toBeVisible();
  });
});

// ===========================================================================
// REQ-GROUT-002: Hook selection (guest uses in-memory data)
// ===========================================================================

test.describe('Guest program hook (REQ-GROUT-002)', () => {
  test('guest can start and generate a program from the catalog', async ({ page }) => {
    await generateGuestProgram(page);

    await expect(page.getByText('Día 1', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('progressbar').last()).toBeVisible();
  });

  test('guest can mark a set and see it reflected', async ({ page }) => {
    await generateGuestProgram(page);

    // Find the first success button (aria-label: "Marcar {tier} éxito")
    const passBtn = page.getByRole('button', { name: /éxito/i }).first();
    await expect(passBtn).toBeVisible({ timeout: 5_000 });
    await passBtn.click();

    // After marking, progress bar should still be visible (updated)
    await expect(page.getByRole('progressbar').last()).toBeVisible();
  });
});

// ===========================================================================
// REQ-GROUT-003: View gating (profile blocked)
// ===========================================================================

test.describe('Guest view gating (REQ-GROUT-003)', () => {
  test('guest has no profile access — avatar dropdown hidden', async ({ page }) => {
    await enterGuestMode(page);

    // Guest sees dashboard with catalog
    await expect(page.getByText('GZCLP')).toBeVisible({ timeout: 10_000 });
    // Avatar dropdown trigger (profile entry point) is not rendered for guests
    await expect(page.getByRole('button', { name: 'Menú de usuario' })).not.toBeVisible();
    // "Iniciar Sesión" link is also hidden (guest has "Crear Cuenta" instead)
    await expect(
      page
        .getByRole('navigation')
        .first()
        .getByRole('link', { name: /iniciar sesión/i })
    ).not.toBeVisible();
    // Sidebar shows "Crear Cuenta" CTA
    await expect(
      page
        .getByRole('navigation')
        .first()
        .getByRole('button', { name: /crear cuenta/i })
    ).toBeVisible();
  });
});

// ===========================================================================
// REQ-GROUT-004: Dashboard guest catalog flow
// ===========================================================================

test.describe('Guest catalog flow (REQ-GROUT-004)', () => {
  test('guest sees catalog without active programs section', async ({ page }) => {
    await enterGuestMode(page);

    await expect(page.getByText('GZCLP')).toBeVisible({ timeout: 10_000 });
    // "Continuar Entrenamiento" should NOT be visible
    await expect(page.getByText('Continuar Entrenamiento')).not.toBeVisible();
  });

  test('guest sees "Iniciar Programa" buttons (not "Ver Programa" links)', async ({ page }) => {
    await enterGuestMode(page);

    await expect(page.getByText('GZCLP')).toBeVisible({ timeout: 10_000 });
    const gzclpCard = programCard(page, 'GZCLP');
    await expect(gzclpCard.getByRole('button', { name: 'Iniciar Programa' })).toBeVisible();
  });

  test('guest can select a program and reach setup form', async ({ page }) => {
    await startGuestProgram(page);

    await expect(page.getByText('Pesos Iniciales (kg)')).toBeVisible();
  });
});

// ===========================================================================
// REQ-GROUT-005: Stats tab blocking
// ===========================================================================

test.describe('Guest stats blocking (REQ-GROUT-005)', () => {
  test('stats tab is visible but disabled', async ({ page }) => {
    await generateGuestProgram(page);

    const statsTab = page.getByRole('tab', { name: /estad/i });
    await expect(statsTab).toBeVisible();

    // The inner span has reduced opacity (opacity-50 class)
    const statsLabel = statsTab.locator('span');
    await expect(statsLabel).toHaveClass(/opacity/);
  });
});

// ===========================================================================
// REQ-GCTX-004: Ephemeral state
// ===========================================================================

test.describe('Guest ephemeral state (REQ-GCTX-004)', () => {
  test('refreshing the page clears guest mode', async ({ page }) => {
    await enterGuestMode(page);

    // Confirm we're in guest mode — banner visible
    await expect(page.getByRole('status').filter({ hasText: 'Modo invitado' })).toBeVisible();
    const nav = page.getByRole('navigation').first();
    // Sidebar shows "Crear Cuenta"
    await expect(nav.getByRole('button', { name: /crear cuenta/i })).toBeVisible();

    // Reload the page — guest state is ephemeral (React useState, no persistence)
    await page.reload();
    await expect(page.getByText('Elegir un Programa')).toBeVisible({ timeout: 10_000 });

    // Guest banner should be gone
    await expect(page.getByRole('status').filter({ hasText: 'Modo invitado' })).not.toBeVisible();
    // Sidebar should show "Iniciar Sesión" instead of "Crear Cuenta"
    await expect(nav.getByRole('link', { name: /iniciar sesión/i })).toBeVisible();
  });
});
