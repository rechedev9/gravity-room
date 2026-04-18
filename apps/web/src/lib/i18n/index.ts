import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';

// Default locale (Spanish) ships statically so first-paint never waits on a fetch.
import es from './locales/es/translation.json';

// Non-default locales resolve through a dynamic import so they only load when
// the detector (or an explicit change) actually selects them.
const backend = resourcesToBackend(async (language: string) => {
  if (language === 'en') {
    const mod = await import('./locales/en/translation.json');
    return mod.default;
  }
  return {};
});

i18n
  .use(backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
    },
    partialBundledLanguages: true,
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
