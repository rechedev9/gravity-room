import type { SupportedLanguage } from '../i18n';

export type LocalizedWeightParseResult =
  | { readonly success: true; readonly value: number }
  | { readonly success: false };

const EN_WEIGHT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const ES_WEIGHT_PATTERN = /^(?:0|[1-9]\d*)(?:,\d+)?$/;

export function formatLocalizedWeight(value: number, language: SupportedLanguage): string {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Weight formatter requires a finite non-negative value');
  }
  const canonical = String(value);
  return language === 'es' ? canonical.replace('.', ',') : canonical;
}

/**
 * Parses a weight at the UI boundary. Group separators, exponents, signs and
 * the other locale's decimal separator are rejected instead of guessed.
 */
export function parseLocalizedWeight(
  input: string,
  language: SupportedLanguage
): LocalizedWeightParseResult {
  const normalized = input.trim();
  const pattern = language === 'es' ? ES_WEIGHT_PATTERN : EN_WEIGHT_PATTERN;
  if (!pattern.test(normalized)) {
    return { success: false };
  }

  const numeric = Number(language === 'es' ? normalized.replace(',', '.') : normalized);
  if (!Number.isFinite(numeric)) {
    return { success: false };
  }
  return { success: true, value: numeric };
}
