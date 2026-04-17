import { useState, useCallback } from 'react';

export type WeightUnit = 'kg' | 'lbs';

const STORAGE_KEY = 'gravity-room:unit-preference';
const LBS_FACTOR = 2.20462;

function readStoredUnit(): WeightUnit {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'lbs' ? 'lbs' : 'kg';
  } catch {
    return 'kg';
  }
}

export interface UnitPreference {
  readonly unit: WeightUnit;
  readonly toggleUnit: () => void;
  readonly toDisplay: (kg: number) => number;
}

export function useUnitPreference(): UnitPreference {
  const [unit, setUnit] = useState<WeightUnit>(readStoredUnit);

  const toggleUnit = useCallback((): void => {
    setUnit((prev) => {
      const next: WeightUnit = prev === 'kg' ? 'lbs' : 'kg';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const toDisplay = useCallback(
    (kg: number): number => {
      if (unit === 'lbs') return Math.round(kg * LBS_FACTOR * 10) / 10;
      return kg;
    },
    [unit]
  );

  return { unit, toggleUnit, toDisplay };
}
