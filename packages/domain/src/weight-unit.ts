export const WEIGHT_UNITS = ['kg', 'lbs'] as const;

export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const DEFAULT_WEIGHT_UNIT: WeightUnit = 'kg';

const LBS_PER_KG = 2.20462;

export function isWeightUnit(value: unknown): value is WeightUnit {
  return value === 'kg' || value === 'lbs';
}

/** Stored weights are always kg; lbs exist only at the display/input boundary. */
export function kgToDisplay(kg: number, unit: WeightUnit): number {
  if (unit === 'lbs') return Math.round(kg * LBS_PER_KG * 10) / 10;
  return kg;
}

export function displayToKg(value: number, unit: WeightUnit): number {
  if (unit === 'lbs') return Math.round((value / LBS_PER_KG) * 100) / 100;
  return value;
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${kgToDisplay(kg, unit)} ${unit}`;
}
