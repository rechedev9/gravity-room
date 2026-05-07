import * as matchers from '@testing-library/jest-dom/matchers';
import { afterEach, expect } from 'bun:test';
import { cleanup } from '@testing-library/react';
// Import the app's i18n instance to ensure it is resolved and initialized
// before any component import does so asynchronously.
import i18n from '../src/lib/i18n/index';
import en from '../src/lib/i18n/locales/en/translation.json';

// happy-dom is registered in register-dom.ts (must run first via preload order)
expect.extend(matchers);

// The app's i18n instance uses LanguageDetector + async backend.
// In CI the detector may pick 'en' or leave the language unresolved, causing
// components to render raw i18n keys. We force Spanish and load both bundles
// synchronously so every test worker starts with stable, resolved translations.
i18n.addResourceBundle('en', 'translation', en, true, true);
await i18n.changeLanguage('es');

afterEach(() => {
  cleanup();
  localStorage.clear();
  // Reset language to Spanish after each test in case a test changed it
  void i18n.changeLanguage('es');
});
