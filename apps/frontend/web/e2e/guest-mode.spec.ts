import { test, expect } from '@playwright/test';
import {
  enterGuestMode,
  navigateToPrograms,
  programCard,
  dismissCookieBannerIfPresent,
  authenticateOnly,
  readStorage,
} from './helpers/seed';

// localStorage key the guest program data lives under (see lib/guest-storage.ts).
const GUEST_STORAGE_KEY = 'gzclp_guest_v1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Enter guest mode and start a GZCLP program from the catalog. */
async function startGuestProgram(page: import('@playwright/test').Page): Promise<void> {
  await enterGuestMode(page);
  await navigateToPrograms(page);
  // Guest cards keep a compact direct-start action alongside program exploration.
  await programCard(page, 'GZCLP').getByRole('button', { name: 'Iniciar directamente' }).click();
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
    await expect(page.getByRole('heading', { name: /sin programa activo/i })).toBeVisible({
      timeout: 10_000,
    });
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

  test('clicking sidebar "Crear Cuenta" goes to /login and KEEPS guest data', async ({ page }) => {
    // Seed an in-progress guest program so there is data to preserve.
    await generateGuestProgram(page);
    await dismissCookieBannerIfPresent(page);

    const nav = page.getByRole('navigation').first();
    await nav.getByRole('button', { name: /crear cuenta/i }).click();

    await page.waitForURL('**/login**', { timeout: 10_000 });
    expect(page.url()).toContain('/login');

    // New semantics: the guest program survives to /login so it can be migrated
    // to the account after sign-in (REQ-GUI-008).
    expect(await readStorage(page, GUEST_STORAGE_KEY)).not.toBeNull();
  });

  test('clicking banner "Crear Cuenta" goes to /login and KEEPS guest data', async ({ page }) => {
    await generateGuestProgram(page);

    const banner = page.getByRole('status').filter({ hasText: 'Modo invitado' });
    await banner.getByRole('button', { name: /crear cuenta/i }).click();

    await page.waitForURL('**/login**', { timeout: 10_000 });
    expect(page.url()).toContain('/login');

    expect(await readStorage(page, GUEST_STORAGE_KEY)).not.toBeNull();
  });

  test('guest program is migrated to the account after signing in', async ({ page }) => {
    // 1. Guest starts a program (persisted in localStorage).
    await generateGuestProgram(page);

    // 2. "Create Account" leaves guest mode but keeps the data, landing on /login.
    const banner = page.getByRole('status').filter({ hasText: 'Modo invitado' });
    await banner.getByRole('button', { name: /crear cuenta/i }).click();
    await page.waitForURL('**/login**', { timeout: 10_000 });

    // 3. Authenticate (mints a session cookie shared with the browser context).
    await authenticateOnly(page);

    // 4. Landing in the app as an authenticated user triggers the migration.
    await page.goto('/app');

    // Assert the durable outcome, not the ephemeral success toast: it
    // auto-dismisses after 3s and can be gone before goto() resolves on slow
    // machines (the toast itself is covered by the use-guest-migration unit
    // tests). Migration done = guest storage cleared + program on the account.
    await expect
      .poll(async () => readStorage(page, GUEST_STORAGE_KEY), { timeout: 15_000 })
      .toBeNull();

    // The migrated program is the account's active program on the dashboard.
    await expect(page.getByText('GZCLP').first()).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar shows "Iniciar Sesión" for non-guest unauthenticated', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: /sin programa activo/i })).toBeVisible({
      timeout: 10_000,
    });

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
    // enterGuestMode already gates on guest mode status — page is loaded
  });

  test('non-guest unauthenticated at /app sees dashboard with "Iniciar Sesión"', async ({
    page,
  }) => {
    await page.goto('/app');
    // App renders dashboard (no auth required for dashboard)
    await expect(page.getByRole('heading', { name: /sin programa activo/i })).toBeVisible({
      timeout: 10_000,
    });
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

    // enterGuestMode gates on guest mode status — home page is loaded
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
    await navigateToPrograms(page);
    // Active-program CTAs should NOT be visible
    await expect(page.getByText(/continuar entrenamiento|entrar al hierro/i)).not.toBeVisible();
  });

  test('guest can explore or start a program directly', async ({ page }) => {
    await enterGuestMode(page);
    await navigateToPrograms(page);
    const gzclpCard = programCard(page, 'GZCLP');
    await expect(gzclpCard.getByRole('button', { name: 'Iniciar directamente' })).toBeVisible();
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
// REQ-GCTX-004: Guest persistence across reload
// ===========================================================================

test.describe('Guest persistence across reload (REQ-GCTX-004)', () => {
  test('reloading keeps guest mode active', async ({ page }) => {
    await enterGuestMode(page);

    // Confirm we're in guest mode — banner visible
    await expect(page.getByRole('status').filter({ hasText: 'Modo invitado' })).toBeVisible();
    const nav = page.getByRole('navigation').first();
    // Sidebar shows "Crear Cuenta"
    await expect(nav.getByRole('button', { name: /crear cuenta/i })).toBeVisible();

    // Reload the page - guest mode is persisted in localStorage, so it must
    // survive a reload (otherwise the router guard would bounce the guest to
    // /login and drop any in-progress workout).
    await page.reload();

    // Guest banner is still present, and the guest "Crear Cuenta" CTA remains.
    await expect(page.getByRole('status').filter({ hasText: 'Modo invitado' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(nav.getByRole('button', { name: /crear cuenta/i })).toBeVisible();
    // The "Iniciar Sesión" link (shown only to non-guests) must NOT appear.
    await expect(nav.getByRole('link', { name: /iniciar sesión/i })).not.toBeVisible();
  });

  test('reloading resumes the in-progress guest program', async ({ page }) => {
    await generateGuestProgram(page);

    // Return to the dashboard and reload to simulate a returning guest.
    await page.goto('/app');
    await page.reload();

    // The home page offers a "continue" hero back into the tracker.
    const resume = page.getByText('Continuar entrenamiento');
    await expect(resume).toBeVisible({ timeout: 10_000 });
    await resume.click();

    // Tracker reopens the persisted program (Día 1 row visible again).
    await expect(page.getByText('Día 1', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });
});
