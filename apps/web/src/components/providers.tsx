import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ErrorBoundary } from './error-boundary';

function RootErrorFallback(): React.ReactNode {
  return (
    <div className="min-h-screen flex items-center justify-center bg-body p-6">
      <div className="text-center max-w-md">
        <img
          src="/error-state.webp"
          alt="Error state — damaged gravity chamber"
          width={512}
          height={279}
          className="w-full max-w-sm mx-auto mb-8 rounded-sm opacity-80"
        />
        <h1 className="text-2xl font-bold text-main mb-3">Algo ha salido mal</h1>
        <p className="text-muted mb-6">
          Ha ocurrido un error inesperado. Recargar la página debería solucionarlo.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-accent text-white font-bold cursor-pointer"
        >
          Recargar
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
