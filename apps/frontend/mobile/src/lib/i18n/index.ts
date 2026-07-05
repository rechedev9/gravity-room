import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

// Both locales ship statically — the JSON catalogs are small, and inlining them
// keeps init synchronous (no async backend), so `useTranslation` is ready on the
// very first render and in tests without a Suspense boundary.
import en from './locales/en/translation.json';
import es from './locales/es/translation.json';

export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const FALLBACK_LANGUAGE: SupportedLanguage = 'en';

function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return typeof value === 'string' && SUPPORTED_LANGUAGES.some((language) => language === value);
}

/**
 * Resolves the initial UI language from the device locale (e.g. an `es-ES`
 * device reports `languageCode: 'es'`), falling back to English when the device
 * language is not one we ship or locale lookup fails.
 */
export function detectDeviceLanguage(
  readLocales: () => ReadonlyArray<{ languageCode: string | null }> = getLocales
): SupportedLanguage {
  try {
    for (const locale of readLocales()) {
      if (isSupportedLanguage(locale.languageCode)) {
        return locale.languageCode;
      }
    }
  } catch {
    // Fall through to the default when the native locale bridge is unavailable.
  }

  return FALLBACK_LANGUAGE;
}

if (!i18n.isInitialized) {
  // Init is synchronous because all resources are inlined; we intentionally do
  // not await it. `useSuspense: false` matches React Native, which has no
  // Suspense-based data loading like the web app.
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: detectDeviceLanguage(),
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });
}

export default i18n;
