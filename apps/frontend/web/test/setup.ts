import * as matchers from '@testing-library/jest-dom/matchers';
import { afterEach, expect } from 'bun:test';
import { cleanup } from '@testing-library/react';
// Import the app's i18n instance to ensure it is resolved and initialized
// before any component import does so asynchronously.
import i18n from '../src/lib/i18n/index';
import en from '../src/lib/i18n/locales/en/translation.json';
import es from '../src/lib/i18n/locales/es/translation.json';

// happy-dom is registered in register-dom.ts (must run first via preload order)
expect.extend(matchers);

// Keep translations deterministic in tests regardless of detected browser locale.
// Do not mock react-i18next globally: Bun keeps module mocks alive for the worker,
// which can leak raw-key translations into unrelated test files in CI.
if (!i18n.isInitialized) {
  await new Promise<void>((resolve) => {
    i18n.on('initialized', () => resolve());
  });
}
i18n.addResourceBundle('es', 'translation', es, true, true);
i18n.addResourceBundle('en', 'translation', en, true, true);
// Disable suspense so useTranslation resolves synchronously during tests
i18n.options.react = { ...i18n.options.react, useSuspense: false };
void i18n.changeLanguage('es');

afterEach(() => {
  cleanup();
  localStorage.clear();
  // Reset language to Spanish after each test in case a test changed it
  void i18n.changeLanguage('es');
});
