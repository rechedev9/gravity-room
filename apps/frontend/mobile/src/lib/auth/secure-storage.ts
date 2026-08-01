import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'auth.refresh-token';
const SESSION_KIND_KEY = 'auth.session-kind';
const LOCAL_DATA_OWNER_KEY = 'auth.local-data-owner';

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

/**
 * Identifies which authenticated account owns the shared SQLite cache. Mobile
 * data is intentionally kept offline between transient auth failures, so the
 * owner marker lets the next successful sign-in distinguish a returning user
 * from an account switch before any cached data or outbox mutation is exposed.
 */
export interface LocalDataOwnerStorage {
  getOwnerId(): Promise<string | null>;
  setOwnerId(userId: string): Promise<void>;
  clearOwnerId(): Promise<void>;
}

/**
 * SecureStore is native-only. On web (Expo web preview) fall back to
 * localStorage so dev login / cookie sessions still work in Chrome.
 */
async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Quota / private mode — session still works for the current tab via memory.
    }
    return;
  }
  // WHEN_UNLOCKED_THIS_DEVICE_ONLY makes the value non-migratable and excluded
  // from device backups, so a token lifted from a backup can't be replayed on
  // another device.
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function storageDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const secureRefreshTokenStorage: RefreshTokenStorage = {
  async getRefreshToken() {
    return storageGet(REFRESH_TOKEN_KEY);
  },
  async setRefreshToken(token) {
    await storageSet(REFRESH_TOKEN_KEY, token);
  },
  async clearRefreshToken() {
    await storageDelete(REFRESH_TOKEN_KEY);
  },
};

export const secureSessionKindStorage: SessionKindStorage = {
  async getSessionKind() {
    const value = await storageGet(SESSION_KIND_KEY);
    return value === 'google' || value === 'email' ? value : null;
  },
  async setSessionKind(kind) {
    await storageSet(SESSION_KIND_KEY, kind);
  },
  async clearSessionKind() {
    await storageDelete(SESSION_KIND_KEY);
  },
};

export const secureLocalDataOwnerStorage: LocalDataOwnerStorage = {
  async getOwnerId() {
    return storageGet(LOCAL_DATA_OWNER_KEY);
  },
  async setOwnerId(userId) {
    await storageSet(LOCAL_DATA_OWNER_KEY, userId);
  },
  async clearOwnerId() {
    await storageDelete(LOCAL_DATA_OWNER_KEY);
  },
};
