import { type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './auth-provider';
import { FontProvider } from './font-provider';

const queryClient = new QueryClient();

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <FontProvider>
          <AuthProvider>{children}</AuthProvider>
        </FontProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
