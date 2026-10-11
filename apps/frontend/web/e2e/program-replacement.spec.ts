import { test, expect, type Page } from '@playwright/test';
import { resolvePlaywrightApiUrl } from '../playwright-ports';
import { createAndAuthUser, createTestProgram } from './helpers/api';
import {
  ensureCompactView,
  guestWithProgram,
  markTierSuccess,
  navigateToPrograms,
  programCard,
  readStorage,
} from './helpers/seed';

const API_URL = resolvePlaywrightApiUrl(process.env);

interface Seeded {
  readonly accessToken: string;
}

async function userWithActiveGzclp(page: Page): Promise<Seeded> {
  const { accessToken } = await createAndAuthUser(page);
  await createTestProgram(page, accessToken);
  return { accessToken };
}

/** `programId:status` pairs as the server sees them, so the UI is not trusted to judge itself. */
async function programStatuses(page: Page, seeded: Seeded): Promise<readonly string[]> {
  const res = await page.request.get(`${API_URL}/api/programs`, {
    headers: { Authorization: `Bearer ${seeded.accessToken}` },
  });
  const body: unknown = await res.json();
  const list: unknown = Array.isArray(body) ? body : (body as { data: unknown }).data;
  return (list as { programId: string; status: string }[])
    .map((p) => `${p.programId}:${p.status}`)
    .sort();
}

async function walkStartFlowToFirstDay(page: Page, programName: RegExp): Promise<void> {
  await page.goto('/app/start');
  await page.getByTestId('start-program-card').filter({ hasText: programName }).first().click();
  await page.getByTestId('start-program-continue').click();
  for (let i = 0; i < 8; i++) {
    if (await page.getByTestId('start-step-first-day').isVisible()) break;
    const weight = page.getByTestId('start-weight-value');
    if ((await weight.innerText()) === '—') {
      for (let k = 0; k < 9; k++) {
        await page
          .getByRole('button', { name: /subir carga/i })
          .first()
          .click();
      }
    }
    await page.getByTestId('start-weights-next').click();
  }
  await expect(page.getByTestId('start-begin-day')).toBeVisible();
}

test.describe('Starting a program while another is active', () => {
  test('guided /app/start asks first and leaves the active program alone on cancel', async ({
    page,
  }) => {
    const seeded = await userWithActiveGzclp(page);
    await walkStartFlowToFirstDay(page, /StrongLifts/i);

    await page.getByTestId('start-begin-day').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('¿Empezar StrongLifts 5x5?');
    await expect(dialog).toContainText('GZCLP');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();

    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/app\/start$/);
    expect(await programStatuses(page, seeded)).toEqual(['gzclp:active']);
  });

  test('guided /app/start ends the active program once confirmed', async ({ page }) => {
    const seeded = await userWithActiveGzclp(page);
    await walkStartFlowToFirstDay(page, /StrongLifts/i);

    await page.getByTestId('start-begin-day').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Finalizar y empezar' }).click();

    await expect(page).toHaveURL(/\/app\/tracker\/stronglifts-5x5$/);
    expect(await programStatuses(page, seeded)).toEqual([
      'gzclp:completed',
      'stronglifts-5x5:active',
    ]);
  });

  test('the legacy setup form asks first, then ends the active program once confirmed', async ({
    page,
  }) => {
    const seeded = await userWithActiveGzclp(page);
    await page.goto('/app/programs');
    await programCard(page, 'StrongLifts 5x5')
      .getByRole('button', { name: 'Iniciar Programa' })
      .click();
    await page.getByRole('button', { name: 'Generar Programa' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('¿Empezar StrongLifts 5x5?');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    expect(await programStatuses(page, seeded)).toEqual(['gzclp:active']);

    await page.getByRole('button', { name: 'Generar Programa' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Finalizar y empezar' }).click();

    await expect(page.getByTestId('session-chrome')).toBeVisible();
    expect(await programStatuses(page, seeded)).toEqual([
      'gzclp:completed',
      'stronglifts-5x5:active',
    ]);
  });

  test('a first program starts without any question', async ({ page }) => {
    await createAndAuthUser(page);
    await page.goto('/app/programs');
    await programCard(page, 'GZCLP').getByRole('button', { name: 'Iniciar Programa' }).click();
    await page.getByRole('button', { name: 'Generar Programa' }).click();

    await expect(page.getByTestId('session-chrome')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('a guest is asked before a start deletes the results logged on the device', async ({
    page,
  }) => {
    const storedProgram = async (): Promise<string> => {
      const data = (await readStorage(page, 'gzclp_guest_v1')) as {
        instances: Record<string, { programId: string; results: Record<string, unknown> }>;
      } | null;
      const instance = data?.instances['guest'];
      return `${instance?.programId}:${Object.keys(instance?.results ?? {}).length}`;
    };

    await guestWithProgram(page, 'GZCLP');
    await ensureCompactView(page);
    await markTierSuccess(page, 'T1');
    await expect.poll(storedProgram).toBe('gzclp:1');

    // Opening another program must not touch the stored one.
    await navigateToPrograms(page);
    await programCard(page, 'StrongLifts 5x5')
      .getByRole('button', { name: 'Iniciar Programa' })
      .click();
    await expect(page).toHaveURL(/\/app\/tracker\/stronglifts-5x5$/);
    // A full load skips the route cross-fade, which would remount the form under the dialog.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Generar Programa' })).toBeVisible();
    expect(await storedProgram()).toBe('gzclp:1');

    await page.getByRole('button', { name: 'Generar Programa' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('¿Empezar StrongLifts 5x5?');
    await expect(dialog).toContainText('se borrarán');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    expect(await storedProgram()).toBe('gzclp:1');

    await page.getByRole('button', { name: 'Generar Programa' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reemplazar y empezar' }).click();
    await expect(page.getByTestId('session-chrome')).toBeVisible();
    await expect.poll(storedProgram).toBe('stronglifts-5x5:0');
  });
});
