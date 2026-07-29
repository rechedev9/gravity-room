import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_THEME,
  THEME_CHANGE_EVENT,
  THEME_IDS,
  THEME_STORAGE_KEY,
  applyThemeToDocument,
  bootstrapTheme,
  getThemePreference,
  isThemeId,
  saveThemePreference,
  setThemePreference,
  type ThemeId,
} from './theme-preference';

describe('theme-preference', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    // Ensure a theme-color meta exists for apply assertions
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', '#c8a84e');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  describe('isThemeId', () => {
    it('accepts the three shipped theme ids', () => {
      for (const id of THEME_IDS) {
        expect(isThemeId(id)).toBe(true);
      }
    });

    it('rejects unknown values', () => {
      expect(isThemeId('system')).toBe(false);
      expect(isThemeId('')).toBe(false);
      expect(isThemeId(null)).toBe(false);
      expect(isThemeId(undefined)).toBe(false);
    });
  });

  describe('getThemePreference / saveThemePreference', () => {
    it('defaults to gold when nothing is stored', () => {
      expect(getThemePreference()).toBe(DEFAULT_THEME);
      expect(getThemePreference()).toBe('gold');
    });

    it('round-trips every theme id through localStorage', () => {
      for (const id of THEME_IDS) {
        saveThemePreference(id);
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(id);
        expect(getThemePreference()).toBe(id);
      }
    });

    it('falls back to gold for corrupted storage', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'neon-cyber');
      expect(getThemePreference()).toBe('gold');
    });
  });

  describe('applyThemeToDocument', () => {
    it('marks the document root with data-theme for every theme', () => {
      for (const id of THEME_IDS) {
        applyThemeToDocument(id);
        expect(document.documentElement.getAttribute('data-theme')).toBe(id);
      }
    });

    it('sets color-scheme light only for classic-light', () => {
      applyThemeToDocument('classic-light');
      expect(document.documentElement.style.colorScheme).toBe('light');

      applyThemeToDocument('classic-dark');
      expect(document.documentElement.style.colorScheme).toBe('dark');

      applyThemeToDocument('gold');
      expect(document.documentElement.style.colorScheme).toBe('dark');
    });

    it('updates the theme-color meta to a theme-specific accent', () => {
      applyThemeToDocument('classic-light');
      const meta = document.querySelector('meta[name="theme-color"]');
      expect(meta?.getAttribute('content')).not.toBe('#c8a84e');

      applyThemeToDocument('gold');
      expect(meta?.getAttribute('content')).toBe('#c8a84e');
    });

    it('dispatches THEME_CHANGE_EVENT with the active theme', () => {
      const handler = vi.fn();
      document.addEventListener(THEME_CHANGE_EVENT, handler);
      applyThemeToDocument('classic-dark');
      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0]?.[0] as CustomEvent<{ theme: ThemeId }>;
      expect(event.detail.theme).toBe('classic-dark');
      document.removeEventListener(THEME_CHANGE_EVENT, handler);
    });
  });

  describe('setThemePreference', () => {
    it('persists and applies in one call for all three themes', () => {
      for (const id of THEME_IDS) {
        const result = setThemePreference(id);
        expect(result).toBe(id);
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(id);
        expect(document.documentElement.getAttribute('data-theme')).toBe(id);
      }
    });
  });

  describe('bootstrapTheme', () => {
    it('reads storage and paints the root before React mounts', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'classic-light');
      const theme = bootstrapTheme();
      expect(theme).toBe('classic-light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('classic-light');
    });

    it('bootstraps gold when storage is empty', () => {
      const theme = bootstrapTheme();
      expect(theme).toBe('gold');
      expect(document.documentElement.getAttribute('data-theme')).toBe('gold');
    });
  });
});
