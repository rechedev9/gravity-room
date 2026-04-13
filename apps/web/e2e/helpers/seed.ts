import { expect, type Page } from '@playwright/test';
import { DEFAULT_WEIGHTS } from './fixtures';
import { createAndAuthUser, createTestProgram, seedResultsViaAPI } from './api';

interface SeedOptions {
  readonly startWeights?: typeof DEFAULT_WEIGHTS;
  readonly results?: Record<string, Record<string, string>>;
}

/**
 * Creates a test user, authenticates them (setting cookies on the browser context),
 * and creates a GZCLP program. Must be called BEFORE page.goto() so that
 * the refresh_token cookie is present when AuthProvider fires.
 */
export async function seedProgram(page: Page, overrides?: SeedOptions): Promise<void> {
  const { accessToken } = await createAndAuthUser(page);
  const programId = await createTestProgram(page, accessToken, overrides?.startWeights);
  if (overrides?.results) {
    await seedResultsViaAPI(page, accessToken, programId, overrides.results);
  }
}

/** Authenticate only — no program created (for setup-flow tests). */
export async function authenticateOnly(page: Page): Promise<void> {
  await createAndAuthUser(page);
}

/** Read a localStorage key and parse it as JSON. */
export async function readStorage(page: Page, key: string): Promise<unknown> {
  return page.evaluate((k: string) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, key);
}

/**
 * Returns a locator for a program catalog card by its displayed name.
 * Used to scope interactions to a specific card without relying on DOM order.
 */
export function programCard(page: Page, name: string) {
  return page.locator('.card').filter({
    has: page.getByRole('heading', { name, level: 3 }),
  });
}

/**
 * Navigates to the tracker view via the dashboard UI.
 * Requires a seeded active program to be present (seedProgram must be called first).
 * Gate: waits for 'Día N' text (DayNavigator) to confirm tracker data is fully loaded,
 * not just the progressbar (which only requires config, not the catalog definition).
 */
export async function navigateToTracker(page: Page): Promise<void> {
  await page.goto('/app');
  const continueButton = page.getByRole('button', { name: 'Continuar Entrenamiento' });
  await expect(continueButton).toBeVisible({ timeout: 10_000 });
  await continueButton.click();
  await expect(page.getByText(/^Día \d+$/).first()).toBeVisible({ timeout: 10_000 });
}

/**
 * Navigates to the GZCLP setup form from the dashboard catalog.
 * Requires authenticateOnly (no active program — user sees catalog, not active card).
 * Gate: waits for 'Pesos Iniciales (kg)' to confirm setup form is rendered.
 */
export async function navigateToGzclpSetup(page: Page): Promise<void> {
  await page.goto('/app/programs');
  await expect(page.getByText('GZCLP')).toBeVisible({ timeout: 10_000 });
  await programCard(page, 'GZCLP').getByRole('button', { name: 'Iniciar Programa' }).click();
  await expect(page.getByText('Pesos Iniciales (kg)')).toBeVisible({ timeout: 10_000 });
}

/** Enter guest mode from the login page. Waits for home page to load. */
export async function enterGuestMode(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Probar sin cuenta' }).click();
  await page.waitForURL('**/app**', { timeout: 10_000 });
  await expect(page.getByText('Modo invitado')).toBeVisible({ timeout: 10_000 });
}

/**
 * SPA-navigate to /app/programs via sidebar link click.
 * Must use SPA navigation (not page.goto) to preserve ephemeral React state
 * such as guest mode which lives in useState and is lost on full page reload.
 */
export async function navigateToPrograms(page: Page): Promise<void> {
  await page.locator('a[href="/app/programs"]').first().click();
  await expect(page.getByText('GZCLP')).toBeVisible({ timeout: 10_000 });
}

/** Enter guest mode, start a program by name, and generate with default weights. */
export async function guestWithProgram(page: Page, name: string): Promise<void> {
  await enterGuestMode(page);
  await navigateToPrograms(page);
  await programCard(page, name).getByRole('button', { name: 'Iniciar Programa' }).click();
  await expect(page.getByRole('button', { name: 'Generar Programa' })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Generar Programa' }).click();
  await expect(page.getByText(/^Día \d+$/).first()).toBeVisible({ timeout: 10_000 });
}

/** Dismiss cookie consent banner if present — call before clicking buttons near the bottom of long pages. */
export async function dismissCookieBannerIfPresent(page: Page): Promise<void> {
  // Try to click the dismiss button; ignore failures if banner is not present.
  // Uses a 3s timeout to handle slow useEffect rendering in CI.
  await page
    .getByRole('button', { name: 'Entendido' })
    .click({ timeout: 3000 })
    .catch(() => {});
}

/** Dismiss RPE dialog if present — call after marking tiers, before navigating. */
export async function dismissRpeIfPresent(page: Page): Promise<void> {
  const rpeBtn = page.getByRole('button', { name: /continuar sin rpe/i });
  if (await rpeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await rpeBtn.click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
  }
}
