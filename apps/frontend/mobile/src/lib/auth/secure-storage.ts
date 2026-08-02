import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'auth.refresh-token';
const SESSION_KIND_KEY = 'auth.session-kind';
const LOCAL_DATA_OWNER_KEY = 'auth.local-data-owner';

/** Production Expo Web must use cookie-backed auth, never a JS-readable refresh token. */
export function canPersistRefreshToken(platform: string, isDevelopment: boolean): boolean {
  return platform !== 'web' || isDevelopment;
}

function refreshTokenPersistenceAllowed(): boolean {
  return canPersistRefreshToken(Platform.OS, __DEV__);
}

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
    if (key === REFRESH_TOKEN_KEY && !refreshTokenPersistenceAllowed()) {
      // Do not revive a token left by an earlier dev/preview build.
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        // Returning no credential remains fail closed even if cleanup is blocked.
      }
      return null;
    }
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
    if (key === REFRESH_TOKEN_KEY && !refreshTokenPersistenceAllowed()) {
      throw new Error(
        'Production Expo Web cannot persist refresh tokens; use cookie-backed authentication'
      );
    }
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch (error: unknown) {
      // Credential/owner state must not be reported as persisted when storage
      // rejected it. Callers fail closed instead of publishing an unsafe session.
      throw error;
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
    const storage = globalThis.localStorage;
    if (!storage) throw new Error('Web storage is unavailable');
    // Deletion is part of the sign-out durability boundary. Propagate failures
    // so callers retain the authenticated UI and offer a retry.
    storage.removeItem(key);
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
