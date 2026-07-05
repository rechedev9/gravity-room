import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'auth.refresh-token';
const SESSION_KIND_KEY = 'auth.session-kind';

export interface RefreshTokenStorage {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<void>;
  clearRefreshToken(): Promise<void>;
}

/**
 * How the current session authenticates, so session restore knows which path to
 * use. `google` sessions carry a device-stored refresh token; `email` sessions
 * keep their refresh token in an httpOnly cookie (native cookie jar) and are
 * restored/revoked via the cookie-based routes. The marker is the source of
 * truth for "is there an email session to restore?": clearing it on sign-out
 * makes local sign-out authoritative even when remote revocation fails offline,
 * and prevents restoring a stale cookie session for a different account.
 */
export type SessionKind = 'google' | 'email';

export interface SessionKindStorage {
  getSessionKind(): Promise<SessionKind | null>;
  setSessionKind(kind: SessionKind): Promise<void>;
  clearSessionKind(): Promise<void>;
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

export const secureSessionKindStorage: SessionKindStorage = {
  async getSessionKind() {
    const value = await SecureStore.getItemAsync(SESSION_KIND_KEY);
    return value === 'google' || value === 'email' ? value : null;
  },
  async setSessionKind(kind) {
    await SecureStore.setItemAsync(SESSION_KIND_KEY, kind, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async clearSessionKind() {
    await SecureStore.deleteItemAsync(SESSION_KIND_KEY);
  },
};
