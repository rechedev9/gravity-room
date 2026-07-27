import * as SecureStore from 'expo-secure-store';

import { secureLocalDataOwnerStorage, secureRefreshTokenStorage } from './secure-storage';

const mockedSecureStore = jest.mocked(SecureStore);

describe('secureRefreshTokenStorage', () => {
  afterEach(() => {
    mockedSecureStore.getItemAsync.mockReset();
    mockedSecureStore.setItemAsync.mockReset();
    mockedSecureStore.deleteItemAsync.mockReset();
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
