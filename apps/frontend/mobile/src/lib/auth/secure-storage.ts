import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'auth.refresh-token';

export interface RefreshTokenStorage {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<void>;
  clearRefreshToken(): Promise<void>;
}

export const secureRefreshTokenStorage: RefreshTokenStorage = {
  async getRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },
  async setRefreshToken(token) {
    // WHEN_UNLOCKED_THIS_DEVICE_ONLY makes the refresh token non-migratable and
    // excluded from device backups, so a token lifted from a backup/restored
    // keychain can't be replayed against /auth/mobile/refresh on another device.
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async clearRefreshToken() {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
