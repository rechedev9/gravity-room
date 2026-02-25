/**
 * Conversion: slot-keyed API format ↔ tier-keyed legacy format.
 *
 * These functions are used by api-functions.ts to translate between the API's
 * slot-keyed results (e.g. { "day1-t1": { result: "success" } }) and the
 * component-facing tier-keyed format (e.g. { t1: "success" }).
 */

import type { Results, UndoHistory } from '@gzclp/shared/types';
import type { GenericResults, GenericUndoHistory } from '@gzclp/shared/types/program';

type LegacyTierKey = 't1' | 't2' | 't3';

// ---------------------------------------------------------------------------
// Slot ↔ Tier lookup tables (inlined GZCLP constants)
// ---------------------------------------------------------------------------

/** GZCLP slot-tier reverse map. Inlined to eliminate import of gzclp.ts. */
const SLOT_TIER_MAP: Readonly<Record<string, string>> = {
  'd1-t1': 't1',
  'd1-t2': 't2',
  'latpulldown-t3': 't3',
  'd2-t1': 't1',
  'd2-t2': 't2',
  'dbrow-t3': 't3',
  'd3-t1': 't1',
  'd3-t2': 't2',
  'd4-t1': 't1',
  'd4-t2': 't2',
};
const VALID_TIERS: ReadonlySet<string> = new Set(['t1', 't2', 't3']);

function isTier(value: string): value is LegacyTierKey {
  return VALID_TIERS.has(value);
}

// ---------------------------------------------------------------------------
// Conversion: slot-keyed → tier-keyed (API response → component format)
// ---------------------------------------------------------------------------

export function convertResultsToLegacy(generic: GenericResults): Results {
  const legacy: Results = {};

  for (const [indexStr, slotResults] of Object.entries(generic)) {
    const entry: {
      t1?: 'success' | 'fail';
      t2?: 'success' | 'fail';
      t3?: 'success' | 'fail';
      t1Reps?: number;
      t3Reps?: number;
      rpe?: number;
      t3Rpe?: number;
    } = {};
    let hasData = false;

    for (const [slotId, slotResult] of Object.entries(slotResults)) {
      const tierStr = SLOT_TIER_MAP[slotId];
      if (!tierStr || !isTier(tierStr)) continue;

      if (slotResult.result !== undefined) {
        entry[tierStr] = slotResult.result;
        hasData = true;
      }
      if (slotResult.amrapReps !== undefined && tierStr === 't1')
        entry.t1Reps = slotResult.amrapReps;
      if (slotResult.amrapReps !== undefined && tierStr === 't3')
        entry.t3Reps = slotResult.amrapReps;
      if (slotResult.rpe !== undefined && tierStr === 't1') entry.rpe = slotResult.rpe;
      // fix: map T3 slot RPE to independent t3Rpe field
      if (slotResult.rpe !== undefined && tierStr === 't3') entry.t3Rpe = slotResult.rpe;
    }

    if (hasData) {
      legacy[indexStr] = entry;
    }
  }

  return legacy;
}

export function convertUndoToLegacy(generic: GenericUndoHistory): UndoHistory {
  return generic
    .map((entry) => {
      const tierStr = SLOT_TIER_MAP[entry.slotId];
      if (!tierStr || !isTier(tierStr)) return null;
      return { i: entry.i, tier: tierStr, prev: entry.prev };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
}
