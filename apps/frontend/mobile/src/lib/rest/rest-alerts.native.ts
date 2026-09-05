import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import i18n from '../i18n';
import type { RestTimerEffects } from './rest-timer';

const CHANNEL_ID = 'workout-rest';

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
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: i18n.t('rest.title'),
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 100, 200],
        sound: 'default',
      });
    }
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (!permission.granted || endsAt <= Date.now()) return null;
    return Notifications.scheduleNotificationAsync({
      content: { title: i18n.t('rest.complete'), body: i18n.t('rest.next_set'), sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(endsAt),
        channelId: CHANNEL_ID,
      },
    });
  },
  cancel: Notifications.cancelScheduledNotificationAsync,
  complete: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
};
