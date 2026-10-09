import {
  getRestAlertsPreference,
  markRestAlertsPromptSeen,
  restoreRestAlertsPreference,
  setRestAlertsEnabled,
} from './rest-alerts-preference';
import type { DeviceSettingStorage } from '../settings/device-setting-storage';

function storageWith(values: Record<string, string>): DeviceSettingStorage {
  return {
    get: async (key) => values[key] ?? null,
    set: async (key, value) => {
      values[key] = value;
    },
  };
}

it('defaults to enabled with the invitation not yet seen', async () => {
  await restoreRestAlertsPreference(storageWith({}));
  expect(getRestAlertsPreference()).toEqual({ enabled: true, promptSeen: false, loaded: true });
});

it('restores an explicit off choice and a dismissed invitation', async () => {
  await restoreRestAlertsPreference(
    storageWith({ 'settings.rest-alerts': 'off', 'settings.rest-alerts-prompt-seen': 'yes' })
  );
  expect(getRestAlertsPreference()).toEqual({ enabled: false, promptSeen: true, loaded: true });
});

it('persists changes and survives a failing write for the session', async () => {
  const values: Record<string, string> = {};
  await setRestAlertsEnabled(false, storageWith(values));
  await markRestAlertsPromptSeen(storageWith(values));
  expect(values).toEqual({
    'settings.rest-alerts': 'off',
    'settings.rest-alerts-prompt-seen': 'yes',
  });
  const failing: DeviceSettingStorage = {
    get: async () => null,
    set: async () => {
      throw new Error('locked');
    },
  };
  await setRestAlertsEnabled(true, failing);
  expect(getRestAlertsPreference().enabled).toBe(true);
});
