import { type PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './auth-provider';
import { FontProvider } from './font-provider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <FontProvider>
        <AuthProvider>{children}</AuthProvider>
      </FontProvider>
    </SafeAreaProvider>
  );
}
