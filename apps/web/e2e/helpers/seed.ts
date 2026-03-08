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
 * Gate: waits for 'Día' text (DayNavigator) to confirm tracker is live.
 */
export async function navigateToTracker(page: Page): Promise<void> {
  await page.goto('/app');
  const continueBtn = page.getByRole('button', { name: 'Continuar Entrenamiento' });
  await expect(continueBtn).toBeVisible({ timeout: 10_000 });
  await continueBtn.click();
  await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 10_000 });
}

/**
 * Navigates to the GZCLP setup form from the dashboard catalog.
 * Requires authenticateOnly (no active program — user sees catalog, not active card).
 * Gate: waits for 'Pesos Iniciales (kg)' to confirm setup form is rendered.
 */
export async function navigateToGzclpSetup(page: Page): Promise<void> {
  await page.goto('/app');
  await expect(page.getByText('GZCLP')).toBeVisible({ timeout: 10_000 });
  await programCard(page, 'GZCLP').getByRole('button', { name: 'Iniciar Programa' }).click();
  await expect(page.getByText('Pesos Iniciales (kg)')).toBeVisible({ timeout: 10_000 });
}
