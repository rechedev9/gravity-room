import { useState, useRef } from 'react';
import { getViewPreference, saveViewPreference, type ViewMode } from '@/lib/view-preference';

interface UseDayNavigationOptions {
  readonly totalWorkouts: number;
  readonly firstPendingIdx: number;
  readonly config: Record<string, number | string> | null;
}

interface UseDayNavigationReturn {
  readonly selectedDayIndex: number;
  readonly viewMode: ViewMode;
  readonly handlePrevDay: () => void;
  readonly handleNextDay: () => void;
  readonly handleGoToCurrent: () => void;
  readonly handleToggleView: () => void;
}

export function useDayNavigation({
  totalWorkouts,
  firstPendingIdx,
  config,
}: UseDayNavigationOptions): UseDayNavigationReturn {
  // prevConfigRef tracks the previous config reference so we can detect identity changes.
  // Using undefined as sentinel means "not yet seen any config value".
  const prevConfigRef = useRef<Record<string, number | string> | null | undefined>(undefined);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>(() => getViewPreference());

  // Render-phase state update (React's getDerivedStateFromProps equivalent):
  // When config identity changes, synchronously reset selectedDayIndex to the first pending
  // workout rather than waiting for a post-paint effect. Eliminates the useEffect-driven
  // "sync state after render" anti-pattern while preserving identical semantics.
  if (prevConfigRef.current !== config) {
    prevConfigRef.current = config;
    const newIdx = firstPendingIdx >= 0 ? firstPendingIdx : 0;
    if (selectedDayIndex !== newIdx) {
      setSelectedDayIndex(newIdx);
    }
  }

  const handlePrevDay = (): void => setSelectedDayIndex((i) => Math.max(0, i - 1));
  const handleNextDay = (): void => setSelectedDayIndex((i) => Math.min(totalWorkouts - 1, i + 1));
  const handleGoToCurrent = (): void => {
    if (firstPendingIdx >= 0) setSelectedDayIndex(firstPendingIdx);
  };
  const handleToggleView = (): void => {
    const next: ViewMode = viewMode === 'detailed' ? 'compact' : 'detailed';
    setViewMode(next);
    saveViewPreference(next);
  };

  return {
    selectedDayIndex,
    viewMode,
    handlePrevDay,
    handleNextDay,
    handleGoToCurrent,
    handleToggleView,
  };
}
