export type WeightUnit = 'kg' | 'lbs';

export const WEIGHT_UNIT_STORAGE_KEY = 'gravity-room:unit-preference';
const WEIGHT_UNIT_EVENT = 'gravity-room:unit-change';
const LBS_PER_KG = 2.20462;

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

export function readWeightUnit(): WeightUnit {
  try {
    return localStorage.getItem(WEIGHT_UNIT_STORAGE_KEY) === 'lbs' ? 'lbs' : 'kg';
  } catch {
    return 'kg';
  }
}

export function writeWeightUnit(unit: WeightUnit): void {
  try {
    localStorage.setItem(WEIGHT_UNIT_STORAGE_KEY, unit);
  } catch {
    // storage unavailable: the in-memory event still updates this tab
  }
  window.dispatchEvent(new Event(WEIGHT_UNIT_EVENT));
}

export function subscribeWeightUnit(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent): void => {
    if (e.key === WEIGHT_UNIT_STORAGE_KEY || e.key === null) onChange();
  };
  window.addEventListener(WEIGHT_UNIT_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(WEIGHT_UNIT_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}
