import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react';

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

  // Spreading state in JSX hides the identity from React Compiler, so
  // memoise the value explicitly. setTracker/clearTracker are already stable.
  const value = useMemo<TrackerContextValue>(
    () => ({ ...state, setTracker, clearTracker }),
    [state, setTracker, clearTracker]
  );

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}

export function useTracker(): TrackerContextValue {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTracker must be used within TrackerProvider');
  return ctx;
}
