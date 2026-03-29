import { test, expect } from '@playwright/test';
import { programCard, dismissCookieBannerIfPresent } from './helpers/seed';
import { createAndAuthUser } from './helpers/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Authenticate a user, navigate to dashboard, and click "Personalizar" on a catalog card. */
async function openCustomizeWizard(
  page: import('@playwright/test').Page,
  programName: string
): Promise<{ accessToken: string }> {
  const { accessToken } = await createAndAuthUser(page);
  await page.goto('/app');
  await expect(page.getByText('Elegir un Programa')).toBeVisible({ timeout: 10_000 });

  // Click the "Personalizar" button — it's a sibling of the card inside a flex-col wrapper
  const card = programCard(page, programName);
  await expect(card).toBeVisible({ timeout: 10_000 });

  // Navigate up to the flex-col wrapper via xpath, then find the Personalizar button
  const wrapper = card.locator('xpath=..');
  const personalizeBtn = wrapper.getByRole('button', { name: 'Personalizar' });

  // Click and wait for the fork API response
  const [forkResponse] = await Promise.all([
    page.waitForResponse((resp) => resp.url().includes('/program-definitions/fork'), {
      timeout: 15_000,
    }),
    personalizeBtn.click(),
  ]);

  // If fork failed, throw a helpful error
  if (!forkResponse.ok()) {
    const body = await forkResponse.text().catch(() => '(no body)');
    throw new Error(`Fork API failed: ${forkResponse.status()} — ${body}`);
  }

  // Wait for wizard to open (definition loads asynchronously)
  await expect(page.getByText('Editar programa')).toBeVisible({ timeout: 15_000 });
  return { accessToken };
}

/** Navigate through wizard steps until the progression step. */
async function navigateToProgressionStep(page: import('@playwright/test').Page): Promise<void> {
  // Step 1: Basic info — click "Siguiente"
  await expect(page.getByText('Paso 1 de 3')).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // Step 2: Days & exercises — click "Siguiente"
  await expect(page.getByText('Paso 2 de 3')).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // Step 3: Progression — now visible
  await expect(page.getByText('Paso 3 de 3')).toBeVisible();

  // The fixed cookie banner at bottom-0 intercepts clicks on buttons that scroll near
  // the bottom of the progression step (long GZCLP slot list).
  await dismissCookieBannerIfPresent(page);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Custom Programs — Customize flow', () => {
  test('clicking Personalizar opens the definition wizard', async ({ page }) => {
    await openCustomizeWizard(page, 'GZCLP');

    // Wizard is visible with step indicator
    await expect(page.getByText('Paso 1 de 3')).toBeVisible();
    // "Cerrar" button is visible
    await expect(page.getByText('Cerrar')).toBeVisible();
  });

  test('wizard navigates through all 3 steps', async ({ page }) => {
    await openCustomizeWizard(page, 'GZCLP');

    // Step 1
    await expect(page.getByText('Paso 1 de 3')).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // Step 2
    await expect(page.getByText('Paso 2 de 3')).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // Step 3 — progression step has "Vista previa" and save buttons
    await expect(page.getByText('Paso 3 de 3')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vista previa' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar y empezar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar borrador' })).toBeVisible();
  });

  test('wizard back navigation works', async ({ page }) => {
    await openCustomizeWizard(page, 'GZCLP');

    // Go to step 2
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByText('Paso 2 de 3')).toBeVisible();

    // Go back to step 1
    await page.getByRole('button', { name: 'Atras' }).click();
    await expect(page.getByText('Paso 1 de 3')).toBeVisible();
  });

  test('Cerrar closes the wizard', async ({ page }) => {
    await openCustomizeWizard(page, 'GZCLP');
    await page.getByText('Cerrar').click();

    // Wizard should be gone, back to dashboard
    await expect(page.getByText('Editar programa')).not.toBeVisible();
    await expect(page.getByText('Elegir un Programa')).toBeVisible();
  });
});

test.describe('Custom Programs — Progression step', () => {
  test('progression step shows slot cards for the program', async ({ page }) => {
    await openCustomizeWizard(page, 'GZCLP');
    await navigateToProgressionStep(page);

    // GZCLP has multiple slots — at least one slot card should be visible
    // Slot cards contain exercise names as headings or labels
    const slotCards = page.locator('[class*="border"]').filter({
      has: page.locator('button'),
    });
    await expect(slotCards.first()).toBeVisible();
  });

  test('Vista previa button fetches and displays preview table', async ({ page }) => {
    await openCustomizeWizard(page, 'GZCLP');
    await navigateToProgressionStep(page);

    // Click preview
    await page.getByRole('button', { name: 'Vista previa' }).click();

    // Should show loading state then table
    // Wait for a table to appear (PreviewTable renders a <table>)
    await expect(page.locator('table')).toBeVisible({ timeout: 15_000 });

    // Table should have rows
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
  });

  test('Guardar y empezar saves and creates a program instance', async ({ page }) => {
    await openCustomizeWizard(page, 'GZCLP');
    await navigateToProgressionStep(page);

    // Click save and start
    await page.getByRole('button', { name: 'Guardar y empezar' }).click();

    // Should navigate away from wizard to the tracker
    // The dashboard shows the active program card with "Continuar Entrenamiento"
    await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Custom Programs — My Definitions panel', () => {
  test('after customizing, definition appears in My Definitions', async ({ page }) => {
    // Fork a program, save as draft, then check panel
    await openCustomizeWizard(page, 'GZCLP');
    await navigateToProgressionStep(page);

    // Save as draft — stays on dashboard
    await page.getByRole('button', { name: 'Guardar borrador' }).click();

    // Wizard closes, back to dashboard
    await expect(page.getByText('Editar programa')).not.toBeVisible({ timeout: 10_000 });

    // "Mis Programas Personalizados" section should show the forked definition
    await expect(page.getByText('Mis Programas Personalizados')).toBeVisible();
    // The panel should contain at least one definition card
    const defPanel = page.locator('section').filter({
      has: page.getByText('Mis Programas Personalizados'),
    });
    await expect(defPanel.getByRole('button', { name: 'Editar' }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('Editar re-opens the wizard for an existing definition', async ({ page }) => {
    // Fork, save draft, then edit
    await openCustomizeWizard(page, 'GZCLP');
    await navigateToProgressionStep(page);
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page.getByText('Editar programa')).not.toBeVisible({ timeout: 10_000 });

    // Find the definition panel and click "Editar"
    const defPanel = page.locator('section').filter({
      has: page.getByText('Mis Programas Personalizados'),
    });
    await defPanel.getByRole('button', { name: 'Editar' }).first().click();

    // Wizard should reopen
    await expect(page.getByText('Editar programa')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Paso 1 de 3')).toBeVisible();
  });
});

test.describe('Custom Programs — Deletion guard', () => {
  test('deleting a definition with an active instance shows 409 error', async ({ page }) => {
    // Fork, navigate through wizard, save AND start (creates active instance)
    await openCustomizeWizard(page, 'GZCLP');
    await navigateToProgressionStep(page);
    await page.getByRole('button', { name: 'Guardar y empezar' }).click();

    // Wait for tracker to load (program is now active)
    await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 15_000 });

    // Navigate back to dashboard
    await page.goto('/app');
    await expect(page.getByText('Tu Programa')).toBeVisible({ timeout: 10_000 });

    // The "Mis Programas Personalizados" section should show the definition
    await expect(page.getByText('Mis Programas Personalizados')).toBeVisible();

    // Try to delete it — click "Eliminar" button
    const defPanel = page.locator('section').filter({
      has: page.getByText('Mis Programas Personalizados'),
    });
    const deleteBtn = defPanel.getByRole('button', { name: 'Eliminar' }).first();
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 });

    // Accept the window.confirm dialog that handleDelete triggers
    page.on('dialog', (dialog) => void dialog.accept());
    await deleteBtn.click();

    // Should show the Spanish 409 error message inline
    await expect(page.getByText(/no se puede eliminar/i)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Custom Programs — Guest mode', () => {
  test('Personalizar button is NOT visible in guest mode', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Probar sin cuenta' }).click();
    await page.waitForURL('**/app**', { timeout: 10_000 });
    await expect(page.getByText('Elegir un Programa')).toBeVisible({ timeout: 10_000 });

    // "Personalizar" should not appear — it's auth-only
    await expect(page.getByText('Personalizar')).not.toBeVisible();
  });
});
