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

// The app's i18n instance uses LanguageDetector + async backend.
// In CI the detector may pick 'en' or leave the language unresolved, causing
// components to render raw i18n keys.
//
// Strategy:
// 1. Wait for i18n to finish initializing (it may be async due to LanguageDetector).
// 2. Load both locale bundles synchronously (override any async-loaded versions).
// 3. Force Spanish as the active language.
// This ensures every test worker starts with stable, fully-resolved translations.
if (!i18n.isInitialized) {
  await new Promise<void>((resolve) => {
    i18n.on('initialized', () => resolve());
  });
}
i18n.addResourceBundle('es', 'translation', es, true, true);
i18n.addResourceBundle('en', 'translation', en, true, true);
await i18n.changeLanguage('es');

afterEach(() => {
  cleanup();
  localStorage.clear();
  // Reset language to Spanish after each test in case a test changed it
  void i18n.changeLanguage('es');
});
