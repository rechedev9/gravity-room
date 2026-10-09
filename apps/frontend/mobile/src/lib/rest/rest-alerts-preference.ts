import { useSyncExternalStore } from 'react';
import {
  deviceSettingStorage,
  type DeviceSettingStorage,
} from '../settings/device-setting-storage';

const ENABLED_KEY = 'settings.rest-alerts';
const PROMPT_SEEN_KEY = 'settings.rest-alerts-prompt-seen';

export interface RestAlertsPreference {
  /** Alerts are on unless the lifter turned them off; the OS permission is separate. */
  readonly enabled: boolean;
  /** The inline invitation was answered or dismissed once and stays away. */
  readonly promptSeen: boolean;
  readonly loaded: boolean;
}

let state: RestAlertsPreference = { enabled: true, promptSeen: false, loaded: false };
const listeners = new Set<() => void>();

function publish(next: RestAlertsPreference): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getRestAlertsPreference(): RestAlertsPreference {
  return state;
}

export async function restoreRestAlertsPreference(
  storage: DeviceSettingStorage = deviceSettingStorage
): Promise<void> {
  const [enabled, promptSeen] = await Promise.all([
    storage.get(ENABLED_KEY),
    storage.get(PROMPT_SEEN_KEY),
  ]);
  publish({ enabled: enabled !== 'off', promptSeen: promptSeen === 'yes', loaded: true });
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
  publish({ ...state, enabled });
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
