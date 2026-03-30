import { useState, useEffect } from 'react';
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
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>(() => getViewPreference());

  useEffect(() => {
    if (firstPendingIdx >= 0) setSelectedDayIndex(firstPendingIdx);
  }, [config]);

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
