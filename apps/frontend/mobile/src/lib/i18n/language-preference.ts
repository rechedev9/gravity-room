import { useSyncExternalStore } from 'react';
import i18n, { detectDeviceLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from './index';
import {
  deviceSettingStorage,
  type DeviceSettingStorage,
} from '../settings/device-setting-storage';

export type LanguagePreference = 'system' | SupportedLanguage;
export const LANGUAGE_CHOICES: readonly LanguagePreference[] = ['system', ...SUPPORTED_LANGUAGES];

const STORAGE_KEY = 'settings.language';

export function parseLanguagePreference(value: string | null): LanguagePreference {
  return LANGUAGE_CHOICES.find((choice) => choice === value) ?? 'system';
}

/** `system` follows the device language, falling back to English when it is not shipped. */
export function resolveLanguage(
  preference: LanguagePreference,
  deviceLanguage: SupportedLanguage = detectDeviceLanguage()
): SupportedLanguage {
  return preference === 'system' ? deviceLanguage : preference;
}

let current: LanguagePreference = 'system';
const listeners = new Set<() => void>();

function publish(next: LanguagePreference): void {
  current = next;
  void i18n.changeLanguage(resolveLanguage(next));
  listeners.forEach((listener) => listener());
}

export function getLanguagePreference(): LanguagePreference {
  return current;
}

/** Loads the stored choice once at startup; a read failure keeps following the device. */
export async function restoreLanguagePreference(
  storage: DeviceSettingStorage = deviceSettingStorage
): Promise<void> {
  publish(parseLanguagePreference(await storage.get(STORAGE_KEY)));
}

/** The choice applies immediately; a write failure only loses persistence. */
export async function setLanguagePreference(
  preference: LanguagePreference,
  storage: DeviceSettingStorage = deviceSettingStorage
): Promise<void> {
  publish(preference);
  try {
    await storage.set(STORAGE_KEY, preference);
  } catch {
    // The session keeps the choice; the next launch follows the device again.
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLanguagePreference(): LanguagePreference {
  return useSyncExternalStore(subscribe, getLanguagePreference, getLanguagePreference);
}
