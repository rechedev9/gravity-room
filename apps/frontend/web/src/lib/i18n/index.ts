import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Both locales ship statically — the JSON files are small and this avoids
// async backend races in tests (and on first render when the detector picks 'en').
import es from './locales/es/translation.json';
import en from './locales/en/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'gravity-room-locale',
      caches: ['localStorage'],
    },
    react: {
      useSuspense: true,
    },
  });

if (import.meta.hot) {
  import.meta.hot.accept('./locales/es/translation.json', (mod) => {
    if (mod) i18n.addResourceBundle('es', 'translation', mod.default, true, true);
  });
  import.meta.hot.accept('./locales/en/translation.json', (mod) => {
    if (mod) i18n.addResourceBundle('en', 'translation', mod.default, true, true);
  });
}

export default i18n;
