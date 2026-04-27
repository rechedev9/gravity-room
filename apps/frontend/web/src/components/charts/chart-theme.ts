/** CSS-var-based chart theme. Module-level cache — vars are static at runtime. */

const DATE_FMT = new Intl.DateTimeFormat('es-ES', { month: 'short', day: 'numeric' });

export function formatChartDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : DATE_FMT.format(d);
}

type ChartTheme = {
  readonly grid: string;
  readonly text: string;
  readonly line: string;
  readonly ok: string;
  readonly fail: string;
  readonly pr: string;
  readonly bg: string;
};

let _theme: ChartTheme | null = null;

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
  };
}

export function getChartTheme(): ChartTheme {
  return (_theme ??= readTheme());
}
