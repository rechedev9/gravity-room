import * as SecureStore from 'expo-secure-store';

import { secureRefreshTokenStorage } from './secure-storage';

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
      'next-refresh-token'
    );
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth.refresh-token');
  });
});
