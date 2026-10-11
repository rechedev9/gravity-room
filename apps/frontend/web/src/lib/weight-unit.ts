import { isWeightUnit, type WeightUnit } from '@gzclp/domain/weight-unit';

/**
 * Browser-side cache of the weight unit. The account holds the real value for
 * signed-in users; this key keeps guests and the first paint working.
 */
export const WEIGHT_UNIT_STORAGE_KEY = 'gravity-room:unit-preference';
/** Id of the account the stored unit was last reconciled with; absent for a guest choice. */
export const WEIGHT_UNIT_OWNER_KEY = 'gravity-room:unit-owner';
/** Id of the account that has not yet accepted the stored unit; absent once it is saved. */
export const WEIGHT_UNIT_PENDING_KEY = 'gravity-room:unit-pending';
const WEIGHT_UNIT_EVENT = 'gravity-room:unit-change';

/** The explicit choice made in this browser, or null when none was ever stored. */
export function readStoredWeightUnit(): WeightUnit | null {
  try {
    const stored = localStorage.getItem(WEIGHT_UNIT_STORAGE_KEY);
    return isWeightUnit(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function readWeightUnit(): WeightUnit {
  return readStoredWeightUnit() ?? 'kg';
}

export function writeWeightUnit(unit: WeightUnit): void {
  try {
    localStorage.setItem(WEIGHT_UNIT_STORAGE_KEY, unit);
  } catch {
    // storage unavailable: the in-memory event still updates this tab
  }
  window.dispatchEvent(new Event(WEIGHT_UNIT_EVENT));
}

export function readWeightUnitOwner(): string | null {
  try {
    return localStorage.getItem(WEIGHT_UNIT_OWNER_KEY);
  } catch {
    return null;
  }
}

export function writeWeightUnitOwner(userId: string): void {
  try {
    localStorage.setItem(WEIGHT_UNIT_OWNER_KEY, userId);
  } catch {
    // storage unavailable: the choice is simply reconciled again next load
  }
}

export function readWeightUnitPending(): string | null {
  try {
    return localStorage.getItem(WEIGHT_UNIT_PENDING_KEY);
  } catch {
    return null;
  }
}

export function writeWeightUnitPending(userId: string | null): void {
  try {
    if (userId === null) localStorage.removeItem(WEIGHT_UNIT_PENDING_KEY);
    else localStorage.setItem(WEIGHT_UNIT_PENDING_KEY, userId);
  } catch {
    // storage unavailable: a rejected write is then simply not retried
  }
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
