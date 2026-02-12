'use client';

import { useState, useCallback } from 'react';
import { loadInstanceMap, loadDataCompat } from '@/lib/storage-v2';
import { Dashboard } from './dashboard';
import { GZCLPApp } from './gzclp-app';
import type { ProgramInstanceMap } from '@/types/program';

type View = 'dashboard' | 'tracker';

interface ShellState {
  readonly view: View;
  readonly instanceMap: ProgramInstanceMap | null;
}

function readInitialState(): ShellState {
  if (typeof window === 'undefined') {
    return { view: 'dashboard', instanceMap: null };
  }

  let map = loadInstanceMap();

  // If no new-format data, try legacy migration
  if (!map) {
    loadDataCompat(); // triggers migration as side effect
    map = loadInstanceMap(); // re-read after migration
  }

  const hasActive = !!(map?.activeProgramId && map.instances[map.activeProgramId]);
  return { view: hasActive ? 'tracker' : 'dashboard', instanceMap: map };
}

export function AppShell(): React.ReactNode {
  const [state, setState] = useState<ShellState>(readInitialState);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- programId will route to different trackers in the future
  const handleSelectProgram = useCallback((programId: string): void => {
    // For now, only GZCLP is supported — GZCLPApp + useProgram handle setup.
    setState((prev) => ({ ...prev, view: 'tracker' }));
  }, []);

  const handleContinueProgram = useCallback((): void => {
    setState((prev) => ({ ...prev, view: 'tracker' }));
  }, []);

  const handleBackToDashboard = useCallback((): void => {
    // Re-read storage for fresh progress data
    const map = loadInstanceMap();
    setState({ view: 'dashboard', instanceMap: map });
  }, []);

  if (state.view === 'dashboard') {
    return (
      <Dashboard
        instanceMap={state.instanceMap}
        onSelectProgram={handleSelectProgram}
        onContinueProgram={handleContinueProgram}
      />
    );
  }

  return <GZCLPApp onBackToDashboard={handleBackToDashboard} />;
}
