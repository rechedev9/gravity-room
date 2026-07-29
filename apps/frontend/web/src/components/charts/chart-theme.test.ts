import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyThemeToDocument,
  setThemePreference,
  THEME_STORAGE_KEY,
} from '@/lib/theme-preference';
import { getChartTheme, invalidateChartTheme } from './chart-theme';

/**
 * Chart theme must re-sample CSS variables after a skin change so charts
 * never keep a stale gold-only palette under classic light/dark.
 */
describe('chart-theme cache invalidation', () => {
  beforeEach(() => {
    localStorage.clear();
    invalidateChartTheme();
    // Seed distinct CSS vars so we can observe re-reads without depending on
    // the full globals.css token set being loaded in jsdom.
    const root = document.documentElement;
    root.style.setProperty('--color-chart-line', 'rgb(200, 168, 78)');
    root.style.setProperty('--color-chart-grid', 'rgb(40, 34, 24)');
    root.style.setProperty('--color-chart-text', 'rgb(138, 122, 90)');
    root.style.setProperty('--color-chart-ok', 'rgb(58, 104, 40)');
    root.style.setProperty('--color-chart-fail', 'rgb(122, 40, 40)');
    root.style.setProperty('--color-chart-pr', 'rgb(212, 168, 67)');
    root.style.setProperty('--color-th', 'rgb(26, 20, 16)');
    root.style.setProperty('--color-surface-2', 'rgb(38, 33, 26)');
    root.style.setProperty('--color-rule-light', 'rgb(74, 67, 56)');
    applyThemeToDocument('gold');
  });

  afterEach(() => {
    localStorage.clear();
    invalidateChartTheme();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
  });

  it('caches the first read and returns the same object until invalidated', () => {
    const a = getChartTheme();
    const b = getChartTheme();
    expect(a).toBe(b);
    expect(a.line).toBe('rgb(200, 168, 78)');
  });

  it('re-reads CSS variables after invalidateChartTheme', () => {
    const first = getChartTheme();
    expect(first.line).toBe('rgb(200, 168, 78)');

    document.documentElement.style.setProperty('--color-chart-line', 'rgb(59, 91, 219)');
    invalidateChartTheme();
    const second = getChartTheme();
    expect(second.line).toBe('rgb(59, 91, 219)');
    expect(second).not.toBe(first);
  });

  it('busts the cache when the theme change event fires via setThemePreference', () => {
    const first = getChartTheme();
    expect(first.line).toBe('rgb(200, 168, 78)');

    // Simulate a classic-light palette swap, then switch theme (event fires).
    document.documentElement.style.setProperty('--color-chart-line', 'rgb(59, 91, 219)');
    document.documentElement.style.setProperty('--color-chart-grid', 'rgb(220, 224, 232)');
    setThemePreference('classic-light');

    const second = getChartTheme();
    expect(second.line).toBe('rgb(59, 91, 219)');
    expect(second.grid).toBe('rgb(220, 224, 232)');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('classic-light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('classic-light');
  });

  it('returns different resolved line colors after cycling gold → light → dark vars', () => {
    const gold = getChartTheme();
    expect(gold.line).toBe('rgb(200, 168, 78)');

    document.documentElement.style.setProperty('--color-chart-line', 'rgb(59, 91, 219)');
    setThemePreference('classic-light');
    const light = getChartTheme();
    expect(light.line).toBe('rgb(59, 91, 219)');

    document.documentElement.style.setProperty('--color-chart-line', 'rgb(116, 143, 252)');
    setThemePreference('classic-dark');
    const dark = getChartTheme();
    expect(dark.line).toBe('rgb(116, 143, 252)');

    // All three palettes are distinct — proves the shipped path re-samples.
    expect(new Set([gold.line, light.line, dark.line]).size).toBe(3);
  });
});
