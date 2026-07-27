import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { writeLastPrimaryTab } from '../../../navigation/navigation-storage';
import { colors } from '../../../ui/tokens';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      initialRouteName="programs"
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.canvas },
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          minHeight: 64,
          borderTopColor: colors.borderSubtle,
          backgroundColor: colors.canvas,
        },
        tabBarItemStyle: { minHeight: 44 },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="programs"
        listeners={{
          tabPress: () => {
            void writeLastPrimaryTab('programs').catch(() => undefined);
          },
        }}
        options={{
          title: t('nav.programs'),
          tabBarAccessibilityLabel: t('nav.open_programs'),
        }}
      />
      <Tabs.Screen
        name="tracker"
        listeners={{
          tabPress: () => {
            void writeLastPrimaryTab('tracker').catch(() => undefined);
          },
        }}
        options={{
          title: t('nav.tracker'),
          tabBarAccessibilityLabel: t('nav.open_tracker'),
        }}
      />
      <Tabs.Screen
        name="profile"
        listeners={{
          tabPress: () => {
            void writeLastPrimaryTab('profile').catch(() => undefined);
          },
        }}
        options={{
          title: t('nav.profile'),
          tabBarAccessibilityLabel: t('nav.open_profile'),
        }}
      />
    </Tabs>
  );
}
