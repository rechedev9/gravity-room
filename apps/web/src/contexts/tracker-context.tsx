import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface TrackerState {
  readonly instanceId: string | undefined;
  readonly programId: string | undefined;
}

interface TrackerContextValue extends TrackerState {
  readonly setTracker: (programId: string, instanceId?: string) => void;
  readonly clearTracker: () => void;
}

const TrackerContext = createContext<TrackerContextValue | null>(null);

export function TrackerProvider({ children }: { readonly children: ReactNode }): React.ReactNode {
  const [state, setState] = useState<TrackerState>({
    instanceId: undefined,
    programId: undefined,
  });

  const setTracker = useCallback((programId: string, instanceId?: string): void => {
    setState({ programId, instanceId });
  }, []);

  const clearTracker = useCallback((): void => {
    setState({ programId: undefined, instanceId: undefined });
  }, []);

  return (
    <TrackerContext.Provider value={{ ...state, setTracker, clearTracker }}>
      {children}
    </TrackerContext.Provider>
  );
}

export function useTracker(): TrackerContextValue {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTracker must be used within TrackerProvider');
  return ctx;
}
