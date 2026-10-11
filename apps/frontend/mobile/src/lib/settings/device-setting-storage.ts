import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** Device-level preferences (not account data), kept apart from credentials. */
export interface DeviceSettingStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export const deviceSettingStorage: DeviceSettingStorage = {
  async get(key) {
    try {
      if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key, value) {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
};
