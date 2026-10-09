import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import i18n from '../i18n';
import { REST_ALERT_CHANNEL_ID } from './rest-alert-channel';
import { ensureRestAlertChannel } from './rest-alerts-access';
import { getRestAlertsPreference } from './rest-alerts-preference';
import type { RestTimerEffects } from './rest-timer';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const restAlerts: RestTimerEffects = {
  async schedule(endsAt) {
    // Never asks for permission: the invitation lives in the workout header and in More.
    if (!getRestAlertsPreference().enabled) return null;
    await ensureRestAlertChannel();
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted || endsAt <= Date.now()) return null;
    return Notifications.scheduleNotificationAsync({
      content: { title: i18n.t('rest.complete'), body: i18n.t('rest.next_set'), sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(endsAt),
        channelId: REST_ALERT_CHANNEL_ID,
      },
    });
  },
  cancel: Notifications.cancelScheduledNotificationAsync,
  complete: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
};
