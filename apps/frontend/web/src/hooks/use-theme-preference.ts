import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  THEME_CHANGE_EVENT,
  type ThemeId,
  bootstrapTheme,
  getThemePreference,
  setThemePreference,
} from '@/lib/theme-preference';

function subscribe(onStoreChange: () => void): () => void {
  document.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    document.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    window.removeEventListener('storage', onStoreChange);
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
 * Live theme preference. Subscribes to in-tab theme-change events and the
 * cross-tab `storage` event so multiple surfaces stay in sync.
 */
export function useThemePreference(): ThemePreference {
  // Ensure the document root is painted on first client mount (boot script
  // usually already did this; this is a safety net for tests / late hydration).
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    if (!booted) {
      bootstrapTheme();
      setBooted(true);
    }
  }, [booted]);

  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: ThemeId): void => {
    setThemePreference(next);
  }, []);

  return { theme, setTheme };
}
