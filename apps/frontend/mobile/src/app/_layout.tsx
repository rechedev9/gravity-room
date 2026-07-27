import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';

import '../lib/i18n';
import { AppProviders } from '../providers/app-providers';
import { useAuth } from '../providers/auth-provider';
import { Screen } from '../ui/screen';
import { colors } from '../ui/tokens';

function RootNavigator() {
  const { t } = useTranslation();
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <Screen centered testID="auth-restore-loading">
        <ActivityIndicator
          accessibilityLabel={t('startup.session_loading')}
          color={colors.textPrimary}
        />
      </Screen>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={user === null}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={user !== null}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="program" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="light" />
      <RootNavigator />
    </AppProviders>
  );
}
