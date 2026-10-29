import { type WeightUnit, kgToDisplay } from '@gzclp/domain/weight-unit';

/**
 * Locale-aware weight formatting for the desktop surfaces (S9): the displayed
 * number uses the language's decimal separator and grouping. Conversion stays in
 * the domain (`kgToDisplay`, incl. the two-decimal lbs rounding); these helpers
 * only own presentation.
 */

/** Map a (possibly region-qualified) UI language to a concrete Intl locale. */
function toIntlLocale(lang: string): string {
  const base = (lang || 'es').split('-')[0];
  return base === 'en' ? 'en-US' : 'es-ES';
}

/**
 * Format a plain number for display: es-ES → "10.240" / "22,5", en-US →
 * "10,240" / "22.5". Grouping is always on; at most two fraction digits.
 */
export function formatLocaleNumber(value: number, lang: string): string {
  return new Intl.NumberFormat(toIntlLocale(lang), {
    useGrouping: 'always',
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a stored kg weight for the given unit and language, e.g. "22,5 kg",
 * "10.240 kg" or "49,6 lbs".
 */
export function formatLocaleWeight(kg: number, unit: WeightUnit, lang: string): string {
  return `${formatLocaleNumber(kgToDisplay(kg, unit), lang)} ${unit}`;
}
