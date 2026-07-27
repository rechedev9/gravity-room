import * as SecureStore from 'expo-secure-store';

import { parseProgramInstanceId } from '../../navigation/routes';

const TRACKER_PROGRAM_KEY = 'navigation.tracker-program';

export async function readTrackerProgramId(): Promise<string | null> {
  return parseProgramInstanceId(await SecureStore.getItemAsync(TRACKER_PROGRAM_KEY));
}

export async function writeTrackerProgramId(programInstanceId: string): Promise<void> {
  const validProgramInstanceId = parseProgramInstanceId(programInstanceId);
  if (validProgramInstanceId === null) {
    throw new Error('Cannot persist an invalid tracker program identifier');
  }

  await SecureStore.setItemAsync(TRACKER_PROGRAM_KEY, validProgramInstanceId, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
