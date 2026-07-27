import type { SupportedLanguage } from '../i18n';
import { ProgramWeightValueSchema } from '@gzclp/domain';

export type LocalizedWeightParseResult =
  | { readonly success: true; readonly value: number }
  | { readonly success: false };

const EN_WEIGHT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const ES_WEIGHT_PATTERN = /^(?:0|[1-9]\d*)(?:,\d+)?$/;

export function formatLocalizedWeight(value: number, language: SupportedLanguage): string {
  if (!ProgramWeightValueSchema.safeParse(value).success) {
    throw new Error('Weight formatter received a value outside the supported decimal range');
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
  if (!ProgramWeightValueSchema.safeParse(numeric).success) {
    return { success: false };
  }
  return { success: true, value: numeric };
}
