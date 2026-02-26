import { useState, useEffect } from 'react';

type ViewMode = 'card' | 'table';

const STORAGE_KEY = 'tracker-view';
const MOBILE_QUERY = '(max-width: 768px)';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent): void => {
      setMatches(e.matches);
    };
    mql.addEventListener('change', handler);
    return (): void => {
      mql.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}

interface UseViewModeReturn {
  /** Current effective view mode (resolved from preference or responsive default) */
  readonly viewMode: ViewMode;
  /** User's explicit preference, or null if using responsive default */
  readonly preference: ViewMode | null;
  /** Set an explicit preference (persisted to localStorage), or null to clear */
  readonly setPreference: (mode: ViewMode | null) => void;
  /** Toggle between card and table (sets explicit preference) */
  readonly toggle: () => void;
}

function isValidViewMode(value: string | null): value is ViewMode {
  return value === 'card' || value === 'table';
}

export function useViewMode(): UseViewModeReturn {
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const [preference, setPreferenceState] = useState<ViewMode | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isValidViewMode(stored)) return stored;
    return null;
  });

  const viewMode: ViewMode = preference ?? (isMobile ? 'card' : 'table');

  const setPreference = (mode: ViewMode | null): void => {
    setPreferenceState(mode);
    if (mode === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  };

  const toggle = (): void => {
    const next: ViewMode = viewMode === 'card' ? 'table' : 'card';
    setPreference(next);
  };

  return { viewMode, preference, setPreference, toggle };
}
