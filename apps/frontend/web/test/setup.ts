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
// initAsync:false (i18next v26 API) with in-memory resources makes init synchronous,
// ensuring translations are ready before the first test assertion runs in any worker.
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    lng: 'es',
    fallbackLng: 'es',
    interpolation: { escapeValue: false },
    initAsync: false,
    react: { useSuspense: false },
  });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
