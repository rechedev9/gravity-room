import { afterEach } from 'vitest';
// Registers the @testing-library/jest-dom matchers on vitest's expect and
// augments the vitest type definitions in one import.
import '@testing-library/jest-dom/vitest';
// Note: virtual:pwa-register/react is resolved to a stub via vitest.config.ts
// (resolve.alias), so no module mock is needed here.
import { cleanup } from '@testing-library/react';
// Import the app's i18n instance to ensure it is resolved and initialized
// before any component import does so asynchronously.
import i18n from '../src/lib/i18n/index';
import en from '../src/lib/i18n/locales/en/translation.json';
import es from '../src/lib/i18n/locales/es/translation.json';

// Keep translations deterministic in tests regardless of detected browser locale.
// Do not mock react-i18next globally so unrelated test files don't see raw-key
// translations leak in.
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
