import { useCallback, useSyncExternalStore } from 'react';
import { type WeightUnit, displayToKg, formatWeight, kgToDisplay } from '@gzclp/domain/weight-unit';
import { readWeightUnit, subscribeWeightUnit, writeWeightUnit } from '@/lib/weight-unit';

export interface UnitPreference {
  readonly unit: WeightUnit;
  readonly toggleUnit: () => void;
  readonly toDisplay: (kg: number) => number;
  readonly fromDisplay: (value: number) => number;
  readonly format: (kg: number) => string;
}

export function useUnitPreference(): UnitPreference {
  const unit = useSyncExternalStore(subscribeWeightUnit, readWeightUnit, () => 'kg' as const);

  const toggleUnit = useCallback((): void => {
    writeWeightUnit(readWeightUnit() === 'kg' ? 'lbs' : 'kg');
  }, []);
  const toDisplay = useCallback((kg: number): number => kgToDisplay(kg, unit), [unit]);
  const fromDisplay = useCallback((v: number): number => displayToKg(v, unit), [unit]);
  const format = useCallback((kg: number): string => formatWeight(kg, unit), [unit]);

  return { unit, toggleUnit, toDisplay, fromDisplay, format };
}
