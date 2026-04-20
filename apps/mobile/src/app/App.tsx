import { View } from 'react-native';

import { ProfileScreen } from '../features/profile/profile-screen';
import { AppProviders } from './providers';

export function App() {
  return (
    <AppProviders>
      <View style={{ flex: 1 }}>
        <ProfileScreen />
      </View>
    </AppProviders>
  );
}

export default App;
