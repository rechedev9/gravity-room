/**
 * Theme preference — three selectable skins sharing the same semantic token surface.
 * Gold (forged-iron) is the product default; classic light/dark keep the same
 * warm-gold accent voice on light paper / neutral charcoal surfaces.
 */

export const THEME_IDS = ['gold', 'classic-light', 'classic-dark'] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const THEME_STORAGE_KEY = 'gravity-room:theme-preference';

/** Custom event name dispatched on document when the theme changes. */
export const THEME_CHANGE_EVENT = 'gravity-room:theme-change';

export const DEFAULT_THEME: ThemeId = 'gold';

/** Theme-color meta values that match each skin's accent for mobile chrome. */
export const THEME_COLOR_META: Record<ThemeId, string> = {
  gold: '#c8a84e',
  // Deep gold for contrast on light paper (matches --color-accent on classic-light).
  'classic-light': '#9a6b14',
  'classic-dark': '#c8a84e',
};

let bootstrapped = false;
let crossTabInstalled = false;
let onStorage: ((event: StorageEvent) => void) | null = null;

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
 * Cross-tab sync: when another document changes THEME_STORAGE_KEY, re-paint
 * this document (storage alone never updates CSS vars).
 */
export function installCrossTabThemeSync(): void {
  if (crossTabInstalled || typeof window === 'undefined') return;
  crossTabInstalled = true;
  onStorage = (event: StorageEvent): void => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    applyThemeToDocument(getThemePreference());
  };
  window.addEventListener('storage', onStorage);
}

/**
 * Read storage and paint the root. Idempotent: skips re-apply when the root
 * already matches storage (boot script already painted). Always installs
 * cross-tab sync.
 */
export function bootstrapTheme(): ThemeId {
  installCrossTabThemeSync();
  const theme = getThemePreference();
  const alreadyPainted = document.documentElement.getAttribute('data-theme') === theme;
  if (!alreadyPainted || !bootstrapped) {
    if (!alreadyPainted) {
      applyThemeToDocument(theme);
    }
    bootstrapped = true;
  }
  return theme;
}

/**
 * Persist + apply + notify. Returns the theme that was set.
 */
export function setThemePreference(theme: ThemeId): ThemeId {
  saveThemePreference(theme);
  applyThemeToDocument(theme);
  bootstrapped = true;
  installCrossTabThemeSync();
  return theme;
}

/** Test-only: reset module install flags between cases. */
export function __resetThemePreferenceForTests(): void {
  bootstrapped = false;
  crossTabInstalled = false;
  if (onStorage && typeof window !== 'undefined') {
    window.removeEventListener('storage', onStorage);
  }
  onStorage = null;
}
