import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { restAlerts } from './rest-alerts.native';
import { setRestAlertsEnabled } from './rest-alerts-preference';
import type { DeviceSettingStorage } from '../settings/device-setting-storage';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => 'rest-notification'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  PermissionStatus: { DENIED: 'denied', GRANTED: 'granted' },
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: 'success' },
}));

const denied = {
  granted: false,
  canAskAgain: false,
  expires: 'never' as const,
  status: Notifications.PermissionStatus.DENIED,
};
const granted = { ...denied, granted: true, status: Notifications.PermissionStatus.GRANTED };

const memory: DeviceSettingStorage = { get: async () => null, set: async () => undefined };
const askable = { ...denied, canAskAgain: true };

beforeEach(async () => {
  jest.clearAllMocks();
  await setRestAlertsEnabled(true, memory);
});

it('schedules for the original deadline after permission has been granted', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(granted);
  const endsAt = Date.now() + 180_000;
  await expect(restAlerts.schedule(endsAt)).resolves.toBe('rest-notification');
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      trigger: { type: 'date', date: new Date(endsAt), channelId: 'workout-rest' },
    })
  );
});

it('never opens the system permission dialog while a set is being logged', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(askable);
  await expect(restAlerts.schedule(Date.now() + 90_000)).resolves.toBeNull();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});

it('schedules nothing after the lifter turned rest alerts off', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(granted);
  await setRestAlertsEnabled(false, memory);
  await expect(restAlerts.schedule(Date.now() + 90_000)).resolves.toBeNull();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('does not repeatedly prompt after permission denial', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(denied);
  await expect(restAlerts.schedule(Date.now() + 90_000)).resolves.toBeNull();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('does not schedule an already expired rest after a slow permission dialog', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(granted);
  await expect(restAlerts.schedule(Date.now() - 1)).resolves.toBeNull();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('uses the native completion haptic', async () => {
  await restAlerts.complete();
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
});
