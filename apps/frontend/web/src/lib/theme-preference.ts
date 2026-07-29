/**
 * Theme preference — three selectable skins sharing the same semantic token surface.
 * Gold (forged-iron) is the product default; classic light/dark are quiet neutrals.
 */

export const THEME_IDS = ['gold', 'classic-light', 'classic-dark'] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const THEME_STORAGE_KEY = 'gravity-room:theme-preference';

/** Custom event name dispatched on document when the theme changes. */
export const THEME_CHANGE_EVENT = 'gravity-room:theme-change';

export const DEFAULT_THEME: ThemeId = 'gold';

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value === 'gold' || value === 'classic-light' || value === 'classic-dark';
}

export function getThemePreference(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveThemePreference(theme: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore quota / private mode
  }
}

/** Theme-color meta values that match each skin's accent for mobile chrome. */
const THEME_COLOR_META: Record<ThemeId, string> = {
  gold: '#c8a84e',
  'classic-light': '#3b5bdb',
  'classic-dark': '#748ffc',
};

/**
 * Apply theme to the document root. Safe to call before React mounts
 * (boot script) and from the React provider on user change.
 */
export function applyThemeToDocument(theme: ThemeId): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme === 'classic-light' ? 'light' : 'dark';

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', THEME_COLOR_META[theme]);
  }

  document.dispatchEvent(
    new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } satisfies { theme: ThemeId } })
  );
}

/**
 * Read storage and paint the root in one shot — used by the boot script
 * and as a no-flash entry for the provider.
 */
export function bootstrapTheme(): ThemeId {
  const theme = getThemePreference();
  applyThemeToDocument(theme);
  return theme;
}

/**
 * Persist + apply + notify. Returns the theme that was set.
 */
export function setThemePreference(theme: ThemeId): ThemeId {
  saveThemePreference(theme);
  applyThemeToDocument(theme);
  return theme;
}
