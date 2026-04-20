import { View } from 'react-native';

import { LoginScreen } from '../features/auth/login-screen';
import { AppProviders } from './providers';

export function App() {
  return (
    <AppProviders>
      <View style={{ flex: 1 }}>
        <LoginScreen />
      </View>
    </AppProviders>
  );
}

export default App;
