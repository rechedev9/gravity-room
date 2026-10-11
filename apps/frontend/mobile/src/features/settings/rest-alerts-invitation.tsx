import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { type } from '../../shell/design';
import { colors } from '@gzclp/design-tokens';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { useRestAlerts } from './use-rest-alerts';

/** An inline, dismissible invitation. It never overlays the sets and never blocks logging. */
export function RestAlertsInvitation() {
  const { t } = useTranslation();
  const alerts = useRestAlerts();
  if (!alerts.showInvitation) return null;
  return (
    <Card>
      <View style={styles.head}>
        <Ionicons accessible={false} name="notifications-outline" size={22} color={colors.accent} />
        <Text accessibilityRole="header" style={styles.title}>
          {t('rest_prompt.title')}
        </Text>
      </View>
      <Text style={styles.body}>{t('rest_prompt.body')}</Text>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            variant="primary"
            onPress={() => {
              void alerts.dismissInvitation();
              void alerts.turnOn();
            }}
          >
            {t('rest_prompt.enable')}
          </Button>
        </View>
        <View style={styles.action}>
          <Button
            onPress={() => {
              void alerts.dismissInvitation();
            }}
          >
            {t('rest_prompt.later')}
          </Button>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { ...type.title, fontSize: 17, flex: 1 },
  body: { ...type.body, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  action: { flex: 1 },
});
