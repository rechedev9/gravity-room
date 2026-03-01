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
 * Navigates to the tracker view via the dashboard UI.
 * Requires a seeded active program to be present (seedProgram must be called first).
 * Gate: waits for 'Semana' text (WeekNavigator) to confirm tracker is live.
 */
export async function navigateToTracker(page: Page): Promise<void> {
  await page.goto('/app');
  // Wait for auth/refresh fetch to complete before asserting on authenticated content
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: 'Continuar Entrenamiento' })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Continuar Entrenamiento' }).click();
  await expect(page.getByText(/^Semana \d+$/)).toBeVisible({ timeout: 10_000 });
}

/**
 * Navigates to the GZCLP setup form from the dashboard catalog.
 * Requires authenticateOnly (no active program — user sees catalog, not active card).
 * Gate: waits for 'Pesos Iniciales (kg)' to confirm setup form is rendered.
 */
export async function navigateToGzclpSetup(page: Page): Promise<void> {
  await page.goto('/app');
  await expect(page.getByText('GZCLP')).toBeVisible({ timeout: 10_000 });
  const gzclpCard = page.locator('.card').filter({
    has: page.getByRole('heading', { name: 'GZCLP', level: 3 }),
  });
  await gzclpCard.getByRole('button', { name: 'Iniciar Programa' }).click();
  await expect(page.getByText('Pesos Iniciales (kg)')).toBeVisible({ timeout: 10_000 });
}
