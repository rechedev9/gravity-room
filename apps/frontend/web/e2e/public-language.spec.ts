import { test, expect, type Page } from '@playwright/test';
import { skipFirstRunOverlays } from './helpers/api';

// Route pairs where the URL, not the browser language, decides the page language.
const PAIRS = [
  {
    es: '/programas',
    en: '/en/programs',
    esH1: 'Programas de entrenamiento',
    enH1: 'Workout programs',
  },
  {
    es: '/programas/gzclp-vs-stronglifts',
    en: '/en/programs/gzclp-vs-stronglifts',
    esH1: 'GZCLP vs StrongLifts 5x5',
    enH1: 'GZCLP vs StrongLifts 5x5',
  },
  {
    es: '/programas/progresion-automatica',
    en: '/en/programs/automatic-progression',
    esH1: 'Progresión automática y sobrecarga progresiva',
    enH1: 'Automatic progression and progressive overload',
  },
  { es: '/ejercicios', en: '/en/exercises', esH1: 'Wiki de ejercicios', enH1: 'Exercise wiki' },
  {
    es: '/ejercicios/versus',
    en: '/en/exercises/versus',
    esH1: 'Versus de ejercicios',
    enH1: 'Exercise versus',
  },
  { es: '/', en: '/en', esH1: 'Entra. Entrena.', enH1: 'Walk in. Train.' },
] as const;

async function expectPage(page: Page, path: string, lang: 'es' | 'en', h1: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('h1').first()).toContainText(h1, { ignoreCase: true });
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
}

for (const browserLocale of ['es-ES', 'en-US'] as const) {
  test.describe(`browser language ${browserLocale}`, () => {
    test.use({ locale: browserLocale });

    test('the route decides the language of localized public pages', async ({ page }) => {
      await skipFirstRunOverlays(page);
      for (const pair of PAIRS) {
        await expectPage(page, pair.es, 'es', pair.esH1);
        await expectPage(page, pair.en, 'en', pair.enH1);
      }
    });

    test('visiting a page in the other language does not change the stored preference', async ({
      page,
    }) => {
      await skipFirstRunOverlays(page);
      const other = browserLocale === 'es-ES' ? '/en/exercises/versus' : '/ejercicios/versus';
      await page.goto(other);
      await page.getByRole('button', { name: /^(compare|comparar)$/i }).click();
      await expect(page.getByTestId('versus-axis-breakdown')).toBeVisible();

      await page.goto('/privacy');
      await expect(page.locator('html')).toHaveAttribute(
        'lang',
        browserLocale === 'es-ES' ? 'es' : 'en'
      );
      const stored = await page.evaluate(() => localStorage.getItem('gravity-room-locale'));
      expect(stored).toBe(browserLocale === 'es-ES' ? 'es' : 'en');
    });

    test('pages without a language of their own follow the browser and say so in <html lang>', async ({
      page,
    }) => {
      await skipFirstRunOverlays(page);
      const expected = browserLocale === 'es-ES' ? 'es' : 'en';
      for (const path of ['/login', '/privacy', '/cookies']) {
        await page.goto(path);
        await expect(page.locator('h1, h2').first()).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', expected);
      }
    });
  });
}
