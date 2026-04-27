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
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },
  async clearRefreshToken() {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
