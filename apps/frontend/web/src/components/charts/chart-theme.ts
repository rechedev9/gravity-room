/** CSS-var-based chart theme. Single listener busts cache + notifies React. */

import { useSyncExternalStore } from 'react';
import { THEME_CHANGE_EVENT } from '@/lib/theme-preference';

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
/** Bumped on every palette invalidation so useSyncExternalStore re-renders. */
let _version = 0;
let _listening = false;
const _subscribers = new Set<() => void>();

function notifySubscribers(): void {
  for (const sub of _subscribers) {
    sub();
  }
}

function onThemeChange(): void {
  _theme = null;
  _version += 1;
  notifySubscribers();
}

function installListener(): void {
  if (_listening || typeof document === 'undefined') return;
  _listening = true;
  document.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
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
  _version += 1;
  notifySubscribers();
}

/**
 * Read the chart palette from CSS variables (cached until theme change).
 * Installs the module listener on first use so THEME_CHANGE_EVENT busts cache.
 */
export function getChartTheme(): ChartTheme {
  installListener();
  return (_theme ??= readTheme());
}

function subscribeVersion(onStoreChange: () => void): () => void {
  installListener();
  _subscribers.add(onStoreChange);
  return () => {
    _subscribers.delete(onStoreChange);
  };
}

function getVersionSnapshot(): number {
  return _version;
}

/**
 * React hook: re-renders chart consumers when the skin changes so SVG strokes
 * pick up the new CSS-variable palette.
 */
export function useChartTheme(): ChartTheme {
  useSyncExternalStore(subscribeVersion, getVersionSnapshot, () => 0);
  return getChartTheme();
}

/** Test-only: reset module listener state between cases. */
export function __resetChartThemeForTests(): void {
  _theme = null;
  _version = 0;
  _listening = false;
  _subscribers.clear();
}
