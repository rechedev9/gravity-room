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

it('defaults to off with the invitation not yet seen when nothing was granted', async () => {
  const values: Record<string, string> = {};
  await restoreRestAlertsPreference(storageWith(values), async () => 'askable');
  expect(getRestAlertsPreference()).toEqual({
    enabled: false,
    chosen: false,
    promptSeen: false,
    loaded: true,
  });
  expect(values).toEqual({});
});

it('keeps alerts on, and stores that choice, for a lifter who already granted the permission', async () => {
  const values: Record<string, string> = {};
  await restoreRestAlertsPreference(storageWith(values), async () => 'granted');
  expect(getRestAlertsPreference()).toEqual({
    enabled: true,
    chosen: true,
    promptSeen: false,
    loaded: true,
  });
  expect(values).toEqual({ 'settings.rest-alerts': 'on' });
});

it('treats an unreadable permission as nothing granted', async () => {
  await restoreRestAlertsPreference(storageWith({}), async () => {
    throw new Error('no module');
  });
  expect(getRestAlertsPreference().enabled).toBe(false);
});

it('restores an explicit off choice and a dismissed invitation without reading the permission', async () => {
  const readAccess = jest.fn(async () => 'granted' as const);
  await restoreRestAlertsPreference(
    storageWith({ 'settings.rest-alerts': 'off', 'settings.rest-alerts-prompt-seen': 'yes' }),
    readAccess
  );
  expect(getRestAlertsPreference()).toEqual({
    enabled: false,
    chosen: true,
    promptSeen: true,
    loaded: true,
  });
  expect(readAccess).not.toHaveBeenCalled();
});

it('restores an explicit on choice', async () => {
  await restoreRestAlertsPreference(
    storageWith({ 'settings.rest-alerts': 'on' }),
    async () => 'askable'
  );
  expect(getRestAlertsPreference().enabled).toBe(true);
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
