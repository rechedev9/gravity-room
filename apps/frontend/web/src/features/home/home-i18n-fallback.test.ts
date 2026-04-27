import { describe, it, expect } from 'bun:test';
import { createInstance } from 'i18next';
import es from '@/lib/i18n/locales/es/translation.json';

describe('i18n fallback when key missing in active language', () => {
  it('resolves the Spanish value instead of rendering the raw key', async () => {
    const isolated = createInstance();
    await isolated.init({
      resources: {
        es: { translation: es },
        en: { translation: { home: { empty: {} } } },
      },
      lng: 'en',
      fallbackLng: 'es',
      interpolation: { escapeValue: false },
    });

    const result = isolated.t('home.empty.guest_title');

    expect(result).toBe('Modo invitado');
    expect(result).not.toBe('home.empty.guest_title');
  });
});
