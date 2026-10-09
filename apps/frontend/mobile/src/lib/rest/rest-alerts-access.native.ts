import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import i18n from '../i18n';
import { REST_ALERT_CHANNEL_ID } from './rest-alert-channel';

/** `askable` means the system dialog can still be shown; `blocked` needs system settings. */
export type RestAlertsAccess = 'granted' | 'askable' | 'blocked' | 'unsupported';

function toAccess(permission: Notifications.NotificationPermissionsStatus): RestAlertsAccess {
  if (permission.granted) return 'granted';
  return permission.canAskAgain ? 'askable' : 'blocked';
}

/** Android 13 only shows the permission dialog once the channel exists. */
export async function ensureRestAlertChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REST_ALERT_CHANNEL_ID, {
    name: i18n.t('rest.title'),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 100, 200],
    sound: 'default',
  });
}

export async function readRestAlertsAccess(): Promise<RestAlertsAccess> {
  return toAccess(await Notifications.getPermissionsAsync());
}

/** Only called from an explicit user action, after the in-app rationale. */
export async function requestRestAlertsAccess(): Promise<RestAlertsAccess> {
  await ensureRestAlertChannel();
  return toAccess(await Notifications.requestPermissionsAsync());
}

export async function openRestAlertsSettings(): Promise<void> {
  await Linking.openSettings();
}
