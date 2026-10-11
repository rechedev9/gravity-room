import { useSyncExternalStore } from 'react';
import {
  deviceSettingStorage,
  type DeviceSettingStorage,
} from '../settings/device-setting-storage';
import { readRestAlertsAccess, type RestAlertsAccess } from './rest-alerts-access';

const ENABLED_KEY = 'settings.rest-alerts';
const PROMPT_SEEN_KEY = 'settings.rest-alerts-prompt-seen';

export interface RestAlertsPreference {
  /** The lifter wants alerts. Off until they accept the invitation or turn the switch on. */
  readonly enabled: boolean;
  /** The lifter answered with the switch or the invitation, so the choice is stored. */
  readonly chosen: boolean;
  /** The inline invitation was answered or dismissed once and stays away. */
  readonly promptSeen: boolean;
  readonly loaded: boolean;
}

let state: RestAlertsPreference = {
  enabled: false,
  chosen: false,
  promptSeen: false,
  loaded: false,
};
const listeners = new Set<() => void>();

function publish(next: RestAlertsPreference): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getRestAlertsPreference(): RestAlertsPreference {
  return state;
}

async function readAccessSafely(
  readAccess: () => Promise<RestAlertsAccess>
): Promise<RestAlertsAccess> {
  try {
    return await readAccess();
  } catch {
    return 'unsupported';
  }
}

/** A missing choice means alerts are off, except for a lifter who already granted the system
 * permission under the old default: their alerts work today, so the choice becomes explicit. */
export async function restoreRestAlertsPreference(
  storage: DeviceSettingStorage = deviceSettingStorage,
  readAccess: () => Promise<RestAlertsAccess> = readRestAlertsAccess
): Promise<void> {
  const [stored, promptSeen] = await Promise.all([
    storage.get(ENABLED_KEY),
    storage.get(PROMPT_SEEN_KEY),
  ]);
  const seen = promptSeen === 'yes';
  if (stored === 'on' || stored === 'off') {
    publish({ enabled: stored === 'on', chosen: true, promptSeen: seen, loaded: true });
    return;
  }
  if ((await readAccessSafely(readAccess)) === 'granted') {
    publish({ enabled: true, chosen: true, promptSeen: seen, loaded: true });
    await persist(storage, ENABLED_KEY, 'on');
    return;
  }
  publish({ enabled: false, chosen: false, promptSeen: seen, loaded: true });
}

async function persist(storage: DeviceSettingStorage, key: string, value: string): Promise<void> {
  try {
    await storage.set(key, value);
  } catch {
    // The choice holds for this session; a failed write only loses persistence.
  }
}

export async function setRestAlertsEnabled(
  enabled: boolean,
  storage: DeviceSettingStorage = deviceSettingStorage
): Promise<void> {
  publish({ ...state, enabled, chosen: true });
  await persist(storage, ENABLED_KEY, enabled ? 'on' : 'off');
}

export async function markRestAlertsPromptSeen(
  storage: DeviceSettingStorage = deviceSettingStorage
): Promise<void> {
  publish({ ...state, promptSeen: true });
  await persist(storage, PROMPT_SEEN_KEY, 'yes');
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRestAlertsPreference(): RestAlertsPreference {
  return useSyncExternalStore(subscribe, getRestAlertsPreference, getRestAlertsPreference);
}
