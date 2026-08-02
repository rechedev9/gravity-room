import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  canPersistRefreshToken,
  secureLocalDataOwnerStorage,
  secureRefreshTokenStorage,
} from './secure-storage';

const mockedSecureStore = jest.mocked(SecureStore);

describe('refresh-token persistence policy', () => {
  it.each([
    { platform: 'ios', isDevelopment: false, expected: true },
    { platform: 'android', isDevelopment: false, expected: true },
    { platform: 'web', isDevelopment: true, expected: true },
    { platform: 'web', isDevelopment: false, expected: false },
  ])(
    'returns $expected for $platform when development=$isDevelopment',
    ({ platform, isDevelopment, expected }) => {
      expect(canPersistRefreshToken(platform, isDevelopment)).toBe(expected);
    }
  );
});

describe('secureRefreshTokenStorage', () => {
  afterEach(() => {
    mockedSecureStore.getItemAsync.mockReset();
    mockedSecureStore.setItemAsync.mockReset();
    mockedSecureStore.deleteItemAsync.mockReset();
  });

  it('rejects JavaScript-readable refresh-token persistence on production Expo Web', async () => {
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    try {
      await expect(secureRefreshTokenStorage.setRefreshToken('body-refresh-token')).rejects.toThrow(
        /cookie-backed authentication/
      );
    } finally {
      if (originalPlatformDescriptor) {
        Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
      }
      if (originalDev === undefined) {
        delete (globalThis as { __DEV__?: boolean }).__DEV__;
      } else {
        (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
      }
    }
  });

  it('reads, writes, and clears refresh tokens through Expo SecureStore', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue('stored-refresh-token');
    mockedSecureStore.setItemAsync.mockResolvedValue();
    mockedSecureStore.deleteItemAsync.mockResolvedValue();

    await expect(secureRefreshTokenStorage.getRefreshToken()).resolves.toBe('stored-refresh-token');

    await secureRefreshTokenStorage.setRefreshToken('next-refresh-token');
    await secureRefreshTokenStorage.clearRefreshToken();

    expect(mockedSecureStore.getItemAsync).toHaveBeenCalledWith('auth.refresh-token');
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      'auth.refresh-token',
      'next-refresh-token',
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
    );
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth.refresh-token');
  });
});

describe('secureLocalDataOwnerStorage', () => {
  afterEach(() => {
    mockedSecureStore.getItemAsync.mockReset();
    mockedSecureStore.setItemAsync.mockReset();
    mockedSecureStore.deleteItemAsync.mockReset();
  });

  it('keeps the SQLite cache owner in non-migratable secure storage', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue('user-123');
    mockedSecureStore.setItemAsync.mockResolvedValue();
    mockedSecureStore.deleteItemAsync.mockResolvedValue();

    await expect(secureLocalDataOwnerStorage.getOwnerId()).resolves.toBe('user-123');
    await secureLocalDataOwnerStorage.setOwnerId('user-456');
    await secureLocalDataOwnerStorage.clearOwnerId();

    expect(mockedSecureStore.getItemAsync).toHaveBeenCalledWith('auth.local-data-owner');
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      'auth.local-data-owner',
      'user-456',
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
    );
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth.local-data-owner');
  });
});
