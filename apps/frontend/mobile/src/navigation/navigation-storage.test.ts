import * as SecureStore from 'expo-secure-store';

import { parsePrimaryTab, readLastPrimaryTab, writeLastPrimaryTab } from './navigation-storage';

const mockedSecureStore = jest.mocked(SecureStore);

describe('navigation storage', () => {
  afterEach(() => {
    mockedSecureStore.getItemAsync.mockReset();
    mockedSecureStore.setItemAsync.mockReset();
  });

  it('accepts only the three primary tabs', () => {
    expect(parsePrimaryTab('programs')).toBe('programs');
    expect(parsePrimaryTab('tracker')).toBe('tracker');
    expect(parsePrimaryTab('profile')).toBe('profile');
    expect(parsePrimaryTab('/program/unsafe')).toBeNull();
    expect(parsePrimaryTab(null)).toBeNull();
  });

  it('reads and writes the last primary tab', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue('profile');
    mockedSecureStore.setItemAsync.mockResolvedValue();

    await expect(readLastPrimaryTab()).resolves.toBe('profile');
    await writeLastPrimaryTab('tracker');

    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      'navigation.last-primary-tab',
      'tracker',
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
    );
  });
});
