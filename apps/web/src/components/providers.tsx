import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ErrorBoundary } from './error-boundary';

function RootErrorFallback(): React.ReactNode {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)] p-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-[var(--text-main)] mb-3">Something went wrong</h1>
        <p className="text-[var(--text-muted)] mb-6">
          An unexpected error occurred. Reloading the page should fix it.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-[var(--fill-progress)] text-white font-bold cursor-pointer"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function Providers({ children }: { readonly children: React.ReactNode }): React.ReactNode {
  const [queryClient] = useState(makeQueryClient);

  return (
    <ErrorBoundary fallback={<RootErrorFallback />}>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  );
}
