import * as matchers from '@testing-library/jest-dom/matchers';
import { afterEach, expect } from 'bun:test';
import { cleanup } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from '../src/lib/i18n/locales/es/translation.json';
import en from '../src/lib/i18n/locales/en/translation.json';

// happy-dom is registered in register-dom.ts (must run first via preload order)
expect.extend(matchers);

// Initialize i18next for tests — no LanguageDetector, forced Spanish.
// top-level await ensures translations are fully ready before any test in this
// worker runs (Bun executes preload/setup modules as async ES modules).
if (!i18n.isInitialized) {
  await i18n.use(initReactI18next).init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    lng: 'es',
    fallbackLng: 'es',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
