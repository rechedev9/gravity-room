import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '../../shell/auth-provider';
import { RestTimerProvider } from '../../shell/rest-timer-provider';
import { ProgramQueryProvider } from '../../shell/program-query-provider';
import { colors } from '../../shell/design';

export default function AuthenticatedLayout() {
  const { user } = useAuth();
  return (
    <ProgramQueryProvider key={user?.id}>
      <RestTimerProvider>
        <View style={{ flex: 1, backgroundColor: colors.canvas }}>
          <Stack
            screenOptions={{
              headerShown: false,
              statusBarStyle: 'light',
              contentStyle: { backgroundColor: colors.canvas },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="workout/[id]" />
          </Stack>
        </View>
      </RestTimerProvider>
    </ProgramQueryProvider>
  );
}
