import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { type WeightUnit } from '@gzclp/domain/weight-unit';
import { formatLocaleNumber, formatLocaleWeight } from '@/lib/locale-weight';
import { useUnitPreference } from './use-unit-preference';

export interface LocaleWeight {
  readonly unit: WeightUnit;
  readonly formatNumber: (value: number) => string;
  readonly formatWeight: (kg: number) => string;
}

/**
 * Combines the stored unit preference with the active i18n language so desktop
 * surfaces render weights with the right unit and decimal separator (S9).
 */
export function useLocaleWeight(): LocaleWeight {
  const { unit } = useUnitPreference();
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const formatNumber = useCallback(
    (value: number): string => formatLocaleNumber(value, lang),
    [lang]
  );
  const formatWeight = useCallback(
    (kg: number): string => formatLocaleWeight(kg, unit, lang),
    [unit, lang]
  );

  return { unit, formatNumber, formatWeight };
}
