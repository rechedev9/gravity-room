import { Stack } from 'expo-router';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import '../lib/i18n';
import { useAuth } from './auth-provider';
import { colors } from './design';
import { AppProviders } from './providers';

function Navigation() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        statusBarStyle: 'light',
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Protected guard={user !== null}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={user === null}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export function App() {
  return (
    <AppProviders>
      <StatusBar barStyle="light-content" />
      <Navigation />
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
});
