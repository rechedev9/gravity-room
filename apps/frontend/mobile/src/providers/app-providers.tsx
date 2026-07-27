import { type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './auth-provider';
import { AppErrorBoundary } from './app-error-boundary';
import { DatabaseBootstrapGate } from './database-bootstrap-gate';

const queryClient = new QueryClient();

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AppErrorBoundary>
          <DatabaseBootstrapGate>
            <AuthProvider>{children}</AuthProvider>
          </DatabaseBootstrapGate>
        </AppErrorBoundary>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
