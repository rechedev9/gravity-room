import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { RestTimerBanner } from '../../../shell/rest-timer-provider';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../../../shell/design';

export default function TabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => (
        <View>
          <RestTimerBanner />
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.header,
          borderTopColor: colors.rule,
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11 },
        tabBarItemStyle: { minHeight: 48, paddingVertical: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.workout'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons accessible={false} name="barbell-outline" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: t('nav.open_workout'),
        }}
      />
      <Tabs.Screen
        name="mesos"
        options={{
          title: t('nav.mesos'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons accessible={false} name="calendar-outline" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: t('nav.open_mesos'),
        }}
      />
      <Tabs.Screen
        name="templates"
        options={{
          title: t('nav.templates'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons accessible={false} name="layers-outline" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: t('nav.open_templates'),
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: t('nav.exercises'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons accessible={false} name="body-outline" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: t('nav.open_exercises'),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('nav.more'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons accessible={false} name="ellipsis-horizontal" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: t('nav.open_more'),
        }}
      />
    </Tabs>
  );
}
