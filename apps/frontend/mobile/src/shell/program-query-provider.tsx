import { useEffect, useState, type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getActiveLocalDataOwner } from '../lib/db/client';
import { subscribeSyncAttempts, syncRequests } from '../lib/sync/sync-events';

/** Remounted by account id; no query cache survives an authenticated owner. */
export function ProgramQueryProvider({ children }: PropsWithChildren) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 30_000 } },
      })
  );
  useEffect(() => {
    let requestedOwner: string | null = null;
    const unsubscribeRequests = syncRequests.subscribe((ownerId) => {
      if (ownerId === getActiveLocalDataOwner()) requestedOwner = ownerId;
    });
    const unsubscribeAttempts = subscribeSyncAttempts((attempt) => {
      if (attempt.ownerId !== requestedOwner) return;
      // Refresh after session recovery and delivery, including retained failures.
      // Consume first: a query may itself flush the queue and emit another attempt.
      requestedOwner = null;
      if (attempt.ownerId === getActiveLocalDataOwner()) {
        void client.invalidateQueries();
      }
    });
    return () => {
      requestedOwner = null;
      unsubscribeRequests();
      unsubscribeAttempts();
      client.clear();
    };
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
