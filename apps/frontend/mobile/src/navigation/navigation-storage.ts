import * as SecureStore from 'expo-secure-store';

import type { PrimaryTab } from './routes';

const LAST_PRIMARY_TAB_KEY = 'navigation.last-primary-tab';
const PRIMARY_TABS: readonly PrimaryTab[] = ['programs', 'tracker', 'profile'];

export function parsePrimaryTab(value: unknown): PrimaryTab | null {
  return PRIMARY_TABS.find((tab) => tab === value) ?? null;
}

export async function readLastPrimaryTab(): Promise<PrimaryTab | null> {
  return parsePrimaryTab(await SecureStore.getItemAsync(LAST_PRIMARY_TAB_KEY));
}

export async function writeLastPrimaryTab(tab: PrimaryTab): Promise<void> {
  await SecureStore.setItemAsync(LAST_PRIMARY_TAB_KEY, tab, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
