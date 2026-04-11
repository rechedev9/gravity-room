import * as matchers from '@testing-library/jest-dom/matchers';
import { afterEach, expect } from 'bun:test';
import { cleanup } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from '../src/lib/i18n/locales/es/translation.json';
import en from '../src/lib/i18n/locales/en/translation.json';

// happy-dom is registered in register-dom.ts (must run first via preload order)
expect.extend(matchers);

// Initialize i18next synchronously for tests — no LanguageDetector, forced Spanish.
// Tests assert Spanish copy; deterministic language avoids locale drift from happy-dom defaults.
// useSuspense:false so components don't suspend waiting for async loads (resources are static).
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
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
