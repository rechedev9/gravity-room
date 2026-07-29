import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  THEME_CHANGE_EVENT,
  type ThemeId,
  bootstrapTheme,
  getThemePreference,
  setThemePreference,
} from '@/lib/theme-preference';

function subscribe(onStoreChange: () => void): () => void {
  // Cross-tab storage is handled in installCrossTabThemeSync → applyThemeToDocument
  // → THEME_CHANGE_EVENT, so one event channel is enough for React re-renders.
  document.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  return () => {
    document.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot(): ThemeId {
  return getThemePreference();
}

function getServerSnapshot(): ThemeId {
  return 'gold';
}

export interface ThemePreference {
  readonly theme: ThemeId;
  readonly setTheme: (theme: ThemeId) => void;
}

/**
 * Live theme preference. Subscribes to theme-change events (including those
 * fired after a cross-tab storage apply). Bootstrap is a module-level once
 * (main.tsx + boot script); this effect is only a safety net for tests.
 */
export function useThemePreference(): ThemePreference {
  useEffect(() => {
    bootstrapTheme();
  }, []);

  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: ThemeId): void => {
    setThemePreference(next);
  }, []);

  return { theme, setTheme };
}
