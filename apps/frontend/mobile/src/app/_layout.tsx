import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import '../lib/i18n';
import { AppProviders } from '../providers/app-providers';
import { useAuth } from '../providers/auth-provider';
import { PROTECTED_SECONDARY_ROUTE_FILE_IDS } from '../navigation/routes';
import { Screen } from '../ui/screen';
import { colors } from '../ui/tokens';

export function RootNavigator() {
  const { t } = useTranslation();
  const { loading, user } = useAuth();

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!loading && user === null}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={loading || user !== null}>
          <Stack.Screen name="(tabs)" />
          {PROTECTED_SECONDARY_ROUTE_FILE_IDS.map((route) => (
            <Stack.Screen key={route} name={route} />
          ))}
        </Stack.Protected>
      </Stack>
      {loading ? (
        <View style={styles.overlay} testID="auth-restore-loading">
          <Screen centered>
            <ActivityIndicator
              accessibilityLabel={t('startup.session_loading')}
              color={colors.textPrimary}
            />
          </Screen>
        </View>
      ) : null}
    </View>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.canvas,
  },
});
