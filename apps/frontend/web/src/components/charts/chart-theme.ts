/** CSS-var-based chart theme. Module-level cache busted on theme change. */

import { useSyncExternalStore } from 'react';
import { THEME_CHANGE_EVENT, getThemePreference } from '@/lib/theme-preference';

const DATE_FMT = new Intl.DateTimeFormat('es-ES', { month: 'short', day: 'numeric' });

export function formatChartDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : DATE_FMT.format(d);
}

export type ChartTheme = {
  readonly grid: string;
  readonly text: string;
  readonly line: string;
  readonly ok: string;
  readonly fail: string;
  readonly pr: string;
  readonly bg: string;
  /** Idle flat-bar fill (raised surface). */
  readonly surface2: string;
  /** Prominent hairline stroke for idle bars / baselines. */
  readonly ruleStrong: string;
};

let _theme: ChartTheme | null = null;
let _listening = false;

function ensureThemeListener(): void {
  if (_listening || typeof document === 'undefined') return;
  _listening = true;
  document.addEventListener(THEME_CHANGE_EVENT, () => {
    _theme = null;
  });
}

function readTheme(): ChartTheme {
  const style = getComputedStyle(document.documentElement);
  const get = (v: string): string => style.getPropertyValue(v).trim() || '';
  return {
    grid: get('--color-chart-grid') || '#2a2218',
    text: get('--color-chart-text') || '#8a7a5a',
    line: get('--color-chart-line') || '#f0c040',
    ok: get('--color-chart-ok') || '#3a6828',
    fail: get('--color-chart-fail') || '#7a2828',
    pr: get('--color-chart-pr') || '#d4a843',
    bg: get('--color-th') || '#1a1410',
    surface2: get('--color-surface-2') || '#26211a',
    ruleStrong: get('--color-rule-light') || '#4a4338',
  };
}

/** Drop the cached palette so the next read re-samples CSS variables. */
export function invalidateChartTheme(): void {
  _theme = null;
}

export function getChartTheme(): ChartTheme {
  ensureThemeListener();
  return (_theme ??= readTheme());
}

function subscribeTheme(onStoreChange: () => void): () => void {
  document.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  return () => document.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
}

/**
 * React hook: re-renders chart consumers when the skin changes so SVG strokes
 * pick up the new CSS-variable palette (cache is already busted by the event).
 */
export function useChartTheme(): ChartTheme {
  // Subscribe to theme id so React re-renders; re-read vars each time.
  useSyncExternalStore(subscribeTheme, getThemePreference, () => 'gold' as const);
  return getChartTheme();
}
