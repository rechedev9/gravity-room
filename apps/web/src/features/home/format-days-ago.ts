import type { TFunction } from 'i18next';

/**
 * Returns a locale-aware "days ago" string for the last-session display.
 * Uses three distinct keys to avoid CLDR _zero limitation:
 *   - last_today for 0
 *   - last_yesterday for 1
 *   - last_days_ago (with i18next count-based _one/_other selection) for 2+
 * Note: last_days_ago_one is kept in locale files for key parity but is
 * unreachable at runtime (days=1 short-circuits to last_yesterday above).
 */
export function formatDaysAgo(t: TFunction, days: number): string {
  if (days === 0) return t('home.header.last_today');
  if (days === 1) return t('home.header.last_yesterday');
  return t('home.header.last_days_ago', { count: days });
}
