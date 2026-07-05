import i18n, { detectDeviceLanguage, SUPPORTED_LANGUAGES } from './index';
import en from './locales/en/translation.json';
import es from './locales/es/translation.json';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe('detectDeviceLanguage', () => {
  it('returns the device language when it is one we ship', () => {
    expect(detectDeviceLanguage(() => [{ languageCode: 'es' }])).toBe('es');
    expect(detectDeviceLanguage(() => [{ languageCode: 'en' }])).toBe('en');
  });

  it('falls back to English for an unsupported device language', () => {
    expect(detectDeviceLanguage(() => [{ languageCode: 'fr' }])).toBe('en');
    expect(detectDeviceLanguage(() => [{ languageCode: null }])).toBe('en');
    expect(detectDeviceLanguage(() => [])).toBe('en');
  });

  it('picks the first supported language when several locales are present', () => {
    expect(
      detectDeviceLanguage(() => [{ languageCode: 'fr' }, { languageCode: 'es' }])
    ).toBe('es');
  });

  it('falls back to English when locale lookup throws', () => {
    expect(
      detectDeviceLanguage(() => {
        throw new Error('native locale bridge unavailable');
      })
    ).toBe('en');
  });
});

describe('i18n catalog', () => {
  it('initializes with both supported languages and no missing top-level namespaces', () => {
    expect(i18n.isInitialized).toBe(true);
    for (const language of SUPPORTED_LANGUAGES) {
      expect(i18n.hasResourceBundle(language, 'translation')).toBe(true);
    }
  });

  it('resolves representative onboarding keys in English and Spanish', () => {
    expect(i18n.getFixedT('en')('login.social.google')).toBe('Continue with Google');
    expect(i18n.getFixedT('es')('login.social.google')).toBe('Continuar con Google');
    expect(i18n.getFixedT('en')('programs.first_run.title')).toBe('No active program');
    expect(i18n.getFixedT('es')('programs.first_run.title')).toBe('Sin programa activo');
  });

  it('interpolates the catalog start accessibility label', () => {
    expect(i18n.getFixedT('en')('programs.start_accessibility', { name: 'GZCLP' })).toBe(
      'Start GZCLP'
    );
  });

  it('keeps the English and Spanish catalogs at identical key coverage (0 missing keys)', () => {
    const enKeys = flattenKeys(en).sort();
    const esKeys = flattenKeys(es).sort();
    expect(esKeys).toEqual(enKeys);
  });
});
