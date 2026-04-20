const refreshTokenStore = new Map<string, string>();

const REFRESH_TOKEN_KEY = 'auth.refresh-token';

export interface RefreshTokenStorage {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<void>;
  clearRefreshToken(): Promise<void>;
}

export const secureRefreshTokenStorage: RefreshTokenStorage = {
  async getRefreshToken() {
    return refreshTokenStore.get(REFRESH_TOKEN_KEY) ?? null;
  },
  async setRefreshToken(token) {
    refreshTokenStore.set(REFRESH_TOKEN_KEY, token);
  },
  async clearRefreshToken() {
    refreshTokenStore.delete(REFRESH_TOKEN_KEY);
  },
};
