import { ActivityIndicator, View } from 'react-native';

import { LoginScreen } from '../features/auth/login-screen';
import { ProfileScreen } from '../features/profile/profile-screen';
import { useAuth } from './auth-provider';
import { AppProviders } from './providers';

function AppShell() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#050816',
        }}
      >
        <ActivityIndicator color="#F8FAFC" />
      </View>
    );
  }

  if (user) return <ProfileScreen user={user} />;

  return <LoginScreen />;
}

export function App() {
  return (
    <AppProviders>
      <View style={{ flex: 1 }}>
        <AppShell />
      </View>
    </AppProviders>
  );
}

export default App;
