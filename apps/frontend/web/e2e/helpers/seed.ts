import { expect, type Locator, type Page } from '@playwright/test';
import { DEFAULT_WEIGHTS } from './fixtures';
import {
  createAndAuthUser,
  createTestProgram,
  seedResultsViaAPI,
  skipFirstRunOverlays,
} from './api';

interface SeedOptions {
  readonly startWeights?: typeof DEFAULT_WEIGHTS;
  readonly results?: Record<string, Record<string, string>>;
}

type Tier = 'T1' | 'T2' | 'T3';
type TierOutcome = 'éxito' | 'fallo';

/** Locate a whole-tier outcome action by its user-visible exercise/tier label. */
export function tierOutcomeButton(page: Page, tier: Tier, outcome: TierOutcome): Locator {
  return page
    .getByRole('button', {
      name: new RegExp(`^Marcar .+ \\(${tier}\\) como ${outcome}$`, 'i'),
    })
    .first();
}

/** Locate the result badge that undoes a previously recorded tier outcome. */
export function tierUndoButton(page: Page, tier: Tier, outcome: TierOutcome): Locator {
  return page
    .getByRole('button', {
      name: new RegExp(`^Deshacer .+ \\(${tier}\\) ${outcome}$`, 'i'),
    })
    .first();
}

/**
 * True when the hero lift promoted by `current-lift-card.tsx` (compact view's
 * "in progress" card) is currently showing the given tier. The hero has no
 * whole-slot pass/fail button — only the per-set flow below.
 */
async function isHeroTier(page: Page, tier: Tier): Promise<boolean> {
  const heroCard = page.getByTestId('current-lift-card');
  if (!(await heroCard.isVisible({ timeout: 1_000 }).catch(() => false))) return false;
  const tierText = await heroCard.locator('span').first().innerText();
  return tierText.trim().toUpperCase() === tier;
}

/**
 * Marks a tier as successful using whichever affordance is currently present:
 * the shared whole-slot ✓ (secondary/non-hero lifts) or, for the hero lift
 * promoted in compact view, the per-set confirm action repeated until the
 * lift resolves — confirming the last set auto-marks it successful (see
 * `useSetLogging`). The whole-slot ✓ is absent for the hero on purpose
 * (`current-lift-card.tsx`); this helper hides that difference from callers.
 */
export async function markTierSuccess(page: Page, tier: Tier): Promise<void> {
  const wholeSlotBtn = tierOutcomeButton(page, tier, 'éxito');
  if (await wholeSlotBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await wholeSlotBtn.click();
    return;
  }
  for (let i = 0; i < 10 && (await isHeroTier(page, tier)); i++) {
    await page.getByTestId('current-lift-card').getByTestId('current-lift-confirm-set').click();
  }
}

/**
 * Marks a tier as failed using whichever affordance is currently present:
 * the shared whole-slot ✗, or the hero lift's dedicated fail control.
 */
export async function markTierFail(page: Page, tier: Tier): Promise<void> {
  const wholeSlotBtn = tierOutcomeButton(page, tier, 'fallo');
  if (await wholeSlotBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await wholeSlotBtn.click();
    return;
  }
  if (await isHeroTier(page, tier)) {
    await page.getByTestId('current-lift-card').getByTestId('current-lift-fail').click();
    return;
  }
  throw new Error(`No fail control found for tier ${tier}`);
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
  const continueLink = page
    .getByRole('link', { name: /continuar entrenamiento|empezar entrenamiento/i })
    .first();
  await expect(continueLink).toBeVisible({ timeout: 10_000 });
  await continueLink.click();
  await expect(page.getByText(/^Día \d+$/).first()).toBeVisible({ timeout: 10_000 });
}

/**
 * Assert the selected tracker day using the session chrome band.
 * The day number and the "/ total" count render in separate spans
 * (see `session-chrome.tsx`), so match each structurally instead of
 * relying on a single text node containing both. The chrome also carries a
 * separate `dayName` span ("Día N") that only differs from the identity
 * pill ("DÍA N") by case — an unanchored case-insensitive match would hit
 * both, so this stays case-sensitive to pin down the identity pill alone.
 */
export async function expectSelectedDay(page: Page, day: number): Promise<void> {
  const chrome = page.getByTestId('session-chrome');
  await expect(chrome).toBeVisible({ timeout: 10_000 });
  await expect(chrome.getByText(new RegExp(`^DÍA ${day}$`))).toBeVisible({
    timeout: 10_000,
  });
}

/** Select a tracker workout by its 1-based day number using the public day-jump control. */
export async function selectWorkoutDay(page: Page, day: number): Promise<void> {
  await expandDayControls(page);
  await page.getByRole('spinbutton', { name: /ir al entrenamiento/i }).fill(String(day));
  await page.getByRole('button', { name: /ir al entrenamiento indicado/i }).click();
  await expectSelectedDay(page, day);
}

/** Open the collapsible day controls if they are currently collapsed. */
export async function expandDayControls(page: Page): Promise<void> {
  const changeDay = page.getByRole('button', { name: /cambiar día/i });
  if (await changeDay.isVisible({ timeout: 500 }).catch(() => false)) {
    await changeDay.click();
  }
  await expect(page.getByRole('button', { name: 'Siguiente día' })).toBeVisible({
    timeout: 5_000,
  });
}

/**
 * Switch the tracker to compact (slot-first) view so tier pass/fail buttons are
 * visible. No-op when already compact. Detailed (set-first) is the product default
 * and hides ResultCell until a result is committed.
 */
export async function ensureCompactView(page: Page): Promise<void> {
  await expandDayControls(page);
  const compactBtn = page.getByRole('button', { name: 'Cambiar a vista compacta' });
  if (await compactBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await compactBtn.click();
  }
  await expect(page.getByRole('button', { name: 'Cambiar a vista detallada' })).toBeVisible({
    timeout: 5_000,
  });
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
  await skipFirstRunOverlays(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Probar sin cuenta' }).click();
  await page.waitForURL('**/app**', { timeout: 10_000 });
  await expect(page.getByRole('status').filter({ hasText: 'Modo invitado' })).toBeVisible({
    timeout: 10_000,
  });
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
