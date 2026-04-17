import type { TFunction } from 'i18next';

// last_days_ago_one is kept in locale files for parity but unreachable:
// days=1 short-circuits to last_yesterday before i18next plural selection runs.
export function formatDaysAgo(t: TFunction, days: number): string {
  if (days === 0) return t('home.header.last_today');
  if (days === 1) return t('home.header.last_yesterday');
  return t('home.header.last_days_ago', { count: days });
}
