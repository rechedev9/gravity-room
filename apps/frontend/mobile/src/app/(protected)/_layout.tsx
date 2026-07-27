import { Stack } from 'expo-router';

import {
  PROTECTED_SECONDARY_ROUTE_FILE_IDS,
  toProtectedStackScreenName,
} from '../../navigation/routes';
import { useAuth } from '../../providers/auth-provider';
import { useDatabaseBootstrapState } from '../../providers/database-bootstrap-gate';

export default function ProtectedLayout() {
  const { loading, user } = useAuth();
  const databaseState = useDatabaseBootstrapState();

  if (loading || user === null || databaseState.status !== 'ready') {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      {PROTECTED_SECONDARY_ROUTE_FILE_IDS.map((routeFileId) => (
        <Stack.Screen key={routeFileId} name={toProtectedStackScreenName(routeFileId)} />
      ))}
    </Stack>
  );
}
