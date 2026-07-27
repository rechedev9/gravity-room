import * as SecureStore from 'expo-secure-store';

import { readTrackerProgramId, writeTrackerProgramId } from './tracker-selection-storage';

const mockedSecureStore = jest.mocked(SecureStore);

describe('tracker selection storage', () => {
  afterEach(() => {
    mockedSecureStore.getItemAsync.mockReset();
    mockedSecureStore.setItemAsync.mockReset();
  });

  it('rejects invalid persisted tracker identifiers', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue('../profile');
    await expect(readTrackerProgramId()).resolves.toBeNull();
    await expect(writeTrackerProgramId('../profile')).rejects.toThrow(
      'Cannot persist an invalid tracker program identifier'
    );
  });
});
