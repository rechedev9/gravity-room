import i18n from './index';
import {
  getLanguagePreference,
  parseLanguagePreference,
  resolveLanguage,
  restoreLanguagePreference,
  setLanguagePreference,
} from './language-preference';
import type { DeviceSettingStorage } from '../settings/device-setting-storage';

function memoryStorage(initial: string | null): DeviceSettingStorage & { value: string | null } {
  const storage = {
    value: initial,
    async get(): Promise<string | null> {
      return storage.value;
    },
    async set(_key: string, value: string): Promise<void> {
      storage.value = value;
    },
  };
  return storage;
}

afterEach(async () => {
  await restoreLanguagePreference(memoryStorage(null));
});

describe('language preference', () => {
  it('ignores stored values that are not a shipped choice', () => {
    expect(parseLanguagePreference('fr')).toBe('system');
    expect(parseLanguagePreference(null)).toBe('system');
    expect(parseLanguagePreference('es')).toBe('es');
  });

  it('follows the device language until a language is chosen', () => {
    expect(resolveLanguage('system', 'es')).toBe('es');
    expect(resolveLanguage('en', 'es')).toBe('en');
  });

  it('applies a stored choice at startup', async () => {
    await restoreLanguagePreference(memoryStorage('es'));
    expect(getLanguagePreference()).toBe('es');
    expect(i18n.language).toBe('es');
    expect(i18n.t('common.retry')).toBe('Reintentar');
  });

  it('persists a new choice and switches immediately', async () => {
    const storage = memoryStorage(null);
    await setLanguagePreference('es', storage);
    expect(storage.value).toBe('es');
    expect(i18n.language).toBe('es');
    await setLanguagePreference('system', storage);
    expect(i18n.language).toBe('en');
  });

  it('keeps the choice for the session when persisting fails', async () => {
    const storage: DeviceSettingStorage = {
      get: async () => null,
      set: async () => {
        throw new Error('disk full');
      },
    };
    await expect(setLanguagePreference('es', storage)).resolves.toBeUndefined();
    expect(i18n.language).toBe('es');
  });
});
