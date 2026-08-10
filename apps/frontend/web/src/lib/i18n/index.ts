import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

type SupportedLng = 'es' | 'en';

const localeLoaders: Record<
  SupportedLng,
  () => Promise<{ readonly default: Record<string, unknown> }>
> = {
  es: () => import('./locales/es/translation.json'),
  en: () => import('./locales/en/translation.json'),
};

function toSupportedLng(lng: string | undefined): SupportedLng {
  const base = (lng ?? 'es').split('-')[0];
  return base === 'en' ? 'en' : 'es';
}

/** Ensure a locale bundle is registered before switching to it. */
export async function ensureLocale(lng: string): Promise<SupportedLng> {
  const supported = toSupportedLng(lng);
  if (!i18n.hasResourceBundle(supported, 'translation')) {
    const mod = await localeLoaders[supported]();
    i18n.addResourceBundle(supported, 'translation', mod.default, true, true);
  }
  return supported;
}

const backend = {
  type: 'backend' as const,
  init(): void {
    // no-op — loaders are static imports of JSON chunks
  },
  read(
    language: string,
    _namespace: string,
    callback: (err: Error | null, data: Record<string, unknown> | boolean) => void
  ): void {
    const lng = toSupportedLng(language);
    void localeLoaders[lng]()
      .then((mod) => {
        callback(null, mod.default);
      })
      .catch((err: unknown) => {
        callback(err instanceof Error ? err : new Error(String(err)), false);
      });
  },
};

void i18n
  .use(backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Only the detected locale is fetched; the other language stays out of the
    // entry chunk (~80–90 KB JSON each).
    partialBundledLanguages: true,
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    ns: ['translation'],
    defaultNS: 'translation',
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
